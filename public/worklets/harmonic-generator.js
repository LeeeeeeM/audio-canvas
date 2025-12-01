const BASE_NOTES = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  349.23, // F4
  392.0, // G4
  440.0, // A4
  493.88 // B4
];

const TRIADS = [
  [0, 4, 7], // major
  [0, 3, 7], // minor
  [0, 4, 9] // add6 for variety
];

const TWO_PI = Math.PI * 2;

class HarmonicGenerator extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'gain',
        defaultValue: 0.25,
        minValue: 0,
        maxValue: 1
      }
    ];
  }

  constructor() {
    super();
    this.isActive = false;
    this.samplesSinceChange = 0;
    this.chordDurationSamples = sampleRate * 4; // roughly 4 seconds per chord
    this.voices = this.createChord();

    this.port.onmessage = (event) => {
      if (event.data?.type === 'set-active') {
        this.isActive = Boolean(event.data.active);
        if (!this.isActive) {
          this.samplesSinceChange = 0;
        }
      }
    };
  }

  createChord() {
    const root = BASE_NOTES[Math.floor(Math.random() * BASE_NOTES.length)];
    const octaveShift = Math.random() > 0.5 ? 2 ** (1 / 12 * 12) : 1; // occasionally up an octave
    const baseFreq = root * octaveShift;
    const intervals = TRIADS[Math.floor(Math.random() * TRIADS.length)];
    return intervals.map((interval) => ({
      freq: baseFreq * 2 ** (interval / 12),
      phase: Math.random() * TWO_PI
    }));
  }

  renderSample() {
    if (!this.isActive) {
      return 0;
    }

    this.samplesSinceChange += 1;
    if (this.samplesSinceChange >= this.chordDurationSamples) {
      this.samplesSinceChange = 0;
      this.voices = this.createChord();
    }

    let sample = 0;
    for (const voice of this.voices) {
      const phaseIncrement = (TWO_PI * voice.freq) / sampleRate;
      voice.phase += phaseIncrement;
      if (voice.phase >= TWO_PI) {
        voice.phase -= TWO_PI;
      }
      sample += Math.sin(voice.phase);
    }

    return sample / this.voices.length;
  }

  process(_inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output) {
      return true;
    }

    const gainValues = parameters.gain;
    for (let channel = 0; channel < output.length; channel += 1) {
      const buffer = output[channel];
      for (let i = 0; i < buffer.length; i += 1) {
        const gain = gainValues.length > 1 ? gainValues[i] : gainValues[0];
        buffer[i] = this.renderSample() * gain;
      }
    }

    return true;
  }
}

registerProcessor('harmonic-generator', HarmonicGenerator);
