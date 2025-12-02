import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// 17-key kalimba arranged visually from left to right (outermost to innermost)
const KALIMBA_KEYS = [
  { label: 'D6', freq: 1174.66 },
  { label: 'B5', freq: 987.77 },
  { label: 'G5', freq: 783.99 },
  { label: 'E5', freq: 659.25 },
  { label: 'C5', freq: 523.25 },
  { label: 'A4', freq: 440 },
  { label: 'F4', freq: 349.23 },
  { label: 'D4', freq: 293.66 },
  { label: 'C4', freq: 261.63 },
  { label: 'E4', freq: 329.63 },
  { label: 'G4', freq: 392 },
  { label: 'B4', freq: 493.88 },
  { label: 'D5', freq: 587.33 },
  { label: 'F5', freq: 698.46 },
  { label: 'A5', freq: 880 },
  { label: 'C6', freq: 1046.5 },
  { label: 'E6', freq: 1318.51 }
];

export type AudioSourceDescriptor =
  | { kind: 'url'; url: string }
  | { kind: 'file'; file: File }
  | { kind: 'stream'; preset?: 'harmonic' }
  | { kind: 'instrument' };

export type PlaybackState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

const SUPPORTED_FILE_PREFIX = 'audio/';

const validateUrl = (value: string) => /^https?:\/\//i.test(value.trim());

const getKalimbaFrequency = (index: number) => KALIMBA_KEYS[index]?.freq ?? null;

