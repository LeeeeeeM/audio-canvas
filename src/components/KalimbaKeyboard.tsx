import { PointerEvent } from 'react';

type KalimbaKey = {
  degree: string;
  dots: number; // 0 = no dots, 1 = one dot above, 2 = two dots above
  note: string;
  height: number;
  highlight?: boolean;
};

// Left-to-right layout matching the 17-key kalimba chart (C tuning)
// Red keys: positions 2, 5, 8, 11, 14 (0-indexed)
// Height: lower notes = longer keys, higher notes = shorter keys
// C4 (lowest, center) should be longest, D6 and E6 (highest, edges) should be shortest
// Minimum height: 120px, step: 10px
const KALIMBA_LAYOUT: KalimbaKey[] = [
  { degree: '2', dots: 2, note: 'D6', height: 120 }, // position 0
  { degree: '7', dots: 1, note: 'B5', height: 130 }, // position 1
  { degree: '5', dots: 1, note: 'G5', height: 140, highlight: true }, // position 2 - RED
  { degree: '3', dots: 1, note: 'E5', height: 150 }, // position 3
  { degree: '1', dots: 1, note: 'C5', height: 160 }, // position 4
  { degree: '6', dots: 0, note: 'A4', height: 170, highlight: true }, // position 5 - RED
  { degree: '4', dots: 0, note: 'F4', height: 180 }, // position 6
  { degree: '2', dots: 0, note: 'D4', height: 190 }, // position 7
  { degree: '1', dots: 0, note: 'C4', height: 200, highlight: true }, // position 8 - RED (center, longest)
  { degree: '3', dots: 0, note: 'E4', height: 190 }, // position 9
  { degree: '5', dots: 0, note: 'G4', height: 180 }, // position 10
  { degree: '7', dots: 0, note: 'B4', height: 170, highlight: true }, // position 11 - RED
  { degree: '2', dots: 1, note: 'D5', height: 160 }, // position 12
  { degree: '4', dots: 1, note: 'F5', height: 150 }, // position 13
  { degree: '6', dots: 1, note: 'A5', height: 140, highlight: true }, // position 14 - RED
  { degree: '1', dots: 2, note: 'C6', height: 130 }, // position 15
  { degree: '3', dots: 2, note: 'E6', height: 120 } // position 16
];

interface KalimbaKeyboardProps {
  onPlayNote: (index: number) => void;
}

export const KalimbaKeyboard = ({ onPlayNote }: KalimbaKeyboardProps) => {
  const handlePointer = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault();
    onPlayNote(index);
  };

  return (
    <div className="kalimba">
      {KALIMBA_LAYOUT.map((key, index) => (
        <button
          type="button"
          key={key.note}
          className={`kalimba__key${key.highlight ? ' kalimba__key--highlight' : ''}`}
          style={{ height: key.height }}
          onPointerDown={(event) => handlePointer(event, index)}
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
        </button>
      ))}
    </div>
  );
};
