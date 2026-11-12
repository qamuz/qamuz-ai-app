import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useModules } from '@/hooks/useModules';
import { AudioWaveform, Copy, Disc3, Download, FilePlus2, FolderOpen, Music4, Piano, Save, SlidersVertical, Sparkles, Trash2, Upload } from 'lucide-react';
import { Mixer } from '@/components/daw/mixer/Mixer';
import { FloatingPanel } from '@/components/daw/FloatingPanel';
import { PianoRoll } from '@/components/daw/PianoRoll';
import { QamuzSamplerModal } from '@/components/daw/QamuzSamplerModal';
import { estimateTempoBpm } from '@/lib/daw/detectTempo';
import { DEFAULT_MASTER, newFx } from '@/lib/daw/fx';
import { Transport } from '@/components/daw/Transport';
import { LaneHeader } from '@/components/daw/LaneHeader';
import { Timeline } from '@/components/daw/Timeline';
import { ProjectsDialog } from '@/components/daw/ProjectsDialog';
import { DawEngine } from '@/lib/daw/engine';
import { loadProject, newLane, newProject, saveProject, uid } from '@/lib/daw/projects';
import { ROW_H, RULER_H, projectEnd, type AudioClip, type Clip, type DawProject, type Lane, type LaneType, type MidiClip, type MidiNote } from '@/lib/daw/types';
import { encodeWav } from '@/lib/engagement';
import { uploadMedia } from '@/lib/media';
import { fetchTrack } from '@/lib/queries';
import { fetchStemJob, sortedStems, STEM_LABELS } from '@/lib/stems';
import { useRecorder } from '@/hooks/use-recorder';
import { isTypingTarget, useNoteInput } from '@/hooks/use-note-input';
import { useAuth } from '@/hooks/useAuth';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/hooks/useI18n';

type Notice = {text: string;error?: boolean;} | null;

function ToolButton({ icon, label, onClick, disabled, badge }: {icon: React.ReactNode;label: string;onClick?: () => void;disabled?: boolean;badge?: string;}) {
  return (
    <button data-ev-id="ev_ec7c5a60d0"
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50">
      
			<span data-ev-id="ev_e486e4baaf" className="text-muted-foreground">{icon}</span>
			{label}
			{badge && <span data-ev-id="ev_7fc61fa593" className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{badge}</span>}
		</button>);

}