export const useAudioEngine = () => {
  const [state, setState] = useState<PlaybackState>('idle');
  const [activeSource, setActiveSource] = useState<'url' | 'file' | 'stream' | 'instrument' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const decodedBufferRef = useRef<AudioBuffer | null>(null);
  const bufferOffsetRef = useRef(0);
  const bufferStartedAtRef = useRef<number | null>(null);
  const streamNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamModuleLoadedRef = useRef(false);
  const streamStartedAtRef = useRef<number | null>(null);
  const streamOffsetRef = useRef(0);

  const ensureContext = useCallback(() => {
    if (!audioContextRef.current) {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
      const gainNode = context.createGain();
      gainNode.gain.value = volume;

      analyser.connect(gainNode);
      gainNode.connect(context.destination);

      audioContextRef.current = context;
      analyserRef.current = analyser;
      gainNodeRef.current = gainNode;
    }

    return audioContextRef.current;
  }, [volume]);

  const disconnectBufferSource = useCallback(() => {
    if (bufferSourceRef.current) {
      bufferSourceRef.current.onended = null;
      bufferSourceRef.current.stop(0);
      bufferSourceRef.current.disconnect();
      bufferSourceRef.current = null;
    }
  }, []);

  const resetBufferState = useCallback(() => {
    bufferOffsetRef.current = 0;
    bufferStartedAtRef.current = null;
  }, []);

  const handleMediaElementEnded = useCallback(() => {
    setState('ready');
    setCurrentTime(0);
  }, []);

  const disconnectStreamNode = useCallback(() => {
    streamNodeRef.current?.disconnect();
    streamNodeRef.current?.port.postMessage({ type: 'set-active', active: false });
    streamNodeRef.current = null;
    streamStartedAtRef.current = null;
    streamOffsetRef.current = 0;
  }, []);

  const ensureStreamWorklet = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    const context = ensureContext();
    if (!streamModuleLoadedRef.current) {
      const moduleUrl = `${window.location.origin}/worklets/harmonic-generator.js`;
      await context.audioWorklet.addModule(moduleUrl);
      streamModuleLoadedRef.current = true;
    }
  }, [ensureContext]);

  const loadUrlSource = useCallback(
    async (url: string) => {
      if (!validateUrl(url)) {
        throw new Error('请输入合法的 http(s) 音频链接');
      }

      const context = ensureContext();
      await context.resume();

      let audio = mediaElementRef.current;
      if (!audio) {
        audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.preload = 'auto';
        audio.addEventListener('ended', handleMediaElementEnded);
        mediaElementRef.current = audio;
      }

      if (!mediaElementSourceRef.current) {
        mediaElementSourceRef.current = context.createMediaElementSource(audio);
        mediaElementSourceRef.current.connect(analyserRef.current!);
      }

      audio.src = url.trim();
      audio.currentTime = 0;

      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('音频加载失败，请确认链接可用并允许跨域访问'));
        };
        const cleanup = () => {
          audio?.removeEventListener('canplay', onCanPlay);
          audio?.removeEventListener('error', onError);
        };

        if (audio.readyState >= 2) {
          resolve();
          return;
        }

        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('error', onError);
      });

      decodedBufferRef.current = null;
      disconnectBufferSource();
      disconnectStreamNode();
      resetBufferState();
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setCurrentTime(0);
      setActiveSource('url');
      setState('ready');
    },
    [disconnectBufferSource, disconnectStreamNode, ensureContext, handleMediaElementEnded, resetBufferState]
  );

  const loadFileSource = useCallback(
    async (file: File) => {
      if (!file.type.startsWith(SUPPORTED_FILE_PREFIX)) {
        throw new Error('仅支持音频类型文件');
      }

      const context = ensureContext();
      await context.resume();

      const arrayBuffer = await file.arrayBuffer();
      const decoded = await context.decodeAudioData(arrayBuffer);

      decodedBufferRef.current = decoded;
      disconnectBufferSource();
      disconnectStreamNode();
      resetBufferState();
      mediaElementRef.current?.pause();
      mediaElementRef.current && (mediaElementRef.current.currentTime = 0);
      setDuration(decoded.duration);
      setCurrentTime(0);
      setActiveSource('file');
      setState('ready');
    },
    [disconnectBufferSource, disconnectStreamNode, ensureContext, resetBufferState]
  );

  const loadSource = useCallback(
    async (descriptor: AudioSourceDescriptor) => {
      try {
        setErrorMessage(null);
        setState('loading');
        if (descriptor.kind === 'url') {
          await loadUrlSource(descriptor.url);
        } else if (descriptor.kind === 'file') {
          await loadFileSource(descriptor.file);
        } else if (descriptor.kind === 'stream') {
          const context = ensureContext();
          await context.resume();
          await ensureStreamWorklet();
          disconnectBufferSource();
          mediaElementRef.current?.pause();
          mediaElementRef.current && (mediaElementRef.current.currentTime = 0);
          disconnectStreamNode();
          const node = new AudioWorkletNode(context, 'harmonic-generator');
          node.port.postMessage({ type: 'set-active', active: false });
          node.connect(analyserRef.current!);
          streamNodeRef.current = node;
          streamOffsetRef.current = 0;
          streamStartedAtRef.current = null;
          decodedBufferRef.current = null;
          setDuration(0);
          setCurrentTime(0);
          setActiveSource('stream');
          setState('ready');
        } else if (descriptor.kind === 'instrument') {
          const context = ensureContext();
          await context.resume();
          disconnectBufferSource();
          disconnectStreamNode();
          mediaElementRef.current?.pause();
          mediaElementRef.current && (mediaElementRef.current.currentTime = 0);
          decodedBufferRef.current = null;
          resetBufferState();
          streamOffsetRef.current = 0;
          streamStartedAtRef.current = null;
          setDuration(0);
          setCurrentTime(0);
          setActiveSource('instrument');
          setState('ready');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        setErrorMessage(message);
        setState('error');
        throw error;
      }
    },
    [disconnectBufferSource, disconnectStreamNode, ensureContext, ensureStreamWorklet, loadFileSource, loadUrlSource, resetBufferState]
  );

  const startFilePlayback = useCallback(
    async (offsetSeconds: number) => {
      const context = ensureContext();
      await context.resume();
      if (!decodedBufferRef.current) {
        return;
      }

      disconnectBufferSource();
      const source = context.createBufferSource();
      source.buffer = decodedBufferRef.current;
      source.connect(analyserRef.current!);

      const clampedOffset = Math.min(
        decodedBufferRef.current.duration,
        Math.max(0, offsetSeconds)
      );
      bufferStartedAtRef.current = context.currentTime - clampedOffset;
      bufferOffsetRef.current = clampedOffset;
      source.onended = () => {
        disconnectBufferSource();
        bufferOffsetRef.current = 0;
        bufferStartedAtRef.current = null;
        setState((prev) => (prev === 'playing' ? 'ready' : prev));
      };
      source.start(0, clampedOffset);
      bufferSourceRef.current = source;
    },
    [disconnectBufferSource, ensureContext]
  );

  const play = useCallback(async () => {
    if (state === 'loading') {
      return;
    }

    const context = ensureContext();
    await context.resume();

    if (activeSource === 'url' && mediaElementRef.current) {
      await mediaElementRef.current.play();
      setState('playing');
      return;
    }

    if (activeSource === 'file' && decodedBufferRef.current) {
      await startFilePlayback(bufferOffsetRef.current);
      setState('playing');
      return;
    }

    if (activeSource === 'stream' && streamNodeRef.current && audioContextRef.current) {
      streamNodeRef.current.port.postMessage({ type: 'set-active', active: true });
      streamStartedAtRef.current = audioContextRef.current.currentTime;
      setState('playing');
      return;
    }

    if (activeSource === 'instrument') {
      setState('ready');
    }
  }, [activeSource, ensureContext, startFilePlayback, state]);

  const triggerInstrumentNote = useCallback(
    async (noteIndex: number) => {
      if (activeSource !== 'instrument') {
        return;
      }
      const freq = getKalimbaFrequency(noteIndex);
      if (!freq) {
        return;
      }
      const context = ensureContext();
      await context.resume();

      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = freq;

      const noteGain = context.createGain();
      oscillator.connect(noteGain);
      noteGain.connect(analyserRef.current!);

      const now = context.currentTime;
      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.linearRampToValueAtTime(1, now + 0.01);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      oscillator.start(now);
      oscillator.stop(now + 1.3);
      oscillator.onended = () => {
        oscillator.disconnect();
        noteGain.disconnect();
      };
    },
    [activeSource, ensureContext]
  );

  const seekTo = useCallback(
    async (targetSeconds: number) => {
      const safeTarget = Math.max(0, targetSeconds);

      if (activeSource === 'stream' || activeSource === 'instrument') {
        return;
      }

      if (activeSource === 'url' && mediaElementRef.current) {
        const audio = mediaElementRef.current;
        if (Number.isFinite(audio.duration)) {
          const clamped = Math.min(audio.duration, safeTarget);
          audio.currentTime = clamped;
          setCurrentTime(clamped);
          if (state === 'playing') {
            await audio.play();
          }
        }
        return;
      }

      if (activeSource === 'file' && decodedBufferRef.current) {
        const durationValue = decodedBufferRef.current.duration;
        const clamped = Math.min(durationValue, safeTarget);
        bufferOffsetRef.current = clamped;
        setCurrentTime(clamped);

        if (state === 'playing') {
          await startFilePlayback(clamped);
        } else {
          // 更新起始时间，保持下一次播放从新位置开始
          if (audioContextRef.current) {
            bufferStartedAtRef.current = audioContextRef.current.currentTime - clamped;
          }
        }
      }
    },
    [activeSource, startFilePlayback, state]
  );

  const pause = useCallback(() => {
    if (activeSource === 'url' && mediaElementRef.current) {
      mediaElementRef.current.pause();
      setState('paused');
      return;
    }

    if (activeSource === 'file' && bufferSourceRef.current && audioContextRef.current) {
      const source = bufferSourceRef.current;
      source.onended = null;
      source.stop();
      source.disconnect();
      bufferSourceRef.current = null;
        if (bufferStartedAtRef.current !== null && decodedBufferRef.current) {
        const elapsed = audioContextRef.current.currentTime - bufferStartedAtRef.current;
        // 由于 bufferStartedAt 已经包含了偏移量，这里直接用 elapsed 作为当前进度
        bufferOffsetRef.current = Math.min(decodedBufferRef.current.duration, Math.max(0, elapsed));
        }
        bufferStartedAtRef.current = null;
        setState('paused');
      return;
    }

    if (activeSource === 'stream' && streamNodeRef.current && audioContextRef.current) {
      streamNodeRef.current.port.postMessage({ type: 'set-active', active: false });
      if (streamStartedAtRef.current !== null) {
        streamOffsetRef.current += audioContextRef.current.currentTime - streamStartedAtRef.current;
      }
      streamStartedAtRef.current = null;
      setState('paused');
      return;
      }

    if (activeSource === 'instrument') {
      setState('ready');
    }
  }, [activeSource]);

  const stop = useCallback(() => {
    if (activeSource === 'url' && mediaElementRef.current) {
      mediaElementRef.current.pause();
      mediaElementRef.current.currentTime = 0;
      setCurrentTime(0);
      setState('ready');
      return;
    }

    if (activeSource === 'file') {
      disconnectBufferSource();
      resetBufferState();
      setCurrentTime(0);
      setState('ready');
      return;
    }

    if (activeSource === 'stream' && streamNodeRef.current) {
      streamNodeRef.current.port.postMessage({ type: 'set-active', active: false });
      streamOffsetRef.current = 0;
      streamStartedAtRef.current = null;
      setCurrentTime(0);
      setState('ready');
      return;
    }

    if (activeSource === 'instrument') {
      setCurrentTime(0);
      setState('ready');
    }
  }, [activeSource, disconnectBufferSource, resetBufferState]);

  const setVolumeSafely = useCallback(
    (value: number) => {
      const gainNode = gainNodeRef.current;
      const context = audioContextRef.current;
      setVolume(value);
      if (gainNode && context) {
        gainNode.gain.setTargetAtTime(value, context.currentTime, 0.01);
      }
    },
    []
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (activeSource === 'url' && mediaElementRef.current) {
        setCurrentTime(mediaElementRef.current.currentTime || 0);
        setDuration(Number.isFinite(mediaElementRef.current.duration) ? mediaElementRef.current.duration : 0);
        return;
      }

      if (activeSource === 'file' && decodedBufferRef.current && audioContextRef.current) {
        const durationValue = decodedBufferRef.current.duration;
        setDuration(durationValue);
        if (state === 'playing' && bufferStartedAtRef.current !== null) {
          const elapsed = audioContextRef.current.currentTime - bufferStartedAtRef.current;
          // 这里的 elapsed 已经是从音频开头算起的时间（包含偏移量）
          const time = Math.min(durationValue, Math.max(0, elapsed));
          setCurrentTime(time);
        } else {
          setCurrentTime(bufferOffsetRef.current);
        }
        return;
      }

      if (activeSource === 'stream' && audioContextRef.current) {
        setDuration(0);
        if (state === 'playing' && streamStartedAtRef.current !== null) {
          const elapsed = audioContextRef.current.currentTime - streamStartedAtRef.current;
          setCurrentTime(streamOffsetRef.current + elapsed);
        } else {
          setCurrentTime(streamOffsetRef.current);
        }
        return;
      }

      if (activeSource === 'instrument') {
        setDuration(0);
        setCurrentTime(0);
      }
    }, 200);

    return () => window.clearInterval(interval);
  }, [activeSource, state]);

  useEffect(() => {
    return () => {
      disconnectBufferSource();
      disconnectStreamNode();
      mediaElementRef.current?.pause();
      mediaElementRef.current?.removeEventListener('ended', handleMediaElementEnded);
      audioContextRef.current?.close();
    };
  }, [disconnectBufferSource, disconnectStreamNode, handleMediaElementEnded]);

  const canPlay = activeSource === 'instrument' ? false : state === 'ready' || state === 'paused';
  const isPlaying = state === 'playing';

  return useMemo(
    () => ({
      analyserNode: analyserRef.current,
      state,
      play,
      pause,
      stop,
      loadSource,
      canPlay,
      isPlaying,
      errorMessage,
      volume,
      setVolume: setVolumeSafely,
      currentTime,
      duration,
      activeSource,
      seekTo,
      triggerInstrumentNote
    }),
    [
      currentTime,
      duration,
      errorMessage,
      isPlaying,
      loadSource,
      pause,
      play,
      seekTo,
      setVolumeSafely,
      state,
      stop,
      volume,
      canPlay,
      activeSource,
      triggerInstrumentNote
    ]
  );
};

export type UseAudioEngineReturn = ReturnType<typeof useAudioEngine>;
