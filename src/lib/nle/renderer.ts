import { COLOR_GRADE_PRESETS } from '@/lib/storyboard';
import type {
	NleAspectRatio,
	NleClip,
	NleColorAdjust,
	NleProjectFx,
	NleTrack,
} from '@/lib/nle/types';

export function buildCssFilter(lutId: string, adjust?: NleColorAdjust): string {
	const preset = COLOR_GRADE_PRESETS.find((p) => p.id === lutId);
	const lutFilter = preset && preset.cssFilter !== 'none' ? preset.cssFilter : '';
	const b = adjust?.brightness ?? 100;
	const c = adjust?.contrast ?? 100;
	const s = adjust?.saturate ?? 100;
	const adjustFilter =
		b !== 100 || c !== 100 || s !== 100
			? `brightness(${b}%) contrast(${c}%) saturate(${s}%)`
			: '';
	const combined = [lutFilter, adjustFilter].filter(Boolean).join(' ');
	return combined || 'none';
}

function getCanvasSize(aspect: NleAspectRatio, resolution: '720p' | '1080p') {
	const hi = resolution === '1080p';
	if (aspect === '9:16') return hi ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
	if (aspect === '21:9') return hi ? { width: 1920, height: 822 } : { width: 1280, height: 548 };
	return hi ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		if (!url) {
			resolve(null);
			return;
		}
		const img = new Image();
		if (!url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('/')) {
			img.crossOrigin = 'anonymous';
		}
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = url;
	});
}

function loadVideo(url: string): Promise<HTMLVideoElement | null> {
	return new Promise((resolve) => {
		if (!url) {
			resolve(null);
			return;
		}
		const video = document.createElement('video');
		if (!url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('/')) {
			video.crossOrigin = 'anonymous';
		}
		video.muted = true;
		video.loop = true;
		video.playsInline = true;
		video.preload = 'auto';
		const timer = window.setTimeout(() => resolve(video.readyState >= 2 ? video : null), 5000);
		video.onloadeddata = () => {
			window.clearTimeout(timer);
			resolve(video);
		};
		video.onerror = () => {
			window.clearTimeout(timer);
			resolve(null);
		};
		video.src = url;
	});
}

function findActiveClip(clips: NleClip[], t: number): NleClip | null {
	if (clips.length === 0) return null;
	const exact = clips.find((c) => t >= c.startTime && t < c.startTime + c.duration);
	if (exact) return exact;
	const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
	const last = sorted[sorted.length - 1];
	if (last && t >= last.startTime && t <= last.startTime + last.duration + 0.05) {
		return last;
	}
	return null;
}

function findPreviousClip(clips: NleClip[], current: NleClip): NleClip | null {
	const prev = clips
		.filter((c) => c.id !== current.id && c.startTime < current.startTime)
		.sort((a, b) => b.startTime + b.duration - (a.startTime + a.duration))[0];
	return prev ?? null;
}

