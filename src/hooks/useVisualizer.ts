import { useEffect, useRef } from 'react';

export type VisualizerMode = 'spectrum' | 'waveform';

interface UseVisualizerOptions {
  analyser: AnalyserNode | null;
  mode: VisualizerMode;
  barColor?: string;
  backgroundColor?: string;
}

export const useVisualizer = ({
  analyser,
  mode,
  barColor = '#38bdf8',
  backgroundColor = 'rgba(2, 6, 23, 0.9)'
}: UseVisualizerOptions) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) {
      return undefined;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    let animationFrame: number;
    const deviceRatio = window.devicePixelRatio || 1;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * deviceRatio;
      canvas.height = height * deviceRatio;
      context.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener('resize', resize);
    resize();

    const bufferLength =
      mode === 'spectrum' ? analyser.frequencyBinCount : analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const renderSpectrum = () => {
      analyser.getByteFrequencyData(dataArray);
      const { width, height } = canvas.getBoundingClientRect();
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, width, height);
      const barWidth = width / bufferLength;
      for (let i = 0; i < bufferLength; i += 1) {
        const value = dataArray[i] / 255;
        const barHeight = value * height;
        const x = i * barWidth;
        const y = height - barHeight;
        const gradient = context.createLinearGradient(x, y, x, height);
        gradient.addColorStop(0, '#a855f7');
        gradient.addColorStop(1, barColor);
        context.fillStyle = gradient;
        context.fillRect(x, y, barWidth * 0.9, barHeight);
      }
    };

    const renderWaveform = () => {
      analyser.getByteTimeDomainData(dataArray);
      const { width, height } = canvas.getBoundingClientRect();
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, width, height);
      context.lineWidth = 2;
      context.strokeStyle = barColor;
      context.beginPath();
      const sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i += 1) {
        const v = dataArray[i] / 128;
        const y = (v * height) / 2;
        if (i === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
        x += sliceWidth;
      }
      context.lineTo(width, height / 2);
      context.stroke();
    };

    const draw = () => {
      animationFrame = requestAnimationFrame(draw);
      if (mode === 'spectrum') {
        renderSpectrum();
      } else {
        renderWaveform();
      }
    };

    animationFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [analyser, backgroundColor, barColor, mode]);

  return canvasRef;
};
