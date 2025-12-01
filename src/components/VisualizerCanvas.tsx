import { useVisualizer, VisualizerMode } from '../hooks/useVisualizer';

interface VisualizerCanvasProps {
  analyser: AnalyserNode | null;
  mode: VisualizerMode;
}

export const VisualizerCanvas = ({ analyser, mode }: VisualizerCanvasProps) => {
  const canvasRef = useVisualizer({ analyser, mode });

  return (
    <div className="visualizer">
      <canvas ref={canvasRef} />
    </div>
  );
};
