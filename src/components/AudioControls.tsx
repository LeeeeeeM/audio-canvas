import { useRef, useState } from 'react';
import type { PlaybackState } from '../hooks/useAudioEngine';

interface AudioControlsProps {
  state: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void | Promise<void>;
  volume: number;
  onVolumeChange: (value: number) => void;
  currentTime: number;
  duration: number;
  disabled?: boolean;
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value)) {
    return '00:00';
  }
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const AudioControls = ({
  state,
  onPlay,
  onPause,
  onStop,
  onSeek,
  volume,
  onVolumeChange,
  currentTime,
  duration,
  disabled = false
}: AudioControlsProps) => {
  const isPlaying = state === 'playing';
  const canControl = state === 'ready' || state === 'paused' || state === 'playing';
  const [isSeeking, setIsSeeking] = useState(false);
  const [pendingTime, setPendingTime] = useState(0);
  const resumeAfterSeekRef = useRef(false);

  const displayedTime = isSeeking ? pendingTime : currentTime;
  const progress = duration > 0 ? Math.min((displayedTime / duration) * 100, 100) : 0;

  const beginSeek = () => {
    if (!canControl || disabled) {
      return;
    }
    setIsSeeking(true);
    setPendingTime(currentTime);
    resumeAfterSeekRef.current = state === 'playing';
    if (resumeAfterSeekRef.current) {
      onPause();
    }
  };

  const commitSeek = async () => {
    if (!isSeeking) {
      return;
    }
    setIsSeeking(false);
    await Promise.resolve(onSeek(pendingTime));
    if (resumeAfterSeekRef.current) {
      onPlay();
    }
    resumeAfterSeekRef.current = false;
  };

  const handleSeekChange = (value: number) => {
    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }
    if (isSeeking) {
      setPendingTime(value);
    } else {
      void Promise.resolve(onSeek(value));
    }
  };

  return (
    <section className="audio-controls" aria-live="polite">
      <div className="audio-controls__buttons">
        <button type="button" onClick={isPlaying ? onPause : onPlay} disabled={!canControl || disabled}>
          {isPlaying ? '暂停' : '播放'}
        </button>
        <button type="button" onClick={onStop} disabled={!canControl || disabled}>
          停止
        </button>
        <span className="audio-controls__state">当前状态：{state}</span>
      </div>

      <div className="audio-controls__timeline">
        <div className="audio-controls__track">
          <div className="audio-controls__progress" style={{ width: `${progress}%` }} />
        </div>
        <input
          className="audio-controls__seek"
          type="range"
          min={0}
          max={Number.isFinite(duration) && duration > 0 ? duration : 0}
          step="0.01"
          value={Number.isFinite(displayedTime) ? displayedTime : 0}
          onChange={(event) => handleSeekChange(Number(event.target.value))}
          onPointerDown={beginSeek}
          onPointerUp={() => {
            void commitSeek();
          }}
          onPointerCancel={() => {
            void commitSeek();
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') {
              void commitSeek();
            }
          }}
          disabled={!canControl || disabled || !Number.isFinite(duration) || duration <= 0}
        />
      </div>
      <div className="audio-controls__time">
        <span>{formatTime(displayedTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <label className="audio-controls__volume">
        音量
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          disabled={!canControl || disabled}
        />
      </label>
    </section>
  );
};