function drawVisualClip(
	ctx: CanvasRenderingContext2D,
	clip: NleClip,
	t: number,
	width: number,
	height: number,
	fx: NleProjectFx,
	alphaOverride: number | null,
	imageMap: Map<string, HTMLImageElement | null>,
	videoMap: Map<string, HTMLVideoElement | null>,
	playingVideos: Set<HTMLVideoElement>
) {
	const localT = Math.max(0, t - clip.startTime);
	const localRatio = Math.max(0, Math.min(1, localT / Math.max(0.1, clip.duration)));
	const transDur = Math.min(0.6, clip.duration * 0.22);

	let alpha = alphaOverride ?? clip.opacity;
	let offsetX = 0;
	let transScale = 1;
	if (alphaOverride === null) {
		if (clip.transitionIn === 'cross-dissolve' && localT < transDur) {
			alpha *= localT / transDur;
		} else if (clip.transitionIn === 'fade-black' && localT < transDur) {
			alpha *= localT / transDur;
		} else if (clip.transitionIn === 'slide-left' && localT < transDur) {
			offsetX = (1 - localT / transDur) * width * 0.35;
		} else if (clip.transitionIn === 'zoom-in' && localT < transDur) {
			transScale = 1.15 - 0.15 * (localT / transDur);
		}
	}

	const effLut = clip.lutId !== 'inherit' ? clip.lutId : fx.lutId;
	ctx.save();
	ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
	ctx.filter = buildCssFilter(effLut, clip.colorAdjust);

	let motionScale = transScale;
	let panX = offsetX;
	if (clip.cameraMotion === 'zoom-in') motionScale *= 1 + localRatio * 0.08;
	if (clip.cameraMotion === 'zoom-out') motionScale *= 1.09 - localRatio * 0.08;
	if (clip.cameraMotion === 'pan-left') {
		motionScale *= 1.08;
		panX -= localRatio * width * 0.04;
	}
	if (clip.cameraMotion === 'pan-right') {
		motionScale *= 1.08;
		panX += localRatio * width * 0.04;
	}

	if (clip.type === 'video') {
		const video = videoMap.get(clip.sourceUrl);
		if (video && video.videoWidth > 0) {
			playingVideos.add(video);
			video.playbackRate = clip.speed;
			video.loop = true;
			const srcDur = Number.isFinite(video.duration) && video.duration > 0.4 ? video.duration : clip.duration;
			const desired = (clip.trimStart + localT * clip.speed) % Math.max(0.5, srcDur);
			if (!video.seeking && Math.abs(video.currentTime - desired) > 0.9 && video.readyState >= 2) {
				try {
					video.currentTime = desired;
				} catch {
					// ignore seek error
				}
			}
			if (video.paused) {
				void video.play().catch(() => undefined);
			}
			const vidRatio = video.videoWidth / Math.max(1, video.videoHeight);
			const canvasRatio = width / height;
			let dw = width * motionScale;
			let dh = height * motionScale;
			if (vidRatio > canvasRatio) {
				dw = dh * vidRatio;
			} else {
				dh = dw / vidRatio;
			}
			ctx.drawImage(video, (width - dw) / 2 + panX, (height - dh) / 2, dw, dh);
		}
	} else {
		const img = imageMap.get(clip.sourceUrl);
		if (img && img.width > 0) {
			const imgRatio = img.width / Math.max(1, img.height);
			const canvasRatio = width / height;
			let dw = width * motionScale;
			let dh = height * motionScale;
			if (imgRatio > canvasRatio) {
				dw = dh * imgRatio;
			} else {
				dh = dw / imgRatio;
			}
			ctx.drawImage(img, (width - dw) / 2 + panX, (height - dh) / 2, dw, dh);
		}
	}
	ctx.restore();
}

export interface RenderNleOptions {
	tracks: NleTrack[];
	fx: NleProjectFx;
	aspect: NleAspectRatio;
	resolution: '720p' | '1080p';
	durationSeconds: number;
	onProgress?: (pct: number) => void;
}

export interface RenderNleResult {
	blob: Blob;
	url: string;
	ext: 'mp4' | 'webm';
}

