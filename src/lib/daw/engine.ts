import { click, playVoice, type Voice } from '@/lib/daw/synth';
import { DEFAULT_MASTER, FxChain, MasterBus } from '@/lib/daw/fx';
import { effectiveGain, projectEnd, type Lane, type MasterSettings } from '@/lib/daw/types';

/** One mixer channel: input → insert FX → fader → pan → bus (with a meter tap). */
interface LaneNode {
	input: GainNode;
	chain: FxChain;
	gain: GainNode;
	pan: StereoPannerNode;
	meter: AnalyserNode | null;
}

function buildLaneNode(ctx: BaseAudioContext, dest: AudioNode, lane: Lane, withMeter: boolean): LaneNode {
	const input = ctx.createGain();
	const gain = ctx.createGain();
	const pan = ctx.createStereoPanner();
	const chain = new FxChain(ctx, input, gain, lane.fx ?? []);
	gain.connect(pan);
	pan.connect(dest);
	let meter: AnalyserNode | null = null;
	if (withMeter) {
		meter = ctx.createAnalyser();
		meter.fftSize = 1024;
		pan.connect(meter);
	}
	return { input, chain, gain, pan, meter };
}

/** Schedule every clip that is audible from `from` (timeline seconds), starting at context time `when`. */
function scheduleLanes(
	ctx: BaseAudioContext,
	lanes: Lane[],
	nodeFor: (lane: Lane) => AudioNode,
	from: number,
	when: number,
	getBuffer: (url: string) => AudioBuffer | undefined,
	onSource: (source: AudioBufferSourceNode) => void,
	onVoice: (voice: Voice) => void,
) {
	for (const lane of lanes) {
		const dest = nodeFor(lane);
		for (const clip of lane.clips) {
			const end = clip.start + clip.duration;
			if (end <= from) continue;
			if (clip.kind === 'audio') {
				const buffer = getBuffer(clip.url);
				if (!buffer) continue;
				const into = Math.max(0, from - clip.start);
				const offset = clip.offset + into;
				if (offset >= buffer.duration) continue;
				const length = Math.min(clip.duration - into, buffer.duration - offset);
				if (length <= 0) continue;
				const source = ctx.createBufferSource();
				source.buffer = buffer;
				source.connect(dest);
				source.start(when + Math.max(0, clip.start - from), offset, length);
				onSource(source);
			} else {
				for (const note of clip.notes) {
					if (note.start >= clip.duration) continue;
					const abs = clip.start + note.start;
					if (abs < from) continue;
					const length = Math.min(note.duration, clip.duration - note.start);
					onVoice(playVoice(ctx, dest, lane.instrument, note.pitch, when + abs - from, note.velocity, length));
				}
			}
		}
	}
}

function peakOf(analyser: AnalyserNode, scratch: Float32Array<ArrayBuffer>): number {
	analyser.getFloatTimeDomainData(scratch);
	let peak = 0;
	for (let i = 0; i < scratch.length; i += 1) {
		const v = Math.abs(scratch[i]);
		if (v > peak) peak = v;
	}
	return peak;
}

export interface MixLevels {
	lanes: Record<string, number>;
	master: number;
	/** Limiter gain reduction, dB (≤ 0). */
	reduction: number;
}

/** Web Audio engine for the Studio: buffers, transport, mixer (FX + master), live instrument notes, metronome and offline mixdown. */
export class DawEngine {
	private ctx: AudioContext | null = null;
	private bus: MasterBus | null = null;
	private masterMeter: AnalyserNode | null = null;
	private masterSettings: MasterSettings = DEFAULT_MASTER;
	private buffers = new Map<string, AudioBuffer>();
	private pending = new Map<string, Promise<AudioBuffer | null>>();
	private sources: AudioBufferSourceNode[] = [];
	private voices: Voice[] = [];
	private laneNodes = new Map<string, LaneNode>();
	private live = new Map<string, Voice>();
	private scratch = new Float32Array(new ArrayBuffer(1024 * 4));
	private startCtx = 0;
	private startPos = 0;
	private playing = false;
	private metroOn = false;
	private bpm = 120;
	private metroTimer: number | null = null;
	private nextBeat = 0;
	/** Bumped on every play/pause so a play that is still loading can't start sound after a stop. */
	private token = 0;

