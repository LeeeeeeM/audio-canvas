import { useCallback, useState } from 'react';
import { Radio, Button } from 'antd';
import { AudioControls } from './components/AudioControls';
import { KalimbaKeyboard } from './components/KalimbaKeyboard';
import { ScoreEditor, type ScoreNote } from './components/ScoreEditor';
import { SourceSelector, type SourceMode } from './components/SourceSelector';
import { VisualizerCanvas } from './components/VisualizerCanvas';
import { useAudioEngine, type AudioSourceDescriptor } from './hooks/useAudioEngine';
import { useScorePlayer } from './hooks/useScorePlayer';
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

  // 乐谱编辑器状态
  const [scoreEditorVisible, setScoreEditorVisible] = useState(false);
  const [highlightedNoteIndex, setHighlightedNoteIndex] = useState<number | null>(null);

  // 乐谱播放
  const { play: playScore, stop: stopScore, isPlaying: isScorePlaying } = useScorePlayer(
    triggerInstrumentNote,
    setHighlightedNoteIndex
  );

  const handlePlayScore = useCallback(
    (score: ScoreNote[]) => {
      // 确保在拇指琴模式下
      if (!isInstrument) {
        handleSourceSelect({ kind: 'instrument' });
      }
      playScore(score);
    },
    [isInstrument, handleSourceSelect, playScore]
  );

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
        <div className="app__column app__column--visualizer">
          <section className="visualizer-panel">
            <div className="visualizer-panel__header">
              <h2>实时可视化</h2>
              <Radio.Group
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="visualizer-panel__modes"
              >
                {visualizerModes.map(({ label, value }) => (
                  <Radio key={value} value={value}>
                    {label}
                  </Radio>
                ))}
              </Radio.Group>
            </div>
            <VisualizerCanvas analyser={analyserNode} mode={mode} />
          </section>
        </div>

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <p style={{ margin: 0 }}>点击琴键或使用键盘（qwer / asdfg / jkl; / uiop）即可触发音符，可视化会实时响应。</p>
                <Button type="primary" onClick={() => setScoreEditorVisible(true)}>
                  乐谱编辑器
                </Button>
              </div>
              <KalimbaKeyboard
                onPlayNote={triggerInstrumentNote}
                highlightedIndex={highlightedNoteIndex}
              />
            </section>
          )}

          <ScoreEditor
            visible={scoreEditorVisible}
            onClose={() => setScoreEditorVisible(false)}
            onPlay={handlePlayScore}
          />
        </div>
      </section>
    </main>
  );
};

export default App;