export function DawEditor() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { isEnabled } = useModules();
  const { pause: pauseGlobalPlayer, onGlobalPlay } = usePlayer();
  const [params, setParams] = useSearchParams();
  const engineRef = useRef<DawEngine | null>(null);
  if (engineRef.current === null) engineRef.current = new DawEngine();
  const engine = engineRef.current;

  const [project, setProject] = useState<DawProject>(() => newProject(t('Untitled project'), t('Audio 1'), t('Piano 1')));
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [pps, setPps] = useState(60);
  const [metronome, setMetronome] = useState(false);
  const [snapOn, setSnapOn] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [showProjects, setShowProjects] = useState(false);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(() => new Set());
  const [midiRecording, setMidiRecording] = useState(false);
  const [showMixer, setShowMixer] = useState(false);
  const [showRoll, setShowRoll] = useState(false);
  const [showSampler, setShowSampler] = useState(false);
  const [, forceRender] = useState(0);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const recorder = useRecorder();
  const recordStartRef = useRef(0);
  const heldRef = useRef(new Map<number, {start: number;velocity: number;}>());
  const recordedRef = useRef<MidiNote[]>([]);
  const importedRef = useRef<string | null>(null);

  const lanes = project.lanes;
  const master = project.master ?? DEFAULT_MASTER;
  const selectedLane = lanes.find((l) => l.id === selectedLaneId) ?? lanes[0] ?? null;
  const instrumentLane = selectedLane?.type === 'instrument' ? selectedLane : lanes.find((l) => l.type === 'instrument') ?? null;
  const instrumentRef = useRef<Lane | null>(instrumentLane);
  instrumentRef.current = instrumentLane;
  const rollTarget = useMemo((): {lane: Lane;clip: MidiClip;} | null => {
    for (const lane of lanes) {
      const clip = lane.clips.find((c) => c.id === selectedClipId);
      if (clip?.kind === 'midi') return { lane, clip };
    }
    const first = instrumentLane?.clips.find((c): c is MidiClip => c.kind === 'midi');
    return instrumentLane && first ? { lane: instrumentLane, clip: first } : null;
  }, [lanes, selectedClipId, instrumentLane]);
  const recordingAny = recorder.recording || midiRecording;
  const beat = 60 / project.bpm;
  const snap = snapOn ? beat / 4 : 0;
  const bar = beat * 4;
  const length = Math.max(projectEnd(lanes) + bar * 8, bar * 32);

  useEffect(() => () => engine.dispose(), [engine]);

  useEffect(() => {
    engine.updateMix(lanes);
  }, [engine, lanes]);

  useEffect(() => {
    engine.updateMaster(master);
  }, [engine, master]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = useCallback((fn: (p: DawProject) => DawProject) => {
    setProject(fn);
    setDirty(true);
  }, []);

  const patchLane = useCallback((id: string, patch: Partial<Lane>) => update((p) => ({ ...p, lanes: p.lanes.map((l) => l.id === id ? { ...l, ...patch } : l) })), [update]);

  const patchClip = useCallback(
    (laneId: string, clipId: string, patch: Partial<Clip>) =>
    update((p) => ({ ...p, lanes: p.lanes.map((l) => l.id === laneId ? { ...l, clips: l.clips.map((c) => c.id === clipId ? { ...c, ...patch } as Clip : c) } : l) })),
    [update]
  );

  const addClip = useCallback((laneId: string, clip: Clip) => update((p) => ({ ...p, lanes: p.lanes.map((l) => l.id === laneId ? { ...l, clips: [...l.clips, clip] } : l) })), [update]);

  const addLane = useCallback(
    (type: LaneType, name?: string): Lane => {
      const count = project.lanes.filter((l) => l.type === type).length + 1;
      const lane = newLane(type, project.lanes.length, name ?? (type === 'audio' ? t('Audio {n}', { n: count }) : t('Piano {n}', { n: count })));
      update((p) => ({ ...p, lanes: [...p.lanes, lane] }));
      setSelectedLaneId(lane.id);
      return lane;
    },
    [project.lanes, t, update]
  );

  const createMidiClip = useCallback(() => {
    const lane = instrumentRef.current;
    if (!lane) return;
    const barLen = 240 / project.bpm;
    const start = Math.floor(engine.getTime() / barLen) * barLen;
    const clip: MidiClip = { id: uid(), kind: 'midi', name: lane.name, start, duration: barLen * 4, notes: [] };
    addClip(lane.id, clip);
    setSelectedLaneId(lane.id);
    setSelectedClipId(clip.id);
  }, [addClip, engine, project.bpm]);

  const pauseGlobal = pauseGlobalPlayer;

  const startPlayback = useCallback(
    async (from: number) => {
      pauseGlobal();
      setPlaying(true);
      const started = await engine.play(project.lanes, from, metronome, project.bpm);
      if (started) pauseGlobal();
    },
    [engine, metronome, pauseGlobal, project.bpm, project.lanes]
  );

  const finishMidiRecording = useCallback(() => {
    const now = engine.getTime();
    heldRef.current.forEach((held, pitch) => recordedRef.current.push({ pitch, start: held.start, duration: Math.max(0.05, now - held.start), velocity: held.velocity }));
    heldRef.current.clear();
    const notes = recordedRef.current;
    recordedRef.current = [];
    setMidiRecording(false);
    const lane = instrumentRef.current;
    if (!lane || notes.length === 0) return;
    const start = Math.max(0, Math.min(...notes.map((n) => n.start)));
    const clipStart = snap > 0 ? Math.floor(start / snap) * snap : start;
    const end = Math.max(...notes.map((n) => n.start + n.duration));
    addClip(lane.id, {
      id: uid(),
      kind: 'midi',
      name: t('MIDI take'),
      start: clipStart,
      duration: Math.max(beat, end - clipStart),
      notes: notes.map((n) => ({ ...n, start: n.start - clipStart }))
    });
  }, [addClip, beat, engine, snap, t]);

  const finishAudioRecording = useCallback(async () => {
    const blob = await recorder.stop();
    const lane = selectedLane;
    if (!blob || !lane || lane.type !== 'audio' || !user) return;
    setBusy(true);
    try {
      const buffer = await engine.decodeFile(blob);
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `take.${ext}`, { type: blob.type });
      const { url, error } = await uploadMedia(user.id, file, 'daw');
      if (error || !url) throw new Error(error);
      engine.cache(url, buffer);
      addClip(lane.id, { id: uid(), kind: 'audio', name: t('Recording'), url, start: recordStartRef.current, offset: 0, duration: buffer.duration });
      setNotice({ text: t('Recording added') });
    } catch {
      setNotice({ text: t('Could not save the recording'), error: true });
    } finally {
      setBusy(false);
    }
  }, [addClip, engine, recorder, selectedLane, t, user]);

  const stopAll = useCallback(
    async (rewind: boolean) => {
      const pos = engine.pause();
      setPlaying(false);
      if (midiRecording) finishMidiRecording();
      if (recorder.recording) await finishAudioRecording();
      const next = rewind ? 0 : pos;
      engine.seek(next);
      setPosition(next);
    },
    [engine, finishAudioRecording, finishMidiRecording, midiRecording, recorder.recording]
  );

  const togglePlay = useCallback(() => {
    if (playing || recordingAny) void stopAll(false);else
    void startPlayback(position);
  }, [playing, position, recordingAny, startPlayback, stopAll]);

  // If the main player starts while the DAW is playing, stop the DAW so audio never doubles.
  useEffect(() => {
    if (!playing && !recordingAny) return;
    return onGlobalPlay(() => void stopAll(false));
  }, [onGlobalPlay, playing, recordingAny, stopAll]);

  const toggleRecord = useCallback(async () => {
    if (recordingAny) {
      await stopAll(false);
      return;
    }
    if (!selectedLane) return;
    if (selectedLane.type === 'audio') {
      const error = await recorder.start();
      if (error) {
        setNotice({ text: t(error), error: true });
        return;
      }
    } else {
      recordedRef.current = [];
      heldRef.current.clear();
      setMidiRecording(true);
    }
    recordStartRef.current = position;
    await startPlayback(position);
  }, [position, recorder, recordingAny, selectedLane, startPlayback, stopAll, t]);

  const seek = useCallback(
    (time: number) => {
      if (recordingAny) return;
      const target = snap > 0 ? Math.round(time / snap) * snap : time;
      setPosition(target);
      engine.seek(target);
      if (playing) void startPlayback(target);
    },
    [engine, playing, recordingAny, snap, startPlayback]
  );

  const noteOn = useCallback(
    (pitch: number, velocity: number) => {
      const lane = instrumentRef.current;
      if (!lane) return;
      engine.noteOn(lane, pitch, velocity);
      setActiveNotes((s) => new Set(s).add(pitch));
      if (midiRecording) heldRef.current.set(pitch, { start: engine.getTime(), velocity });
    },
    [engine, midiRecording]
  );

  const noteOff = useCallback(
    (pitch: number) => {
      const lane = instrumentRef.current;
      if (lane) engine.noteOff(lane.id, pitch);
      setActiveNotes((s) => {
        const next = new Set(s);
        next.delete(pitch);
        return next;
      });
      const held = heldRef.current.get(pitch);
      if (held) {
        heldRef.current.delete(pitch);
        recordedRef.current.push({ pitch, start: held.start, duration: Math.max(0.05, engine.getTime() - held.start), velocity: held.velocity });
      }
    },
    [engine]
  );

  const { octave, setOctave, midi } = useNoteInput(Boolean(instrumentLane), noteOn, noteOff);

  const deleteSelectedClip = useCallback(() => {
    if (!selectedClipId) return;
    update((p) => ({ ...p, lanes: p.lanes.map((l) => ({ ...l, clips: l.clips.filter((c) => c.id !== selectedClipId) })) }));
    setSelectedClipId(null);
  }, [selectedClipId, update]);

  const duplicateSelectedClip = useCallback(() => {
    if (!selectedClipId) return;
    update((p) => ({
      ...p,
      lanes: p.lanes.map((l) => {
        const clip = l.clips.find((c) => c.id === selectedClipId);
        return clip ? { ...l, clips: [...l.clips, { ...clip, id: uid(), start: clip.start + clip.duration } as Clip] } : l;
      })
    }));
  }, [selectedClipId, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedClip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelectedClip, togglePlay]);

  const importAudio = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !user) return;
      setBusy(true);
      setNotice({ text: t('Importing audio...') });
      let target = selectedLane?.type === 'audio' && selectedLane.clips.length === 0 ? selectedLane : null;
      let added = 0;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('audio/') || file.size > 50 * 1024 * 1024) continue;
        try {
          const buffer = await engine.decodeFile(file);
          const detectedBpm = estimateTempoBpm(buffer);
          if (detectedBpm && detectedBpm !== project.bpm) {
            update((p) => ({ ...p, bpm: detectedBpm }));
          }
          const { url, error } = await uploadMedia(user.id, file, 'daw');
          if (error || !url) continue;
          engine.cache(url, buffer);
          const name = file.name.replace(/\.[^.]+$/, '');
          const lane = target ?? addLane('audio', name.slice(0, 40));
          target = null;
          addClip(lane.id, { id: uid(), kind: 'audio', name, url, start: position, offset: 0, duration: buffer.duration });
          added += 1;
        } catch {

          /* skip unreadable file */}
      }
      setBusy(false);
      setNotice(added ? { text: t('{count} audio file(s) imported', { count: added }) } : { text: t('Could not import that file'), error: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addClip, addLane, engine, position, selectedLane, t, user]
  );

  // "Open in Studio" / "Open in DAW" from a song or audio URL.
  useEffect(() => {
    const trackId = params.get('track') || params.get('musicId');
    const directAudio = params.get('audio') || params.get('audioUrl');
    const paramTitle = params.get('title') || params.get('session');
    const paramBpm = params.get('bpm');

    const importKey = trackId ? `track:${trackId}` : directAudio ? `audio:${directAudio}` : null;
    if (!importKey || importedRef.current === importKey) return;
    importedRef.current = importKey;

    void (async () => {
      setBusy(true);
      let targetUrl: string | null = directAudio;
      let targetTitle = paramTitle || t('Audio track');

      if (trackId) {
        const track = await fetchTrack(trackId);
        if (track) {
          targetUrl = track.audio_url;
          targetTitle = track.title;
        }
      }

      const buffer = targetUrl ? await engine.load(targetUrl) : null;
      setBusy(false);
      setParams({}, { replace: true });
      if (!targetUrl || !buffer) {
        setNotice({ text: t('Could not load that song'), error: true });
        return;
      }

      const detectedBpm = paramBpm ? Number(paramBpm) : buffer ? estimateTempoBpm(buffer) : null;
      const lane = newLane('audio', 0, targetTitle.slice(0, 40));
      const clip: AudioClip = { id: uid(), kind: 'audio', name: targetTitle, url: targetUrl, start: 0, offset: 0, duration: buffer.duration };
      lane.clips = [clip];

      setProject({
        id: null,
        name: targetTitle.slice(0, 80),
        bpm: detectedBpm && Number.isFinite(detectedBpm) ? Math.round(detectedBpm) : 120,
        lanes: [lane, newLane('instrument', 1, t('Piano 1'))],
      });
      setSelectedLaneId(lane.id);
      setSelectedClipId(null);
      setPosition(0);
      setDirty(true);
      setNotice({ text: t('Song loaded into the DAW') });
    })();
  }, [engine, params, setParams, t]);

  // "Open in DAW" from a stem separation: one audio lane per stem, all aligned at 0.
  useEffect(() => {
    const jobId = params.get('stems');
    if (!jobId || importedRef.current === `stems:${jobId}`) return;
    importedRef.current = `stems:${jobId}`;
    void (async () => {
      setBusy(true);
      const job = await fetchStemJob(jobId);
      const entries = job && job.status === 'ready' ? sortedStems(job.stems ?? {}) : [];
      const loaded = await Promise.all(entries.map(async ([key, url]) => ({ key, url, buffer: await engine.load(url) })));
      setBusy(false);
      setParams({}, { replace: true });
      const ok = loaded.filter((s) => s.buffer);
      if (!job || ok.length === 0) {
        setNotice({ text: t('Could not load the stems'), error: true });
        return;
      }

      // Auto-detect project BPM from rhythm/drum/percussion stems
      let detectedBpm = 120;
      const rhythmBuffer = loaded.find((s) => s.key === 'drums' || s.key === 'percussion' || s.key === 'bass')?.buffer || ok[0]?.buffer;
      if (rhythmBuffer) {
        const est = estimateTempoBpm(rhythmBuffer);
        if (est && est >= 60 && est <= 220) detectedBpm = est;
      }

      const STEM_COLORS: Record<string, string> = {
        vocal: '#00f2fe',
        backingVocals: '#38bdf8',
        guitar: '#f59e0b',
        bass: '#8b5cf6',
        drums: '#ef4444',
        percussion: '#f97316',
        keyboard: '#10b981',
        piano: '#10b981',
        strings: '#a855f7',
        instrumental: '#06b6d4',
        fx: '#ec4899',
      };

      const stemLanes = ok.map(({ key, url, buffer }, i) => {
        const name = t(STEM_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1));
        const lane = newLane('audio', i, name.slice(0, 40));
        if (STEM_COLORS[key]) lane.color = STEM_COLORS[key];

        // Tailored EQAMUZ hardware FX insert for each stem
        if (key === 'vocal') {
          lane.fx = [newFx('vocal', uid())];
        } else if (key === 'guitar') {
          lane.fx = [newFx('lead', uid())];
        } else if (key === 'drums' || key === 'percussion') {
          lane.fx = [newFx('comp', uid())];
        } else if (key === 'bass') {
          lane.fx = [newFx('saturation', uid())];
        }

        lane.clips = [{ id: uid(), kind: 'audio', name, url, start: 0, offset: 0, duration: buffer!.duration } as AudioClip];
        return lane;
      });

      setProject({ id: null, name: t('{title} — stems', { title: job.title }).slice(0, 120), bpm: detectedBpm, lanes: stemLanes });
      setSelectedLaneId(stemLanes[0].id);
      setSelectedClipId(null);
      setPosition(0);
      setDirty(true);
      setNotice({ text: t('{count} stems loaded into the DAW', { count: ok.length }) });
    })();
  }, [engine, params, setParams, t]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const { id, error } = await saveProject(user.id, project);
    setSaving(false);
    if (error || !id) {
      setNotice({ text: t('Could not save the project'), error: true });
      return;
    }
    setProject((p) => ({ ...p, id }));
    setDirty(false);
    setNotice({ text: t('Project saved') });
  }

  async function openProject(id: string) {
    setShowProjects(false);
    if (dirty && !window.confirm(t('Discard unsaved changes?'))) return;
    await stopAll(true);
    setBusy(true);
    const loaded = await loadProject(id);
    if (loaded) {
      await engine.loadAll(loaded.lanes);
      setProject(loaded);
      setSelectedLaneId(loaded.lanes[0]?.id ?? null);
      setSelectedClipId(null);
      setDirty(false);
      forceRender((n) => n + 1);
    } else {
      setNotice({ text: t('Could not open the project'), error: true });
    }
    setBusy(false);
  }

  async function startNew() {
    if (dirty && !window.confirm(t('Discard unsaved changes?'))) return;
    await stopAll(true);
    const fresh = newProject(t('Untitled project'), t('Audio 1'), t('Piano 1'));
    setProject(fresh);
    setSelectedLaneId(fresh.lanes[0].id);
    setSelectedClipId(null);
    setDirty(false);
  }

  async function handleExport() {
    if (projectEnd(project.lanes) <= 0) {
      setNotice({ text: t('Add some audio or notes first'), error: true });
      return;
    }
    setBusy(true);
    setNotice({ text: t('Rendering your mix...') });
    try {
      const rendered = await engine.render(project.lanes, master);
      if (!rendered) throw new Error('empty');
      const url = URL.createObjectURL(encodeWav(rendered));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'qamuz-project'}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setNotice({ text: t('Mix exported') });
    } catch {
      setNotice({ text: t('Could not export the mix'), error: true });
    } finally {
      setBusy(false);
    }
  }

  function deleteLane(id: string) {
    update((p) => ({ ...p, lanes: p.lanes.filter((l) => l.id !== id) }));
    if (selectedLaneId === id) setSelectedLaneId(null);
  }

  const midiLabel = useMemo(() => {
    if (midi.status === 'connected') return t('MIDI: {device}', { device: midi.device });
    if (midi.status === 'unsupported') return t('MIDI not supported in this browser');
    if (midi.status === 'blocked') return t('MIDI access blocked');
    return t('Connect a MIDI keyboard to play');
  }, [midi, t]);

  return (
    <div data-ev-id="ev_ba2e2ccbd1" className="flex flex-col gap-4">
			<div data-ev-id="ev_4f084ebd0f" className="flex flex-wrap items-center gap-3">
				<input data-ev-id="ev_42d999d2f8"
        value={project.name}
        onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
        aria-label={t('Project name')}
        className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-2xl font-black tracking-tight text-balance hover:bg-surface focus:bg-surface focus:outline-none md:text-3xl" />
        
				{dirty && <span data-ev-id="ev_3f77bf5597" className="text-xs font-semibold text-muted-foreground">{t('Unsaved changes')}</span>}
				<div data-ev-id="ev_030fe84298" className="flex flex-wrap items-center gap-2">
					<ToolButton icon={<FilePlus2 className="h-4 w-4" />} label={t('New')} onClick={() => void startNew()} />
					<ToolButton icon={<FolderOpen className="h-4 w-4" />} label={t('Open')} onClick={() => setShowProjects(true)} />
					<button data-ev-id="ev_efa28429f5"
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
            
						<Save className="h-4 w-4" />
						{saving ? t('Saving...') : t('Save')}
					</button>
				</div>
			</div>

			<Transport
        engine={engine}
        playing={playing}
        recording={recordingAny}
        position={position}
        bpm={project.bpm}
        metronome={metronome}
        snap={snapOn}
        onPlay={togglePlay}
        onStop={() => void stopAll(true)}
        onRecord={() => void toggleRecord()}
        onMetronome={() => {
          engine.setMetronome(!metronome, project.bpm);
          setMetronome(!metronome);
        }}
        onSnap={() => setSnapOn((s) => !s)}
        onBpm={(bpm) => {
          update((p) => ({ ...p, bpm }));
          engine.setMetronome(metronome, bpm);
        }}
        onZoom={(f) => setPps((v) => Math.min(400, Math.max(10, v * f)))} />
      

			<div data-ev-id="ev_86634111db" className="flex flex-wrap items-center gap-2">
				<ToolButton icon={<Upload className="h-4 w-4" />} label={t('Import audio')} onClick={() => fileInput.current?.click()} disabled={busy || recordingAny} />
				<ToolButton icon={<AudioWaveform className="h-4 w-4" />} label={t('Audio track')} onClick={() => addLane('audio')} disabled={recordingAny} />
				<ToolButton icon={<Piano className="h-4 w-4" />} label={t('Instrument track')} onClick={() => addLane('instrument')} disabled={recordingAny} />
				<ToolButton icon={<Disc3 className="h-4 w-4 text-cyan-400" />} label="Qamuz Sampler" onClick={() => setShowSampler(true)} badge="LATINO" />
				<span data-ev-id="ev_79a0dbe534" className="mx-1 hidden h-6 w-px bg-border sm:block" />
				<ToolButton icon={<Copy className="h-4 w-4" />} label={t('Duplicate')} onClick={duplicateSelectedClip} disabled={!selectedClipId} />
				<ToolButton icon={<Trash2 className="h-4 w-4" />} label={t('Delete clip')} onClick={deleteSelectedClip} disabled={!selectedClipId} />
				<div data-ev-id="ev_96b66f38ab" className="ml-auto flex flex-wrap items-center gap-2">
          {([['roll', Piano, t('Piano roll'), showRoll, setShowRoll], ['mixer', SlidersVertical, t('Mixer'), showMixer, setShowMixer]] as const).map(([id, Icon, label, on, set]) =>
          <button data-ev-id="ev_99085e6858"
          key={id}
          type="button"
          aria-pressed={on}
          onClick={() => set(!on)}
          className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface-2 text-foreground hover:bg-surface-3'}`}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          )}
					{isEnabled('mastering') && <ToolButton icon={<Sparkles className="h-4 w-4" />} label={t('Mastering')} onClick={() => navigate('/mastering')} />}
					<ToolButton icon={<Download className="h-4 w-4" />} label={t('Export WAV')} onClick={() => void handleExport()} disabled={busy} />
				</div>
				<input data-ev-id="ev_92b624afbd"
        ref={fileInput}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void importAudio(e.target.files);
          e.target.value = '';
        }} />
        
			</div>

      <div data-ev-id="ev_6cf1d70a2b" className="flex overflow-hidden rounded-xl border border-border bg-surface">
				<div data-ev-id="ev_27f5c08261" className="w-40 flex-none border-r border-border sm:w-52">
					<div data-ev-id="ev_4193f88b31" className="flex items-center border-b border-border bg-surface-2 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground" style={{ height: RULER_H }}>
						{t('Tracks')}
					</div>
					{lanes.map((lane) =>
          <LaneHeader
            key={lane.id}
            lane={lane}
            selected={lane.id === selectedLane?.id}
            onSelect={() => !recordingAny && setSelectedLaneId(lane.id)}
            onPatch={(patch) => patchLane(lane.id, patch)}
            onDelete={() => deleteLane(lane.id)} />

          )}
				</div>
				{lanes.length === 0 ?
        <div data-ev-id="ev_74a2ce24bd" className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center" style={{ minHeight: ROW_H * 2 + RULER_H }}>
						<Music4 className="h-8 w-8 text-muted-foreground" />
						<p data-ev-id="ev_30b690b3fc" className="text-sm text-muted-foreground">{t('Add an audio or instrument track to start.')}</p>
					</div> :

        <Timeline
          lanes={lanes}
          pps={pps}
          bpm={project.bpm}
          length={length}
          snap={snap}
          engine={engine}
          playing={playing}
          position={position}
          selectedLaneId={selectedLane?.id ?? null}
          selectedClipId={selectedClipId}
          onSeek={seek}
          onSelectLane={(id) => !recordingAny && setSelectedLaneId(id)}
          onSelectClip={setSelectedClipId}
          onPatchClip={patchClip} />

        }
			</div>

      {showRoll &&
      <FloatingPanel
        title={t('Piano roll')}
        icon={<Piano className="h-4 w-4" />}
        onClose={() => setShowRoll(false)}
        actions={<span data-ev-id="ev_344d680f1d" className={`text-xs ${midi.status === 'connected' ? 'text-primary' : 'text-muted-foreground'}`}>{midiLabel}</span>}>
          <PianoRoll
          clip={rollTarget?.clip ?? null}
          color={rollTarget?.lane.color ?? instrumentLane?.color ?? '#c8f73c'}
          bpm={project.bpm}
          snap={snap}
          engine={engine}
          activeNotes={activeNotes}
          canCreate={Boolean(instrumentLane)}
          onCreate={createMidiClip}
          onChange={(patch) => rollTarget && patchClip(rollTarget.lane.id, rollTarget.clip.id, patch)}
          onKeyDown={(p) => noteOn(p, 0.8)}
          onKeyUp={noteOff}
          extra={
          <div data-ev-id="ev_bf8ea45324" className="flex items-center gap-1 rounded-lg bg-background p-0.5 text-xs">
                <button data-ev-id="ev_57b0a12cc9" type="button" onClick={() => setOctave(Math.max(1, octave - 1))} aria-label={t('Octave down')} className="h-7 w-7 rounded font-bold text-muted-foreground hover:bg-surface-3 hover:text-foreground">−</button>
                <span data-ev-id="ev_236c521687" className="px-1 font-semibold tabular-nums">{t('Octave {n}', { n: octave })}</span>
                <button data-ev-id="ev_35a973fe2a" type="button" onClick={() => setOctave(Math.min(7, octave + 1))} aria-label={t('Octave up')} className="h-7 w-7 rounded font-bold text-muted-foreground hover:bg-surface-3 hover:text-foreground">+</button>
              </div>
          } />
        </FloatingPanel>
      }

      {showMixer &&
      <FloatingPanel title={t('Mixer')} icon={<SlidersVertical className="h-4 w-4" />} onClose={() => setShowMixer(false)}>
          <Mixer
          lanes={lanes}
          master={master}
          engine={engine}
          selectedLaneId={selectedLane?.id ?? null}
          onSelectLane={(id) => !recordingAny && setSelectedLaneId(id)}
          onPatchLane={patchLane}
          onMaster={(m) => update((p) => ({ ...p, master: m }))} />
        </FloatingPanel>
      }


      {showSampler && (
        <QamuzSamplerModal
          onClose={() => setShowSampler(false)}
          onTriggerMidiNote={(pitch, velocity) => {
            if (midiRecording && rollTarget) {
              const start = Math.max(0, position - recordStartRef.current);
              recordedRef.current.push({ pitch, start, duration: 0.25, velocity });
            }
          }}
        />
      )}

			{showProjects && user &&
      <ProjectsDialog
        userId={user.id}
        currentId={project.id}
        onOpen={(id) => void openProject(id)}
        onDeleted={(id) => id === project.id && setProject((p) => ({ ...p, id: null }))}
        onClose={() => setShowProjects(false)} />

      }

			{notice &&
      <div data-ev-id="ev_cd89d47da2" role="status" className={`fixed bottom-32 left-1/2 z-[90] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-xl ${notice.error ? 'bg-destructive text-destructive-foreground' : 'bg-foreground text-background'}`}>
					{notice.text}
				</div>
      }
		</div>);

}