	private context(): AudioContext {
		if (!this.ctx) {
			this.ctx = new AudioContext();
			this.bus = new MasterBus(this.ctx, this.ctx.destination, this.masterSettings);
			this.masterMeter = this.ctx.createAnalyser();
			this.masterMeter.fftSize = 1024;
			this.bus.out.connect(this.masterMeter);
		}
		return this.ctx;
	}

	/** Where tracks are summed (the master bus input). */
	private busInput(): AudioNode {
		const ctx = this.context();
		return this.bus?.input ?? ctx.destination;
	}

	/** Metronome clicks skip the limiter but follow the master volume. */
	private clickOut(): AudioNode {
		const ctx = this.context();
		return this.bus?.out ?? ctx.destination;
	}

	async decodeFile(blob: Blob): Promise<AudioBuffer> {
		return this.context().decodeAudioData(await blob.arrayBuffer());
	}

	cache(url: string, buffer: AudioBuffer) {
		this.buffers.set(url, buffer);
	}

	getBuffer(url: string): AudioBuffer | undefined {
		return this.buffers.get(url);
	}

	load(url: string): Promise<AudioBuffer | null> {
		const have = this.buffers.get(url);
		if (have) return Promise.resolve(have);
		const waiting = this.pending.get(url);
		if (waiting) return waiting;
		const job = fetch(url)
			.then((res) => {
				if (!res.ok) throw new Error('fetch failed');
				return res.arrayBuffer();
			})
			.then((data) => this.context().decodeAudioData(data))
			.then((buffer) => {
				this.buffers.set(url, buffer);
				return buffer;
			})
			.catch(() => null)
			.finally(() => this.pending.delete(url));
		this.pending.set(url, job);
		return job;
	}

	async loadAll(lanes: Lane[]) {
		const urls = new Set<string>();
		lanes.forEach((lane) => lane.clips.forEach((clip) => clip.kind === 'audio' && urls.add(clip.url)));
		await Promise.all([...urls].map((url) => this.load(url)));
	}

	private laneNode(lane: Lane): LaneNode {
		let node = this.laneNodes.get(lane.id);
		if (!node) {
			node = buildLaneNode(this.context(), this.busInput(), lane, true);
			node.gain.gain.value = lane.mute ? 0 : lane.volume;
			node.pan.pan.value = lane.pan;
			this.laneNodes.set(lane.id, node);
		}
		return node;
	}

	/** Apply volume, pan, mute, solo and insert effects live. */
	updateMix(lanes: Lane[]) {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		const anySolo = lanes.some((l) => l.solo);
		const keep = new Set<string>();
		for (const lane of lanes) {
			keep.add(lane.id);
			const node = this.laneNode(lane);
			node.gain.gain.setTargetAtTime(effectiveGain(lane, anySolo), now, 0.015);
			node.pan.pan.setTargetAtTime(lane.pan, now, 0.015);
			node.chain.update(lane.fx ?? []);
		}
		// Free channels of deleted tracks.
		this.laneNodes.forEach((node, id) => {
			if (keep.has(id)) return;
			node.chain.dispose();
			node.pan.disconnect();
			this.laneNodes.delete(id);
		});
	}

	updateMaster(settings: MasterSettings) {
		this.masterSettings = settings;
		this.bus?.update(settings);
	}

	/** Current peak level (linear 0–1+) per track and on the master, for the mixer meters. */
	getLevels(): MixLevels {
		const lanes: Record<string, number> = {};
		if (!this.ctx) return { lanes, master: 0, reduction: 0 };
		this.laneNodes.forEach((node, id) => {
			lanes[id] = node.meter ? peakOf(node.meter, this.scratch) : 0;
		});
		return {
			lanes,
			master: this.masterMeter ? peakOf(this.masterMeter, this.scratch) : 0,
			reduction: this.bus?.reduction ?? 0,
		};
	}

	getTime(): number {
		if (!this.playing || !this.ctx) return this.startPos;
		return Math.max(0, this.startPos + this.ctx.currentTime - this.startCtx);
	}

	async play(lanes: Lane[], from: number, metronome: boolean, bpm: number) {
		const token = ++this.token;
		this.halt();
		const ctx = this.context();
		if (ctx.state !== 'running') await ctx.resume();
		await this.loadAll(lanes);
		if (token !== this.token || this.ctx !== ctx) return false;
		this.halt();
		this.updateMix(lanes);
		const when = ctx.currentTime + 0.06;
		scheduleLanes(
			ctx,
			lanes,
			(lane) => this.laneNode(lane).input,
			from,
			when,
			(url) => this.buffers.get(url),
			(source) => this.sources.push(source),
			(voice) => this.voices.push(voice),
		);
		this.startCtx = when;
		this.startPos = from;
		this.playing = true;
		this.metroOn = metronome;
		this.bpm = bpm;
		this.startMetronome();
		return true;
	}

