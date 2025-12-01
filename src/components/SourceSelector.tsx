import { FormEvent, useEffect, useState, ChangeEvent } from 'react';
import { Tabs, type TabsProps } from 'antd';
import type { AudioSourceDescriptor } from '../hooks/useAudioEngine';

export type SourceMode = 'media' | 'stream' | 'instrument';

interface SourceSelectorProps {
  onSelect: (descriptor: AudioSourceDescriptor) => Promise<void> | void;
  loading: boolean;
  activeTab: SourceMode;
  onTabChange: (mode: SourceMode) => void;
}

export const SourceSelector = ({ onSelect, loading, activeTab, onTabChange }: SourceSelectorProps) => {
  const [url, setUrl] = useState('');
  const [sampleUrl, setSampleUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const localUrl = `${window.location.origin}/jiumengyichang.mp3`;
    setSampleUrl(localUrl);
    setUrl((current) => current || localUrl);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim()) {
      setError('请输入 http(s) 音频链接');
      return;
    }

    try {
      setError(null);
      await onSelect({ kind: 'url', url: url.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : '链接加载失败');
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFileName(file.name);
    setError(null);
    try {
      await onSelect({ kind: 'file', file });
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件解析失败');
    } finally {
      event.target.value = '';
    }
  };

  const handleStreamStart = async () => {
    try {
      setError(null);
      await onSelect({ kind: 'stream' });
    } catch (err) {
      setError(err instanceof Error ? err.message : '实时生成初始化失败');
    }
  };

  const handleInstrumentStart = async () => {
    try {
      setError(null);
      await onSelect({ kind: 'instrument' });
    } catch (err) {
      setError(err instanceof Error ? err.message : '拇指琴模式初始化失败');
    }
  };

  const tabItems: TabsProps['items'] = [
    {
      key: 'media',
      label: '远程/本地音频',
      children: (
        <div className="source-selector__pane">
          <form className="source-selector__form" onSubmit={handleSubmit}>
            <label htmlFor="audio-url">远程音频 URL</label>
            <div className="source-selector__row">
              <input
                id="audio-url"
                type="url"
                placeholder="https://example.com/music.mp3"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={loading}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? '加载中…' : '加载'}
              </button>
            </div>
            {sampleUrl && <p className="source-selector__hint">默认示例：{sampleUrl}</p>}
          </form>

          <label className="source-selector__upload">
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              disabled={loading}
            />
            <span>{fileName ? `已选择：${fileName}` : '从本地选择音频文件'}</span>
          </label>
        </div>
      )
    },
    {
      key: 'stream',
      label: '实时和弦',
      children: (
        <div className="source-selector__pane">
          <p>无需音频文件，实时生成随机和弦流：</p>
          <button type="button" onClick={handleStreamStart} disabled={loading}>
            {loading ? '准备中…' : '启动实时流'}
          </button>
          <small>该模式为纯流式输出，无法拖动进度条。</small>
        </div>
      )
    },
    {
      key: 'instrument',
      label: '拇指琴模式',
      children: (
        <div className="source-selector__pane">
          <p>进入虚拟拇指琴，点击琴键即可实时演奏。</p>
          <button type="button" onClick={handleInstrumentStart} disabled={loading}>
            {loading ? '准备中…' : '进入拇指琴模式'}
          </button>
        </div>
      )
    }
  ];

  return (
    <section className="source-selector">
      <Tabs activeKey={activeTab} items={tabItems} onChange={(key) => onTabChange(key as SourceMode)} />
      {error && <p className="source-selector__error">{error}</p>}
    </section>
  );
};
