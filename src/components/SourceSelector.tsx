import { FormEvent, useEffect, useState, ChangeEvent } from 'react';
import type { AudioSourceDescriptor } from '../hooks/useAudioEngine';

interface SourceSelectorProps {
  onSelect: (descriptor: AudioSourceDescriptor) => Promise<void> | void;
  loading: boolean;
}

export const SourceSelector = ({ onSelect, loading }: SourceSelectorProps) => {
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

  return (
    <section className="source-selector">
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
        {error && <p className="source-selector__error">{error}</p>}
      </form>

      <div className="source-selector__divider">或</div>

      <label className="source-selector__upload">
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          disabled={loading}
        />
        <span>{fileName ? `已选择：${fileName}` : '从本地选择音频文件'}</span>
      </label>
    </section>
  );
};