	/** Stop playback and return the position where it stopped. */
	pause(): number {
		this.token += 1;
		const pos = this.getTime();
		this.halt();
		this.startPos = pos;
		return pos;
	}

	seek(time: number) {
		this.startPos = Math.max(0, time);
	}

	private halt() {
		this.sources.forEach((source) => {
			try {
				source.stop();
			} catch {
				/* not started */
			}
			source.disconnect();
		});
		this.sources = [];
		this.voices.forEach((voice) => voice.kill());
		this.voices = [];
		this.stopMetronome();
		this.playing = false;
	}

	setMetronome(on: boolean, bpm: number) {
		this.metroOn = on;
		this.bpm = bpm;
		if (this.playing) this.startMetronome();
	}

	private stopMetronome() {
		if (this.metroTimer !== null) {
			window.clearInterval(this.metroTimer);
			this.metroTimer = null;
		}
	}

	private startMetronome() {
		this.stopMetronome();
		const ctx = this.ctx;
		if (!this.metroOn || !this.playing || !ctx) return;
		const beat = 60 / this.bpm;
		this.nextBeat = Math.ceil(Math.max(this.startPos, this.getTime()) / beat - 1e-6);
		const tick = () => {
			const len = 60 / this.bpm;
			for (;;) {
				const at = this.startCtx + this.nextBeat * len - this.startPos;
				if (at > ctx.currentTime + 0.12) break;
				if (at >= ctx.currentTime - 0.01) click(ctx, this.clickOut(), Math.max(at, ctx.currentTime), this.nextBeat % 4 === 0);
				this.nextBeat += 1;
			}
		};
		tick();
		this.metroTimer = window.setInterval(tick, 25);
	}

	/** Play a held note on an instrument lane (piano, computer keyboard or MIDI). */
	noteOn(lane: Lane, pitch: number, velocity: number) {
		const ctx = this.context();
		if (ctx.state !== 'running') void ctx.resume();
		const key = `${lane.id}:${pitch}`;
		this.live.get(key)?.release(ctx.currentTime);
		this.live.set(key, playVoice(ctx, this.laneNode(lane).input, lane.instrument, pitch, ctx.currentTime, velocity));
	}

	noteOff(laneId: string, pitch: number) {
		const key = `${laneId}:${pitch}`;
		const voice = this.live.get(key);
		if (!voice || !this.ctx) return;
		voice.release(this.ctx.currentTime);
		this.live.delete(key);
	}

	/** Render the whole project offline (with every effect and the master bus) into a stereo buffer. */
	async render(lanes: Lane[], master: MasterSettings = this.masterSettings): Promise<AudioBuffer | null> {
		await this.loadAll(lanes);
		const end = projectEnd(lanes);
		if (end <= 0) return null;
		const rate = 44100;
		const hasTail = lanes.some((l) => (l.fx ?? []).some((f) => !f.bypass && (f.type === 'reverb' || f.type === 'delay')));
		const offline = new OfflineAudioContext(2, Math.ceil((end + (hasTail ? 6 : 2)) * rate), rate);
		const bus = new MasterBus(offline, offline.destination, master);
		const anySolo = lanes.some((l) => l.solo);
		const nodes = new Map<string, AudioNode>();
		for (const lane of lanes) {
			const node = buildLaneNode(offline, bus.input, lane, false);
			node.gain.gain.value = effectiveGain(lane, anySolo);
			node.pan.pan.value = lane.pan;
			nodes.set(lane.id, node.input);
		}
		scheduleLanes(
			offline,
			lanes,
			(lane) => nodes.get(lane.id) ?? bus.input,
			0,
			0,
			(url) => this.buffers.get(url),
			() => undefined,
			() => undefined,
		);
		return offline.startRendering();
	}

	dispose() {
		this.token += 1;
		this.halt();
		this.live.forEach((voice) => voice.kill());
		this.live.clear();
		this.laneNodes.forEach((node) => node.chain.dispose());
		this.laneNodes.clear();
		void this.ctx?.close();
		this.ctx = null;
		this.bus = null;
		this.masterMeter = null;
	}
}
