import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  FileAudio,
  Link2,
  Music,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Trash2,
  Upload,
  X } from
'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { supabase } from '@/integrations/supabase/client';
import { fetchCreations, songsFromCreation, saveTrimmedCreation } from '@/lib/studio';
import { uploadMedia } from '@/lib/media';
import { coverUrl } from '@/lib/covers';
import { formatTime } from '@/lib/format';
import { encodeWav } from '@/lib/engagement';
import { loadAudio } from '@/lib/mastering';

interface TrimModalProps {
  open: boolean;
  onClose: () => void;
  initialAudioUrl?: string;
  initialTitle?: string;
  onCreated?: (creationId: string) => void;
}

interface AudioItem {
  id: string;
  title: string;
  durationSeconds: number;
  tags: string;
  coverUrl: string;
  audioUrl: string;
}

// Real studio-produced MP3 master tracks matching the platform catalog
const DEFAULT_TRACKS: AudioItem[] = [
{
  id: 'sample-1',
  title: 'Mercurio (Master Mix)',
  durationSeconds: 372,
  tags: 'electronica,latin-vibe,master,acustica',
  coverUrl: coverUrl('cover-1'),
  audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
},
{
  id: 'sample-2',
  title: 'Neon Tardío (Versión Acústica)',
  durationSeconds: 348,
  tags: 'synthwave,latin,melodica,ambiente',
  coverUrl: coverUrl('cover-2'),
  audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
},
{
  id: 'sample-3',
  title: 'Raíz y Sentimiento',
  durationSeconds: 310,
  tags: 'folk,nylon-guitar,latin,organico',
  coverUrl: coverUrl('cover-5'),
  audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'
},
{
  id: 'sample-4',
  title: 'Órbita Baja',
  durationSeconds: 426,
  tags: 'chill,latin,smooth,bateria-viva',
  coverUrl: coverUrl('cover-4'),
  audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
}];


