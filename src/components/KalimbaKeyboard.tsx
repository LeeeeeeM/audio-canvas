import { PointerEvent, useEffect, useRef, useState } from 'react';

type KalimbaKey = {
  degree: string;
  dots: number; // 0 = no dots, 1 = one dot above, 2 = two dots above
  note: string;
  height: number;
  highlight?: boolean;
  keyboardKey?: string; // 对应的键盘按键
};

// Left-to-right layout matching the 17-key kalimba chart (C tuning)
// Red keys: positions 2, 5, 8, 11, 14 (0-indexed)
// Height: lower notes = longer keys, higher notes = shorter keys
// C4 (lowest, center) should be longest, D6 and E6 (highest, edges) should be shortest
// Minimum height: 120px, step: 10px
// Keyboard mapping: qwer (0-3), asdfg (4-8), jkl; (9-12), uiop (13-16)
export const KALIMBA_LAYOUT: KalimbaKey[] = [
  { degree: '2', dots: 2, note: 'D6', height: 120, keyboardKey: 'q' }, // position 0
  { degree: '7', dots: 1, note: 'B5', height: 130, keyboardKey: 'w' }, // position 1
  { degree: '5', dots: 1, note: 'G5', height: 140, highlight: true, keyboardKey: 'e' }, // position 2 - RED
  { degree: '3', dots: 1, note: 'E5', height: 150, keyboardKey: 'r' }, // position 3
  { degree: '1', dots: 1, note: 'C5', height: 160, keyboardKey: 'a' }, // position 4
  { degree: '6', dots: 0, note: 'A4', height: 170, highlight: true, keyboardKey: 's' }, // position 5 - RED
  { degree: '4', dots: 0, note: 'F4', height: 180, keyboardKey: 'd' }, // position 6
  { degree: '2', dots: 0, note: 'D4', height: 190, keyboardKey: 'f' }, // position 7
  { degree: '1', dots: 0, note: 'C4', height: 200, highlight: true, keyboardKey: 'g' }, // position 8 - RED (center, longest)
  { degree: '3', dots: 0, note: 'E4', height: 190, keyboardKey: 'j' }, // position 9
  { degree: '5', dots: 0, note: 'G4', height: 180, keyboardKey: 'k' }, // position 10
  { degree: '7', dots: 0, note: 'B4', height: 170, highlight: true, keyboardKey: 'l' }, // position 11 - RED
  { degree: '2', dots: 1, note: 'D5', height: 160, keyboardKey: ';' }, // position 12
  { degree: '4', dots: 1, note: 'F5', height: 150, keyboardKey: 'u' }, // position 13
  { degree: '6', dots: 1, note: 'A5', height: 140, highlight: true, keyboardKey: 'i' }, // position 14 - RED
  { degree: '1', dots: 2, note: 'C6', height: 130, keyboardKey: 'o' }, // position 15
  { degree: '3', dots: 2, note: 'E6', height: 120, keyboardKey: 'p' } // position 16
];

// 键盘按键到索引的映射
const KEYBOARD_MAP: Record<string, number> = {
  q: 0, w: 1, e: 2, r: 3,
  a: 4, s: 5, d: 6, f: 7, g: 8,
  j: 9, k: 10, l: 11, ';': 12,
  u: 13, i: 14, o: 15, p: 16
};

interface KalimbaKeyboardProps {
  onPlayNote: (index: number) => void;
  highlightedIndex?: number | null; // 外部控制的高亮索引（用于乐谱播放）
}

export const KalimbaKeyboard = ({ onPlayNote, highlightedIndex = null }: KalimbaKeyboardProps) => {
  const pressedKeysRef = useRef<Set<number>>(new Set());
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());

  const handlePointer = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault();
    setActiveKeys((prev) => new Set(prev).add(index));
    onPlayNote(index);
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault();
    setActiveKeys((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 忽略在输入框等元素中的按键
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const index = KEYBOARD_MAP[key];

      if (index !== undefined && !pressedKeysRef.current.has(index)) {
        pressedKeysRef.current.add(index);
        setActiveKeys((prev) => new Set(prev).add(index));
        onPlayNote(index);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const index = KEYBOARD_MAP[key];

      if (index !== undefined) {
        pressedKeysRef.current.delete(index);
        setActiveKeys((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onPlayNote]);

  return (
    <div className="kalimba">
      {KALIMBA_LAYOUT.map((key, index) => (
        <button
          type="button"
          key={key.note}
          className={`kalimba__key${key.highlight ? ' kalimba__key--highlight' : ''}${activeKeys.has(index) ? ' kalimba__key--active' : ''}${highlightedIndex === index ? ' kalimba__key--score-active' : ''}`}
          style={{ height: key.height }}
          onPointerDown={(event) => handlePointer(event, index)}
          onPointerUp={(event) => handlePointerUp(event, index)}
          onPointerLeave={(event) => {
            if (event.buttons === 1) {
              handlePointerUp(event, index);
            }
          }}
        >
          <div className="kalimba__degree-wrapper">
            {key.dots > 0 && (
              <div className="kalimba__dots">
                {key.dots === 2 && <span className="kalimba__dot">·</span>}
                {key.dots >= 1 && <span className="kalimba__dot">·</span>}
              </div>
            )}
            <span className="kalimba__degree">{key.degree}</span>
          </div>
          <span className="kalimba__note">{key.note}</span>
          {key.keyboardKey && (
            <span className="kalimba__keyboard-hint">{key.keyboardKey.toUpperCase()}</span>
          )}
        </button>
      ))}
    </div>
  );
};
