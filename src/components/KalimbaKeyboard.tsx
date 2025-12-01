import { PointerEvent } from 'react';

const KALIMBA_LAYOUT = [
  { label: '1', note: 'C4' },
  { label: '2', note: 'D4' },
  { label: '3', note: 'E4' },
  { label: '4', note: 'F4' },
  { label: '5', note: 'G4' },
  { label: '6', note: 'A4' },
  { label: '7', note: 'B4' },
  { label: '1’', note: 'C5' },
  { label: '2’', note: 'D5' },
  { label: '3’', note: 'E5' },
  { label: '4’', note: 'F5' },
  { label: '5’', note: 'G5' },
  { label: '6’', note: 'A5' },
  { label: '7’', note: 'B5' },
  { label: '1”', note: 'C6' },
  { label: '2”', note: 'D6' },
  { label: '3”', note: 'E6' }
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
          className="kalimba__key"
          onPointerDown={(event) => handlePointer(event, index)}
        >
          <span className="kalimba__label">{key.label}</span>
          <span className="kalimba__note">{key.note}</span>
        </button>
      ))}
    </div>
  );
};