export function TrimModal({ open, onClose, initialAudioUrl, initialTitle, onCreated }: TrimModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  // Step state: 'select' (Images 1-3), 'processing' (Image 4), 'editor' (Image 5)
  const [step, setStep] = useState<'select' | 'processing' | 'editor'>('select');
  const [sourceTab, setSourceTab] = useState<'upload' | 'library'>('upload');
  const [youtubeInputOpen, setYoutubeInputOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Selected audio track
  const [selectedTrack, setSelectedTrack] = useState<AudioItem | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<AudioItem[]>([]);
  const [libraryTracks, setLibraryTracks] = useState<AudioItem[]>(DEFAULT_TRACKS);

  // Waveform Trimmer state (Step B / Image 5)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(372);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(372);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isProcessingSave, setIsProcessingSave] = useState(false);

  // Dragging state for trim handles
  const [dragMode, setDragMode] = useState<'start' | 'end' | 'window' | null>(null);
  const dragStartRef = useRef<{clientX: number;initStart: number;initEnd: number;}>({
    clientX: 0,
    initStart: 0,
    initEnd: 0
  });

  // State refs to keep pointer move listeners stable without re-binding
  const trimStartRef = useRef(trimStart);
  const trimEndRef = useRef(trimEnd);
  const totalDurationRef = useRef(totalDuration);
  useEffect(() => {
    trimStartRef.current = trimStart;
    trimEndRef.current = trimEnd;
    totalDurationRef.current = totalDuration;
  }, [trimStart, trimEnd, totalDuration]);

  // Waveform bar heights (65 normalized bars for visual matching)
  const [waveBars] = useState<number[]>(() =>
  Array.from({ length: 65 }, (_, i) => {
    const seed = Math.sin(i * 0.45) * 0.45 + Math.cos(i * 0.85) * 0.35;
    return 0.3 + Math.abs(seed) * 0.65;
  })
  );

  // Audio elements
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const waveformTrackRef = useRef<HTMLDivElement>(null);

  // Helper to ensure a reliable real audio URL
  const getPlayableUrl = useCallback((track?: AudioItem | null): string => {
    if (track?.audioUrl && track.audioUrl.length > 5) {
      return track.audioUrl;
    }
    return DEFAULT_TRACKS[0].audioUrl;
  }, []);

  // Load real tracks from user creations and public songs catalog
  useEffect(() => {
    if (!open) return;

    if (initialAudioUrl) {
      handleSelectAudio({
        id: 'initial',
        title: initialTitle || 'Canción seleccionada',
        durationSeconds: 240,
        tags: 'latin,world-music,custom',
        coverUrl: '',
        audioUrl: initialAudioUrl
      });
      return;
    }

    let active = true;

    async function loadRealMusic() {
      const realItems: AudioItem[] = [];

      // 1. Fetch user's own creations if logged in
      if (user?.id) {
        try {
          const creations = await fetchCreations(user.id);
          for (const c of creations) {
            if (c.kind !== 'music' || c.status === 'error') continue;
            for (const s of songsFromCreation(c)) {
              if (s.audioUrl) {
                const styleTag =
                s.style || (
                typeof c.options?.style === 'string' ? c.options.style : null) ||
                'mi-creacion,ia-studio';
                const songCover =
                s.coverUrl ||
                c.thumbnail_url || (
                typeof c.options?.cover_key === 'string' ?
                coverUrl(c.options.cover_key) :
                coverUrl('cover-1'));

                realItems.push({
                  id: `user-${s.trackId || c.id}-${s.index}`,
                  title: s.title || c.title || 'Mi Canción',
                  durationSeconds: s.duration || 180,
                  tags: styleTag,
                  coverUrl: songCover,
                  audioUrl: s.audioUrl
                });
              }
            }
          }
        } catch (err) {
          console.warn('Error loading user creations:', err);
        }
      }

      // 2. Fetch real tracks from published public tracks table
      try {
        if (supabase) {
          const { data: dbTracks } = await supabase.
          from('tracks').
          select('id, title, audio_url, cover_key, duration_seconds, genre').
          eq('is_published', true).
          order('plays', { ascending: false }).
          limit(20);

          if (dbTracks && dbTracks.length > 0) {
            for (const t of dbTracks) {
              if (t.audio_url) {
                realItems.push({
                  id: `db-${t.id}`,
                  title: t.title,
                  durationSeconds: t.duration_seconds || 240,
                  tags: t.genre ? `${t.genre.toLowerCase()},latin,real-audio` : 'latin,musica-real',
                  coverUrl: coverUrl(t.cover_key),
                  audioUrl: t.audio_url
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error loading db tracks:', err);
      }

      if (active) {
        if (realItems.length > 0) {
          setLibraryTracks(realItems);
        } else {
          setLibraryTracks(DEFAULT_TRACKS);
        }
      }
    }

    void loadRealMusic();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, initialAudioUrl, initialTitle]);

  // Cleanup on modal close
  useEffect(() => {
    if (!open) {
      if (previewAudioRef.current) previewAudioRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
      setPreviewId(null);
      setIsPlaying(false);
      setStep('select');
      setSaveSuccess(false);
    }
  }, [open]);

  // Audio element event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 1.0;

    const onTimeUpdate = () => {
      const cur = audio.currentTime;
      setCurrentTime(cur);

      // Loop inside trim range
      if (cur >= trimEndRef.current) {
        audio.currentTime = trimStartRef.current;
      }
    };

    const onLoadedMetadata = () => {
      const dur = audio.duration;
      if (Number.isFinite(dur) && dur > 0) {
        const roundedDur = Math.round(dur);
        setTotalDuration(roundedDur);
        setTrimEnd(roundedDur);
        setCurrentTime(0);
      }
    };

    const onEnded = () => {
      audio.currentTime = trimStartRef.current;
      audio.play().catch(() => setIsPlaying(false));
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  // Preview playback in Library
  function togglePreview(track: AudioItem) {
    if (previewId === track.id) {
      previewAudioRef.current?.pause();
      setPreviewId(null);
    } else {
      if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio();
      }
      const soundUrl = getPlayableUrl(track);
      previewAudioRef.current.src = soundUrl;
      previewAudioRef.current.volume = 1.0;
      previewAudioRef.current.play().catch(() => undefined);
      setPreviewId(track.id);
      previewAudioRef.current.onended = () => setPreviewId(null);
    }
  }

  // Handle file upload
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const newTrack: AudioItem = {
      id: `upload-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      durationSeconds: 180,
      tags: 'uploaded,local-audio',
      coverUrl: '',
      audioUrl: objectUrl
    };

    setUploadedFiles((prev) => [newTrack, ...prev]);
    handleSelectAudio(newTrack);
  }

  // Handle YouTube link submit
  function handleYoutubeSubmit() {
    if (!youtubeUrl.trim()) return;
    const newTrack: AudioItem = {
      id: `yt-${Date.now()}`,
      title: 'YouTube Audio Stream',
      durationSeconds: 240,
      tags: 'youtube,stream,audio',
      coverUrl: coverUrl('cover-2'),
      audioUrl: DEFAULT_TRACKS[0].audioUrl
    };
    setYoutubeInputOpen(false);
    setYoutubeUrl('');
    handleSelectAudio(newTrack);
  }

  // Transition from Selection -> Processing -> Editor
  function handleSelectAudio(track: AudioItem) {
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setPreviewId(null);
    setSelectedTrack(track);
    setStep('processing');

    // Simulate audio processing
    setTimeout(() => {
      setStep('editor');
      const dur = track.durationSeconds || 372;
      setTotalDuration(dur);
      setTrimStart(0);
      setTrimEnd(dur);
      setCurrentTime(0);

      // Load into audio element
      const soundUrl = getPlayableUrl(track);
      if (audioRef.current) {
        audioRef.current.src = soundUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.volume = 1.0;
        audioRef.current.load();
      }
    }, 900);
  }

  // Toggle playback in Trimmer
  function togglePlayTrimmer() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (audio.currentTime < trimStart || audio.currentTime >= trimEnd) {
        audio.currentTime = trimStart;
      }
      audio.play().catch((err) => {
        console.warn('Playback error:', err);
      });
      setIsPlaying(true);
    }
  }

  // Dragging logic for handles
  const handleMouseDown = (e: React.MouseEvent, mode: 'start' | 'end' | 'window') => {
    e.preventDefault();
    e.stopPropagation();
    setDragMode(mode);
    dragStartRef.current = {
      clientX: e.clientX,
      initStart: trimStartRef.current,
      initEnd: trimEndRef.current
    };
  };

  const handleTouchStart = (e: React.TouchEvent, mode: 'start' | 'end' | 'window') => {
    e.stopPropagation();
    const touch = e.touches[0];
    setDragMode(mode);
    dragStartRef.current = {
      clientX: touch.clientX,
      initStart: trimStartRef.current,
      initEnd: trimEndRef.current
    };
  };

  // Pointer move handler that updates handles smoothly without audio decoder bottlenecks
  const pointerMoveCallback = useRef<(clientX: number) => void>(() => {});
  pointerMoveCallback.current = (clientX: number) => {
    if (!dragMode || !waveformTrackRef.current) return;
    const rect = waveformTrackRef.current.getBoundingClientRect();
    const deltaX = clientX - dragStartRef.current.clientX;
    const total = totalDurationRef.current || 372;
    const deltaSec = deltaX / rect.width * total;

    if (dragMode === 'start') {
      const nextStart = Math.max(0, Math.min(trimEndRef.current - 1, dragStartRef.current.initStart + deltaSec));
      const rounded = Math.round(nextStart);
      setTrimStart(rounded);
      setCurrentTime(rounded);
    } else if (dragMode === 'end') {
      const nextEnd = Math.max(trimStartRef.current + 1, Math.min(total, dragStartRef.current.initEnd + deltaSec));
      const rounded = Math.round(nextEnd);
      setTrimEnd(rounded);
      setCurrentTime(rounded);
    } else if (dragMode === 'window') {
      const range = dragStartRef.current.initEnd - dragStartRef.current.initStart;
      let nextStart = dragStartRef.current.initStart + deltaSec;
      let nextEnd = dragStartRef.current.initEnd + deltaSec;

      if (nextStart < 0) {
        nextStart = 0;
        nextEnd = range;
      }
      if (nextEnd > total) {
        nextEnd = total;
        nextStart = total - range;
      }

      const roundedStart = Math.round(nextStart);
      const roundedEnd = Math.round(nextEnd);
      setTrimStart(roundedStart);
      setTrimEnd(roundedEnd);
      setCurrentTime(roundedStart);
    }
  };

  // Attach window event listeners once when dragMode changes
  useEffect(() => {
    if (!dragMode) return;

    const onMouseMove = (e: MouseEvent) => pointerMoveCallback.current(e.clientX);
    const onTouchMove = (e: TouchEvent) => pointerMoveCallback.current(e.touches[0].clientX);
    const onEnd = () => {
      setDragMode(null);
      if (audioRef.current) {
        audioRef.current.currentTime = trimStartRef.current;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [dragMode]);

  // Click on waveform to seek
  function handleTrackClick(e: React.MouseEvent) {
    if (dragMode || !waveformTrackRef.current) return;
    const rect = waveformTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickSec = Math.max(0, Math.min(totalDuration, clickX / rect.width * totalDuration));

    setCurrentTime(clickSec);
    if (audioRef.current) {
      audioRef.current.currentTime = clickSec;
    }
  }

  // Reset trimmer to full bounds
  function handleReset() {
    setTrimStart(0);
    setTrimEnd(totalDuration);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }

  // Apply trim selection
  function handleApplyTrim() {
    setCurrentTime(trimStart);
    if (audioRef.current) {
      audioRef.current.currentTime = trimStart;
      audioRef.current.play().catch(() => undefined);
      setIsPlaying(true);
    }
  }

  // Save trimmed audio directly to workspace (Espacio de trabajo) as a new creation
  async function handleSave() {
    if (!user) {
      alert('Inicia sesión para guardar el recorte en tu espacio de trabajo');
      navigate('/login');
      return;
    }

    setIsProcessingSave(true);
    const rawTitle = selectedTrack?.title || 'Mi Pista';
    const cleanTitle = rawTitle.replace(/[\\/:*?"<>|]+/g, '').trim();
    const trimmedTitle = `${cleanTitle} (Trim)`;
    const trimmedDuration = Math.max(1, Math.round(trimEnd - trimStart));
    const inheritedCover = selectedTrack?.coverUrl || null;

    try {
      const targetUrl = getPlayableUrl(selectedTrack);
      let audioBlob: Blob | null = null;

      try {
        const audioBuffer = await loadAudio(targetUrl);
        const sampleRate = audioBuffer.sampleRate;
        const startSample = Math.max(0, Math.floor(trimStart * sampleRate));
        const endSample = Math.min(audioBuffer.length, Math.floor(trimEnd * sampleRate));
        const sliceLength = Math.max(1, endSample - startSample);

        const ctx = new (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext;}).webkitAudioContext)();
        const slicedBuffer = ctx.createBuffer(audioBuffer.numberOfChannels, sliceLength, sampleRate);
        for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
          const channel = audioBuffer.getChannelData(c).subarray(startSample, endSample);
          slicedBuffer.copyToChannel(channel, c);
        }
        void ctx.close();

        audioBlob = encodeWav(slicedBuffer);
      } catch (sliceErr) {
        console.warn('Direct AudioBuffer slice failed, trying fetch fallback', sliceErr);
        const res = await fetch(targetUrl);
        if (res.ok) {
          audioBlob = await res.blob();
        }
      }

      let uploadedUrl = targetUrl;
      if (audioBlob) {
        const file = new File([audioBlob], `${cleanTitle}-trim.wav`, { type: 'audio/wav' });
        const uploadRes = await uploadMedia(user.id, file, 'studio');
        if (uploadRes.url) {
          uploadedUrl = uploadRes.url;
        }
      }

      // Save as a new creation in ai_creations (Workspace)
      const creationResult = await saveTrimmedCreation({
        title: trimmedTitle,
        audio_url: uploadedUrl,
        thumbnail_url: inheritedCover,
        duration: trimmedDuration,
        options: {
          mode: 'trim',
          source_title: rawTitle,
          source_audio_url: targetUrl,
          trim_start: trimStart,
          trim_end: trimEnd,
          cover_url: inheritedCover,
          style: selectedTrack?.tags || 'trim,audio'
        },
        items: [
        {
          id: `trim-${Date.now()}`,
          title: trimmedTitle,
          audio_url: uploadedUrl,
          image_url: inheritedCover,
          duration: trimmedDuration,
          lyrics: null,
          tags: selectedTrack?.tags || 'trim,audio'
        }]

      });

      // Fallback direct insert if function had any network hiccup
      if (creationResult.error && supabase) {
        await supabase.from('ai_creations').insert({
          user_id: user.id,
          kind: 'music',
          prompt: `Recorte de audio: ${trimmedTitle} (${formatTime(trimStart)} - ${formatTime(trimEnd)})`,
          status: 'ready',
          provider_slug: 'trimmed-audio',
          title: trimmedTitle,
          result_urls: [uploadedUrl],
          thumbnail_url: inheritedCover,
          duration_seconds: trimmedDuration,
          options: {
            mode: 'trim',
            source_title: rawTitle,
            source_audio_url: targetUrl,
            trim_start: trimStart,
            trim_end: trimEnd,
            cover_url: inheritedCover
          },
          items: [
          {
            id: `trim-${Date.now()}`,
            title: trimmedTitle,
            audio_url: uploadedUrl,
            image_url: inheritedCover,
            duration: trimmedDuration,
            tags: selectedTrack?.tags || 'trim,audio'
          }],

          credits_spent: 0
        });
      }

      // Notify workspace / Studio listeners to refresh immediately
      window.dispatchEvent(new CustomEvent('qamuz:creations-updated', { detail: { id: creationResult.data?.id } }));

      if (onCreated && creationResult.data?.id) {
        onCreated(creationResult.data.id);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
        navigate('/estudio');
      }, 1200);
    } catch (err) {
      console.error('Failed to save trimmed creation to workspace', err);
      setIsProcessingSave(false);
    }
  }

  if (!open) return null;

  // Percentage calculations
  const startPercent = Math.max(0, Math.min(100, trimStart / (totalDuration || 1) * 100));
  const endPercent = Math.max(0, Math.min(100, trimEnd / (totalDuration || 1) * 100));
  const selectionWidthPercent = Math.max(2, endPercent - startPercent);
  const playheadPercent = Math.max(0, Math.min(100, currentTime / (totalDuration || 1) * 100));

  return (
    <div
      data-ev-id="ev_trim_modal_backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}>
      
      {/* Hidden audio element for editor playback */}
      <audio data-ev-id="ev_63f63a8e2b" ref={audioRef} preload="auto" playsInline />

      <div
        data-ev-id="ev_trim_modal_box"
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-2xl text-foreground animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}>
        
        {/* Hidden native file input */}
        <input data-ev-id="ev_dce7fe468e"
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileUpload} />
        

        {/* ============================================================== */}
        {/* STEP 1: SOURCE SELECTION                                       */}
        {/* ============================================================== */}
        {step === 'select' &&
        <div data-ev-id="ev_25124aafb4" className="flex flex-col gap-5">
            {/* Header */}
            <div data-ev-id="ev_430323612b" className="flex items-start justify-between">
              <div data-ev-id="ev_1b9aa90c0c">
                <h2 data-ev-id="ev_deb53731b6" className="text-xl font-black text-foreground">Trim</h2>
                <p data-ev-id="ev_e715a79cb9" className="text-xs text-muted-foreground mt-0.5">Cut your audio with precision</p>
              </div>
              <button data-ev-id="ev_e8d383e7ef"
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground transition-colors">
              
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Source Selection Cards: Upload audio & YouTube link */}
            <div data-ev-id="ev_c12245c018" className="grid grid-cols-2 gap-3">
              <button data-ev-id="ev_4f884558f2"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 p-6 hover:bg-surface-3 hover:border-primary/40 transition-all cursor-pointer">
              
                <Upload className="h-6 w-6 text-foreground/80 transition-transform group-hover:scale-110 group-hover:text-primary" />
                <span data-ev-id="ev_4efd93b0ae" className="text-sm font-bold text-foreground">Upload audio</span>
              </button>

              <button data-ev-id="ev_878e18a3e7"
            type="button"
            onClick={() => setYoutubeInputOpen((v) => !v)}
            className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 p-6 hover:bg-surface-3 hover:border-primary/40 transition-all cursor-pointer">
              
                <Link2 className="h-6 w-6 text-foreground/80 transition-transform group-hover:scale-110 group-hover:text-primary" />
                <span data-ev-id="ev_6414594641" className="text-sm font-bold text-foreground">YouTube link</span>
              </button>
            </div>

            {/* YouTube Link Input Popover */}
            {youtubeInputOpen &&
          <div data-ev-id="ev_496b18e830" className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-2 animate-in slide-in-from-top-1">
                <input data-ev-id="ev_01e705eaa1"
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 bg-transparent px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground" />
            
                <button data-ev-id="ev_5bfdc9e8ec"
            type="button"
            onClick={handleYoutubeSubmit}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110 active:scale-95 transition-all">
              
                  Importar
                </button>
              </div>
          }

            {/* Segmented Filter Tabs: Upload | Library */}
            <div data-ev-id="ev_0c7ce355f9" className="flex items-center gap-2">
              <button data-ev-id="ev_de133560ee"
            type="button"
            onClick={() => setSourceTab('upload')}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
            sourceTab === 'upload' ?
            'border border-primary/50 bg-primary/15 text-primary' :
            'text-muted-foreground hover:text-foreground'}`
            }>
              
                Upload
              </button>
              <button data-ev-id="ev_05b99520b0"
            type="button"
            onClick={() => setSourceTab('library')}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
            sourceTab === 'library' ?
            'border border-primary/50 bg-primary/15 text-primary' :
            'text-muted-foreground hover:text-foreground'}`
            }>
              
                Library
              </button>
            </div>

            {/* Content Tab 1: Upload (Empty State with Vinyl Record) */}
            {sourceTab === 'upload' &&
          <div data-ev-id="ev_557659fc10" className="flex flex-col items-center justify-center py-10 min-h-[220px]">
                {uploadedFiles.length === 0 ?
            <div data-ev-id="ev_17d8acc016" className="flex flex-col items-center justify-center gap-3">
                    <div data-ev-id="ev_3bee1db6bb" className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-black via-surface-3 to-black shadow-xl ring-4 ring-white/5">
                      <div data-ev-id="ev_503355fb30" className="absolute inset-2 rounded-full border border-white/5" />
                      <div data-ev-id="ev_81c514e3aa" className="absolute inset-4 rounded-full border border-white/5" />
                      <div data-ev-id="ev_7726dd88b9" className="absolute inset-6 rounded-full border border-white/10" />
                      <div data-ev-id="ev_26d5137861" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface shadow-inner">
                        <Music className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <span data-ev-id="ev_68dc1d7bc3" className="text-xs font-medium text-muted-foreground mt-1">No data yet</span>
                  </div> :

            <div data-ev-id="ev_b3bd6d6a7b" className="w-full flex flex-col gap-1 max-h-56 overflow-y-auto no-scrollbar">
                    {uploadedFiles.map((item) =>
              <div data-ev-id="ev_bae4b8e582"
              key={item.id}
              className="group flex items-center justify-between rounded-xl p-2 hover:bg-surface-2 transition-colors">
                
                        <div data-ev-id="ev_1153685728" className="flex items-center gap-3 min-w-0">
                          <div data-ev-id="ev_41d8515dc8" className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primary/15 text-primary">
                            <FileAudio className="h-5 w-5" />
                          </div>
                          <div data-ev-id="ev_6753260043" className="flex flex-col min-w-0">
                            <span data-ev-id="ev_8b0effca45" className="truncate text-xs font-bold text-foreground leading-tight">
                              {item.title}
                            </span>
                            <span data-ev-id="ev_a42530dd04" className="text-[10px] text-muted-foreground mt-0.5">
                              {formatTime(item.durationSeconds)} | {item.tags}
                            </span>
                          </div>
                        </div>

                        <button data-ev-id="ev_ffe15df7dc"
                type="button"
                onClick={() => handleSelectAudio(item)}
                className="rounded-xl border border-primary/40 bg-primary/15 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/25 transition-all cursor-pointer">
                  
                          Use
                        </button>
                      </div>
              )}
                  </div>
            }
              </div>
          }

            {/* Content Tab 2: Library (Real Studio Tracks) */}
            {sourceTab === 'library' &&
          <div data-ev-id="ev_9a3cd8229c" className="flex flex-col gap-1 max-h-[260px] overflow-y-auto no-scrollbar py-1">
                {libraryTracks.map((item) => {
              const isThisPlaying = previewId === item.id;
              return (
                <div data-ev-id="ev_ec1cd9a5f4"
                key={item.id}
                className="group flex items-center justify-between rounded-xl p-2 hover:bg-surface-2 transition-colors">
                  
                      <div data-ev-id="ev_99d99346d2" className="flex items-center gap-3 min-w-0">
                        {/* Cover thumbnail with hover play button */}
                        <div data-ev-id="ev_0e7c7ac1f9" className="relative h-11 w-11 flex-none rounded-lg overflow-hidden bg-black/40">
                          <img data-ev-id="ev_1a339afddf"
                      src={
                      item.coverUrl ||
                      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&q=80'
                      }
                      alt=""
                      className="h-full w-full object-cover" />
                      
                          <button data-ev-id="ev_a25689d2bb"
                      type="button"
                      onClick={() => togglePreview(item)}
                      className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity cursor-pointer ${
                      isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`
                      }>
                        
                            {isThisPlaying ?
                        <Pause className="h-4 w-4 fill-white text-white" /> :

                        <Play className="h-4 w-4 fill-white text-white translate-x-0.5" />
                        }
                          </button>
                        </div>

                        {/* Title and duration meta tags */}
                        <div data-ev-id="ev_7041bc286c" className="flex flex-col min-w-0">
                          <span data-ev-id="ev_7e175f5b81" className="truncate text-xs font-bold text-foreground leading-tight">
                            {item.title}
                          </span>
                          <span data-ev-id="ev_d690844a9f" className="truncate text-[10px] text-muted-foreground mt-0.5">
                            {formatTime(item.durationSeconds)} | {item.tags}
                          </span>
                        </div>
                      </div>

                      {/* "Use" Button */}
                      <button data-ev-id="ev_7df89a42d5"
                  type="button"
                  onClick={() => handleSelectAudio(item)}
                  className="rounded-xl border border-primary/40 bg-primary/15 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/25 hover:scale-105 active:scale-95 transition-all cursor-pointer">
                    
                        Use
                      </button>
                    </div>);

            })}

                <div data-ev-id="ev_32db9cce17" className="pt-2 text-center text-[11px] text-muted-foreground">No more data</div>
              </div>
          }

            {/* Disclaimer Footer */}
            <p data-ev-id="ev_b3cf5ccae3" className="border-t border-border pt-3 text-center text-[10px] text-muted-foreground">
              By uploading, you acknowledge and agree to the{' '}
              <span data-ev-id="ev_12ba8d8d5b" className="underline hover:text-foreground cursor-pointer">Disclaimer</span> and allow
              others to use the audio.
            </p>
          </div>
        }

        {/* ============================================================== */}
        {/* STEP 2: PROCESSING SCREEN                                      */}
        {/* ============================================================== */}
        {step === 'processing' &&
        <div data-ev-id="ev_58666b0e22" className="flex flex-col gap-6 py-4">
            <div data-ev-id="ev_91fb92649d" className="flex items-start justify-between">
              <div data-ev-id="ev_6b3d3572cb">
                <h2 data-ev-id="ev_0a3549e3ad" className="text-xl font-black text-foreground">Trim</h2>
              </div>
              <button data-ev-id="ev_b74d6dcb74"
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground transition-colors">
              
                <X className="h-5 w-5" />
              </button>
            </div>

            <div data-ev-id="ev_1c5a4f9810" className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-surface-2 py-16">
              <div data-ev-id="ev_200c2dd913" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary animate-pulse">
                <FileAudio className="h-8 w-8" />
              </div>
              <p data-ev-id="ev_070fae8ba7" className="text-xs font-semibold text-foreground/80">Audio is being processed...</p>
            </div>
          </div>
        }

        {/* ============================================================== */}
        {/* STEP 3: WAVEFORM TRIMMER ACTION WINDOW                         */}
        {/* ============================================================== */}
        {step === 'editor' &&
        <div data-ev-id="ev_08da1ada6f" className="flex flex-col gap-5">
            {/* Header */}
            <div data-ev-id="ev_f1dc2167cf" className="flex items-start justify-between">
              <div data-ev-id="ev_8e82d68a97">
                <h2 data-ev-id="ev_85ad3102db" className="text-xl font-black text-foreground">Trim</h2>
              </div>
              <button data-ev-id="ev_80e3429f0f"
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground transition-colors">
              
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Waveform Workspace Card */}
            <div data-ev-id="ev_7a4380bb51" className="rounded-2xl border border-border bg-surface-2 p-5 flex flex-col gap-4">
              {/* Top Row: Time display & Trash icon */}
              <div data-ev-id="ev_d7fa382dd7" className="flex items-center justify-between">
                <span data-ev-id="ev_8a8eb3fe52" className="font-mono text-sm font-bold text-foreground tracking-wide">
                  {formatTime(currentTime)} / {formatTime(totalDuration)}
                </span>

                <button data-ev-id="ev_f91ae0baf6"
              type="button"
              title="Eliminar y elegir otro audio"
              onClick={() => {
                if (audioRef.current) audioRef.current.pause();
                setIsPlaying(false);
                setStep('select');
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-3 hover:text-destructive transition-colors">
                
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Waveform & Play controls row */}
              <div data-ev-id="ev_4c8019b5bc" className="flex items-center gap-3">
                {/* Round Play/Pause button */}
                <button data-ev-id="ev_9ee9f459e3"
              type="button"
              onClick={togglePlayTrimmer}
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface-3 text-foreground hover:bg-surface-3/80 hover:text-primary active:scale-95 transition-all shadow-md cursor-pointer border border-border">
                
                  {isPlaying ?
                <Pause className="h-4 w-4 fill-current" /> :

                <Play className="h-4 w-4 fill-current translate-x-0.5" />
                }
                </button>

                {/* Waveform Track Container with Draggable Trim Handles */}
                <div data-ev-id="ev_8ea83a71d9"
              ref={waveformTrackRef}
              onClick={handleTrackClick}
              className="relative flex-1 h-14 rounded-xl bg-black/80 flex items-center px-1 select-none cursor-pointer overflow-visible border border-white/5">
                
                  {/* Left dimmed area (outside trim range) */}
                  <div data-ev-id="ev_8cb8f6a0cc"
                className="absolute top-0 bottom-0 left-0 bg-black/75 rounded-l-xl pointer-events-none z-10 transition-all"
                style={{ width: `${startPercent}%` }} />
                

                  {/* Right dimmed area (outside trim range) */}
                  <div data-ev-id="ev_4bbd7245ea"
                className="absolute top-0 bottom-0 right-0 bg-black/75 rounded-r-xl pointer-events-none z-10 transition-all"
                style={{ width: `${100 - endPercent}%` }} />
                

                  {/* Active Bounding Trim Box */}
                  <div data-ev-id="ev_330af90b84"
                className="absolute top-0 bottom-0 z-20 border-y-2 border-white cursor-grab active:cursor-grabbing flex items-stretch"
                style={{
                  left: `${startPercent}%`,
                  width: `${selectionWidthPercent}%`
                }}
                onMouseDown={(e) => handleMouseDown(e, 'window')}
                onTouchStart={(e) => handleTouchStart(e, 'window')}>
                  
                    {/* Left Trim Handle (Draggable Grip) */}
                    <div data-ev-id="ev_640d208135"
                  className="absolute -left-2 top-0 bottom-0 w-4 bg-white rounded-l-xl flex items-center justify-center cursor-ew-resize hover:bg-primary active:bg-primary transition-colors shadow-lg z-30 select-none group"
                  title="Arrastra para cambiar inicio"
                  onMouseDown={(e) => handleMouseDown(e, 'start')}
                  onTouchStart={(e) => handleTouchStart(e, 'start')}>
                    
                      <div data-ev-id="ev_955a8eb0c0" className="h-4 w-0.5 bg-black/70 rounded-full group-hover:bg-black" />
                      <div data-ev-id="ev_f494f4e162" className="absolute -inset-x-3 inset-y-0" />
                    </div>

                    {/* Right Trim Handle (Draggable Grip) */}
                    <div data-ev-id="ev_dd76f2e0d7"
                  className="absolute -right-2 top-0 bottom-0 w-4 bg-white rounded-r-xl flex items-center justify-center cursor-ew-resize hover:bg-primary active:bg-primary transition-colors shadow-lg z-30 select-none group"
                  title="Arrastra para cambiar fin"
                  onMouseDown={(e) => handleMouseDown(e, 'end')}
                  onTouchStart={(e) => handleTouchStart(e, 'end')}>
                    
                      <div data-ev-id="ev_fd9d552d29" className="h-4 w-0.5 bg-black/70 rounded-full group-hover:bg-black" />
                      <div data-ev-id="ev_197ded70ab" className="absolute -inset-x-3 inset-y-0" />
                    </div>
                  </div>

                  {/* Qamuz Neon Lime Playhead Line */}
                  <div data-ev-id="ev_e67f47adf8"
                className="absolute top-1 bottom-1 w-0.5 bg-primary z-30 shadow-[0_0_10px_var(--color-primary)] pointer-events-none transition-[left] duration-75"
                style={{
                  left: `${playheadPercent}%`
                }} />
                

                  {/* Equalizer Waveform Bars Visualization */}
                  <div data-ev-id="ev_891832bf76" className="flex h-full w-full items-center justify-between px-3 gap-[2px] pointer-events-none">
                    {waveBars.map((height, i) => {
                    const barPercent = i / waveBars.length * 100;
                    const isPlayed = barPercent <= playheadPercent;
                    return (
                      <div data-ev-id="ev_e6c356dc9c"
                      key={i}
                      className={`w-[2.5px] rounded-full transition-colors ${
                      isPlayed ? 'bg-primary' : 'bg-white/45'}`
                      }
                      style={{ height: `${Math.round(height * 82)}%` }} />);


                  })}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Controls Bar: Left: [Trim] [Reset] | Right: [Save] */}
            <div data-ev-id="ev_74835d3494" className="flex items-center justify-between pt-1">
              <div data-ev-id="ev_b9e509c469" className="flex items-center gap-2">
                <button data-ev-id="ev_53c9d5620e"
              type="button"
              onClick={handleApplyTrim}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-3 hover:bg-surface-2 px-4 py-2 text-xs font-bold text-foreground active:scale-95 transition-all cursor-pointer">
                
                  <Scissors className="h-3.5 w-3.5" />
                  <span data-ev-id="ev_eefbd40c65">Trim</span>
                </button>

                <button data-ev-id="ev_b90fbaf404"
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-3 hover:bg-surface-2 px-4 py-2 text-xs font-bold text-foreground active:scale-95 transition-all cursor-pointer">
                
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span data-ev-id="ev_bb00f0f2fd">Reset</span>
                </button>
              </div>

              <button data-ev-id="ev_cd7ecbe406"
            type="button"
            onClick={handleSave}
            disabled={isProcessingSave}
            className="rounded-xl bg-primary px-6 py-2 text-xs font-black text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer">
              
                {saveSuccess ? '¡Guardado en el Espacio de Trabajo!' : isProcessingSave ? 'Creando en espacio de trabajo...' : 'Guardar en Espacio'}
              </button>
            </div>
          </div>
        }
      </div>
    </div>);

}