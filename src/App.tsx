import { useCallback, useState } from 'react';
import { AudioControls } from './components/AudioControls';
import { KalimbaKeyboard } from './components/KalimbaKeyboard';
import { SourceSelector, type SourceMode } from './components/SourceSelector';
import { VisualizerCanvas } from './components/VisualizerCanvas';
import { useAudioEngine, type AudioSourceDescriptor } from './hooks/useAudioEngine';
import type { VisualizerMode } from './hooks/useVisualizer';
import './App.css';

const visualizerModes: { label: string; value: VisualizerMode }[] = [
  { label: '频谱', value: 'spectrum' },
  { label: '波形', value: 'waveform' }
];

const App = () => {
  const [mode, setMode] = useState<VisualizerMode>('spectrum');
  const [sourceTab, setSourceTab] = useState<SourceMode>('media');
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const {
    analyserNode,
    state,
    loadSource,
    play,
    pause,
    stop,
    seekTo,
    errorMessage,
    volume,
    setVolume,
    currentTime,
    duration,
    activeSource,
    triggerInstrumentNote
  } = useAudioEngine();

  const handleSourceSelect = useCallback(
    async (descriptor: AudioSourceDescriptor) => {
      setIsLoadingSource(true);
      try {
        await loadSource(descriptor);
      } finally {
        setIsLoadingSource(false);
      }
    },
    [loadSource]
  );

  const handlePlay = useCallback(() => {
    void play();
  }, [play]);

  const handlePause = useCallback(() => {
    pause();
  }, [pause]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const disabled = isLoadingSource || state === 'loading';
  const isInstrument = activeSource === 'instrument';
  const isStream = activeSource === 'stream';
  const showControls = sourceTab !== 'instrument';
  const showKalimba = sourceTab === 'instrument' && isInstrument;
  const controlsDisabled = disabled || isInstrument;
  const allowSeek = !(isInstrument || isStream);

  return (
    <main className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">Web Audio 实验</p>
          <h1>音乐可视化实验室</h1>
          <p className="app__subtitle">加载在线或本地音频，实时观察频谱 / 波形。</p>
        </div>
      </header>

      <section className="app__content">
        <div className="app__column app__column--controls">
          <SourceSelector
            onSelect={handleSourceSelect}
            loading={disabled}
            activeTab={sourceTab}
            onTabChange={setSourceTab}
          />
          {errorMessage && <p className="app__error">{errorMessage}</p>}
          {showControls && (
            <AudioControls
              state={state}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onSeek={seekTo}
              volume={volume}
              onVolumeChange={setVolume}
              currentTime={currentTime}
              duration={duration}
              disabled={controlsDisabled}
              allowSeek={allowSeek}
            />
          )}

          {showKalimba && (
            <section className="kalimba-panel">
              <h3>拇指琴实时演奏</h3>
              <p>点击琴键即可触发音符，可视化会实时响应。</p>
              <KalimbaKeyboard onPlayNote={triggerInstrumentNote} />
            </section>
          )}
        </div>

        <div className="app__column app__column--visualizer">
          <section className="visualizer-panel">
            <div className="visualizer-panel__header">
              <h2>实时可视化</h2>
              <div className="visualizer-panel__modes">
                {visualizerModes.map(({ label, value }) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="visualizer-mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => setMode(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <VisualizerCanvas analyser={analyserNode} mode={mode} />
          </section>
        </div>
      </section>
    </main>
  );
};

export default App;
