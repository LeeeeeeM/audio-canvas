import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type AudioSourceDescriptor =
  | { kind: 'url'; url: string }
  | { kind: 'file'; file: File };

export type PlaybackState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

const SUPPORTED_FILE_PREFIX = 'audio/';

const validateUrl = (value: string) => /^https?:\/\//i.test(value.trim());

export const useAudioEngine = () => {
  const [state, setState] = useState<PlaybackState>('idle');
  const [activeSource, setActiveSource] = useState<'url' | 'file' | null>(null);
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
      resetBufferState();
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setCurrentTime(0);
      setActiveSource('url');
      setState('ready');
    },
    [disconnectBufferSource, ensureContext, handleMediaElementEnded, resetBufferState]
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
      resetBufferState();
      mediaElementRef.current?.pause();
      mediaElementRef.current && (mediaElementRef.current.currentTime = 0);
      setDuration(decoded.duration);
      setCurrentTime(0);
      setActiveSource('file');
      setState('ready');
    },
    [disconnectBufferSource, ensureContext, resetBufferState]
  );

  const loadSource = useCallback(
    async (descriptor: AudioSourceDescriptor) => {
      try {
        setErrorMessage(null);
        setState('loading');
        if (descriptor.kind === 'url') {
          await loadUrlSource(descriptor.url);
        } else {
          await loadFileSource(descriptor.file);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        setErrorMessage(message);
        setState('error');
        throw error;
      }
    },
    [loadFileSource, loadUrlSource]
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
    }
  }, [activeSource, ensureContext, startFilePlayback, state]);

  const seekTo = useCallback(
    async (targetSeconds: number) => {
      const safeTarget = Math.max(0, targetSeconds);

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
      }
    }, 200);

    return () => window.clearInterval(interval);
  }, [activeSource, state]);

  useEffect(() => {
    return () => {
      disconnectBufferSource();
      mediaElementRef.current?.pause();
      mediaElementRef.current?.removeEventListener('ended', handleMediaElementEnded);
      audioContextRef.current?.close();
    };
  }, [disconnectBufferSource, handleMediaElementEnded]);

  const canPlay = state === 'ready' || state === 'paused';
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
      seekTo
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
      activeSource
    ]
  );
};

export type UseAudioEngineReturn = ReturnType<typeof useAudioEngine>;