export async function renderNleProject({
	tracks,
	fx,
	aspect,
	resolution,
	durationSeconds,
	onProgress,
}: RenderNleOptions): Promise<RenderNleResult> {
	const { width, height } = getCanvasSize(aspect, resolution);
	const fps = 24;
	// Export 1:1 in real time up to 240s so audio, cuts, lyrics & motion stay strictly synchronized
	const totalTimeline = Math.min(240, Math.max(4, durationSeconds));

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Tu navegador no soporta renderizado Canvas 2D.');

	const visualTracks = tracks
		.filter((t) => t.kind === 'video' && !t.hidden)
		.slice()
		.reverse();
	const textTracks = tracks.filter((t) => t.kind === 'text' && !t.hidden);
	const audioTracks = tracks.filter((t) => t.kind === 'audio' && !t.muted);

	const imageMap = new Map<string, HTMLImageElement | null>();
	const videoMap = new Map<string, HTMLVideoElement | null>();

	const preloadPromises: Promise<void>[] = [];
	for (const track of visualTracks) {
		for (const clip of track.clips) {
			if (!clip.sourceUrl) continue;
			if (clip.type === 'video' && !videoMap.has(clip.sourceUrl)) {
				videoMap.set(clip.sourceUrl, null);
				preloadPromises.push(
					loadVideo(clip.sourceUrl).then((v) => {
						videoMap.set(clip.sourceUrl, v);
					})
				);
			} else if (clip.type === 'image' && !imageMap.has(clip.sourceUrl)) {
				imageMap.set(clip.sourceUrl, null);
				preloadPromises.push(
					loadImage(clip.sourceUrl).then((img) => {
						imageMap.set(clip.sourceUrl, img);
					})
				);
			}
		}
	}
	await Promise.all(preloadPromises);

	const canvasStream = canvas.captureStream(fps);
	const streamTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

	let audioCtx: AudioContext | null = null;
	const activeAudioEls: { el: HTMLAudioElement; clip: NleClip; trackVol: number }[] = [];

	const audioSources: { url: string; clip: NleClip; trackVol: number }[] = [];
	for (const at of audioTracks) {
		for (const c of at.clips) {
			if (c.sourceUrl) {
				audioSources.push({ url: c.sourceUrl, clip: c, trackVol: at.volume });
			}
		}
	}
	for (const vt of visualTracks) {
		if (vt.muted) continue;
		for (const c of vt.clips) {
			if (c.type === 'video' && c.sourceUrl && c.volume > 0) {
				audioSources.push({ url: c.sourceUrl, clip: c, trackVol: vt.volume });
			}
		}
	}

	if (audioSources.length > 0) {
		try {
			audioCtx = new AudioContext();
			const dest = audioCtx.createMediaStreamDestination();
			const readyWaits: Promise<void>[] = [];
			for (const src of audioSources) {
				const el = new Audio();
				if (!src.url.startsWith('blob:') && !src.url.startsWith('data:') && !src.url.startsWith('/')) {
					el.crossOrigin = 'anonymous';
				}
				el.preload = 'auto';
				el.src = src.url;
				el.volume = Math.max(0, Math.min(1, src.clip.volume * src.trackVol));
				el.playbackRate = src.clip.speed;
				const node = audioCtx.createMediaElementSource(el);
				node.connect(dest);
				activeAudioEls.push({ el, clip: src.clip, trackVol: src.trackVol });
				readyWaits.push(
					new Promise<void>((resReady) => {
						const done = () => resReady();
						el.addEventListener('canplay', done, { once: true });
						el.addEventListener('error', done, { once: true });
						window.setTimeout(done, 2500);
					})
				);
			}
			await Promise.all(readyWaits);
			streamTracks.push(...dest.stream.getAudioTracks());
		} catch {
			audioCtx = null;
		}
	}

	const combined = new MediaStream(streamTracks);
	const mimeCandidates = [
		'video/mp4;codecs=avc1,mp4a.40.2',
		'video/mp4',
		'video/webm;codecs=vp9,opus',
		'video/webm;codecs=vp8,opus',
		'video/webm',
	];
	const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
	const recorder = new MediaRecorder(
		combined,
		mimeType
			? { mimeType, videoBitsPerSecond: resolution === '1080p' ? 5_500_000 : 3_000_000 }
			: undefined
	);
	const chunks: BlobPart[] = [];
	recorder.ondataavailable = (ev) => {
		if (ev.data.size > 0) chunks.push(ev.data);
	};

	const donePromise = new Promise<Blob>((resolve) => {
		recorder.onstop = () => {
			const isMp4 = mimeType.includes('mp4');
			resolve(new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' }));
		};
	});

	if (audioCtx && audioCtx.state === 'suspended') {
		await audioCtx.resume();
	}
	recorder.start(250);

	const startedAt = performance.now();

	await new Promise<void>((resolve) => {
		const step = () => {
			const wallT = (performance.now() - startedAt) / 1000;

			// Lock timeline clock to primary active audio hardware clock when available
			let masterAudioT: number | null = null;
			for (const item of activeAudioEls) {
				if (!item.el.paused && !item.el.seeking && item.el.readyState >= 2) {
					const mapped = item.clip.startTime + (item.el.currentTime - item.clip.trimStart) / Math.max(0.25, item.clip.speed);
					if (Number.isFinite(mapped) && mapped >= 0) {
						masterAudioT = mapped;
						break;
					}
				}
			}

			const t = masterAudioT !== null ? Math.min(totalTimeline, masterAudioT) : Math.min(totalTimeline, wallT);
			const ratio = Math.min(1, t / totalTimeline);
			onProgress?.(Math.round(ratio * 100));

			for (const item of activeAudioEls) {
				const inRange = t >= item.clip.startTime && t < item.clip.startTime + item.clip.duration;
				if (inRange) {
					const targetT = Math.max(0, item.clip.trimStart + (t - item.clip.startTime) * item.clip.speed);
					if (!item.el.seeking && item.el.readyState >= 2 && Math.abs(item.el.currentTime - targetT) > 0.85) {
						try {
							item.el.currentTime = targetT;
						} catch {
							// ignore seek error
						}
					}
					if (item.el.paused) void item.el.play().catch(() => undefined);
				} else if (!item.el.paused) {
					item.el.pause();
				}
			}

			ctx.save();
			ctx.fillStyle = '#07070a';
			ctx.fillRect(0, 0, width, height);

			const playingVideosThisFrame = new Set<HTMLVideoElement>();

			for (const vt of visualTracks) {
				const clip = findActiveClip(vt.clips, t);
				if (!clip) continue;

				const localT = Math.max(0, t - clip.startTime);
				const transDur = Math.min(0.6, clip.duration * 0.22);
				if (clip.transitionIn === 'cross-dissolve' && localT < transDur) {
					const prevClip = findPreviousClip(vt.clips, clip);
					if (prevClip) {
						drawVisualClip(
							ctx,
							prevClip,
							prevClip.startTime + prevClip.duration,
							width,
							height,
							fx,
							prevClip.opacity,
							imageMap,
							videoMap,
							playingVideosThisFrame
						);
					}
				}

				drawVisualClip(
					ctx,
					clip,
					t,
					width,
					height,
					fx,
					null,
					imageMap,
					videoMap,
					playingVideosThisFrame
				);
			}

			// Pause inactive videos so decoders don't compete
			for (const v of videoMap.values()) {
				if (v && !playingVideosThisFrame.has(v) && !v.paused) {
					v.pause();
				}
			}

			if (fx.lightLeak) {
				const leak = ctx.createLinearGradient(0, height, width, 0);
				leak.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
				leak.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
				leak.addColorStop(1, 'rgba(6, 182, 212, 0.22)');
				ctx.fillStyle = leak;
				ctx.fillRect(0, 0, width, height);
			}

			if (fx.vignette) {
				const vig = ctx.createRadialGradient(
					width / 2,
					height / 2,
					width * 0.22,
					width / 2,
					height / 2,
					width * 0.72
				);
				vig.addColorStop(0, 'rgba(0,0,0,0)');
				vig.addColorStop(1, 'rgba(0,0,0,0.62)');
				ctx.fillStyle = vig;
				ctx.fillRect(0, 0, width, height);
			}

			if (fx.letterbox) {
				const barH = Math.round(height * 0.1);
				ctx.fillStyle = '#000000';
				ctx.fillRect(0, 0, width, barH);
				ctx.fillRect(0, height - barH, width, barH);
			}

			for (const tt of textTracks) {
				const textClip = findActiveClip(tt.clips, t);
				if (!textClip?.textData?.text) continue;
				const td = textClip.textData;
				const scaledFont = Math.round(td.fontSize * (height / 720));
				const weight = td.fontWeight === 'black' ? 800 : td.fontWeight === 'bold' ? 700 : 500;
				ctx.save();
				ctx.font = `${weight} ${scaledFont}px system-ui, sans-serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				const text = td.text.slice(0, 90);
				const metrics = ctx.measureText(text);
				const boxW = Math.min(width * 0.88, metrics.width + scaledFont * 1.4);
				const boxH = scaledFont * 1.65;
				const y =
					td.position === 'top'
						? height * 0.16
						: td.position === 'center'
						? height * 0.5
						: height * (fx.letterbox ? 0.8 : 0.86);

				if (td.bgOpacity > 0) {
					ctx.fillStyle = `rgba(8, 8, 12, ${td.bgOpacity})`;
					ctx.fillRect((width - boxW) / 2, y - boxH / 2, boxW, boxH);
				}
				ctx.fillStyle = td.color || '#ffffff';
				ctx.fillText(text, width / 2, y, width * 0.84);
				ctx.restore();
			}

			ctx.restore();

			if (t >= totalTimeline || wallT >= totalTimeline + 0.5) {
				resolve();
			} else {
				requestAnimationFrame(step);
			}
		};
		requestAnimationFrame(step);
	});

	for (const v of videoMap.values()) {
		if (v && !v.paused) v.pause();
	}
	for (const item of activeAudioEls) {
		item.el.pause();
	}
	if (audioCtx) void audioCtx.close();
	recorder.stop();

	const blob = await donePromise;
	const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
	const url = URL.createObjectURL(blob);
	return { blob, url, ext };
}
