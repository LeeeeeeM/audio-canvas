import { useCallback, useRef, useState } from 'react';
import { KALIMBA_LAYOUT } from '../components/KalimbaKeyboard';
import type { ScoreNote } from '../components/ScoreEditor';

// BPM = 120, 四分音符 = 0.5秒
// 1个单位 = 1/64拍 = 0.5/16 = 0.03125秒
const BASE_UNIT_MS = (60 / 120) * 1000 / 16; // 约 31.25ms

export const useScorePlayer = (
  onPlayNote: (index: number) => void,
  onHighlightNote: (index: number | null) => void
) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const timeoutRefsRef = useRef<number[]>([]);
  const currentIndexRef = useRef<number>(0);

  // 根据 code 找到对应的琴键索引
  const findNoteIndex = useCallback((code: string): number | null => {
    if (code === '-') {
      return null; // 休止符
    }
    
    const index = KALIMBA_LAYOUT.findIndex((key) => key.note === code);
    return index >= 0 ? index : null; // 找不到的按休止符处理
  }, []);

  const stop = useCallback(() => {
    // 清除所有定时器
    timeoutRefsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefsRef.current = [];
    setIsPlaying(false);
    setCurrentIndex(null);
    onHighlightNote(null);
    currentIndexRef.current = 0;
  }, [onHighlightNote]);

  const play = useCallback(
    (score: ScoreNote[]) => {
      stop(); // 先停止之前的播放

      if (score.length === 0) {
        return;
      }

      setIsPlaying(true);
      currentIndexRef.current = 0;

      const playNext = (index: number) => {
        if (index >= score.length) {
          // 播放完成
          setIsPlaying(false);
          setCurrentIndex(null);
          onHighlightNote(null);
          return;
        }

        const note = score[index];
        const duration = parseInt(note.duration, 10);
        const durationMs = duration * BASE_UNIT_MS;

        setCurrentIndex(index);
        const noteIndex = findNoteIndex(note.code);

        if (noteIndex !== null) {
          // 播放音符
          onHighlightNote(noteIndex);
          onPlayNote(noteIndex);
        } else {
          // 休止符或不存在的音符
          onHighlightNote(null);
        }

        // 设置下一个音符的定时器
        const timeout = setTimeout(() => {
          playNext(index + 1);
        }, durationMs);

        timeoutRefsRef.current.push(timeout);
      };

      // 开始播放
      playNext(0);
    },
    [findNoteIndex, onPlayNote, onHighlightNote, stop]
  );

  return {
    isPlaying,
    currentIndex,
    play,
    stop
  };
};

