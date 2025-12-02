import { useState } from 'react';
import { Drawer, Button } from 'antd';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// 配置使用本地打包的 Monaco Editor，而不是从 CDN 加载
loader.config({ monaco });

export type ScoreNote = {
  code: string;
  duration: string;
};

interface ScoreEditorProps {
  visible: boolean;
  onClose: () => void;
  onPlay: (score: ScoreNote[]) => void;
}

const DEFAULT_SCORE: ScoreNote[] = [
  { code: 'C4', duration: '16' },
  { code: 'C4', duration: '16' },
  { code: 'G4', duration: '16' },
  { code: 'G4', duration: '16' },
  { code: 'A4', duration: '16' },
  { code: 'A4', duration: '16' },
  { code: 'G4', duration: '16' },
  { code: '-', duration: '16' },
  { code: 'F4', duration: '16' },
  { code: 'F4', duration: '16' },
  { code: 'E4', duration: '16' },
  { code: 'E4', duration: '16' },
  { code: 'D4', duration: '16' },
  { code: 'D4', duration: '16' },
  { code: 'C4', duration: '16' },
  { code: '-', duration: '16' }
];

export const ScoreEditor = ({ visible, onClose, onPlay }: ScoreEditorProps) => {
  const [scoreJson, setScoreJson] = useState<string>(
    JSON.stringify(DEFAULT_SCORE, null, 2)
  );
  const [error, setError] = useState<string | null>(null);

  const handlePlay = () => {
    try {
      const parsed = JSON.parse(scoreJson) as ScoreNote[];
      
      // 验证格式
      if (!Array.isArray(parsed)) {
        throw new Error('乐谱必须是数组格式');
      }

      // 验证每个元素
      for (let i = 0; i < parsed.length; i++) {
        const note = parsed[i];
        if (!note || typeof note !== 'object') {
          throw new Error(`第 ${i + 1} 个元素格式错误`);
        }
        if (!('code' in note) || !('duration' in note)) {
          throw new Error(`第 ${i + 1} 个元素缺少 code 或 duration 字段`);
        }
        if (typeof note.code !== 'string' || typeof note.duration !== 'string') {
          throw new Error(`第 ${i + 1} 个元素的 code 或 duration 必须是字符串`);
        }
      }

      setError(null);
      onPlay(parsed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'JSON 解析失败');
    }
  };

  return (
    <Drawer
      title="乐谱编辑器"
      placement="right"
      width={600}
      open={visible}
      onClose={onClose}
      extra={
        <Button type="primary" onClick={handlePlay}>
          播放
        </Button>
      }
    >
      {error && (
        <div style={{ color: '#ff4d4f', marginBottom: '1rem', padding: '0.5rem', background: 'rgba(255, 77, 79, 0.1)', borderRadius: '4px' }}>
          {error}
        </div>
      )}
      <Editor
        height="calc(100vh - 200px)"
        defaultLanguage="json"
        value={scoreJson}
        onChange={(value) => {
          setScoreJson(value || '');
          setError(null);
        }}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true
        }}
      />
    </Drawer>
  );
};

