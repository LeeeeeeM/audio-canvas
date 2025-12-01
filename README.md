# 音乐可视化实验室

一个使用 **React + Vite + TypeScript + Web Audio API** 构建的音乐可视化工具，支持加载在线音频链接以及本地音频文件，通过频谱 / 波形图实时展示声音变化，并提供完整的播放控制与进度拖动体验。

## 功能特性
- **多音源输入**：支持 http(s) 远程链接与本地文件上传，自动判断类型并加载。
- **Web Audio 可视化**：内置频谱柱状图与波形两种模式，可在运行时切换。
- **完整播放控制**：播放 / 暂停 / 停止、音量调节、进度条拖动（拖动时自动暂停，松开后续播）。
- **错误提示与加载状态**：无效链接、跨域失败、本地解析错误等都会提示，方便排错。
- **响应式布局**：桌面端左右分栏（左控右显），移动端自动堆叠。

## 快速开始
```bash
# 安装依赖
pnpm install

# 启动开发服务器（默认 http://localhost:5173）
pnpm dev

# 生产构建
pnpm build

# 代码检查
pnpm lint
```

## 使用说明
1. **选择音源**
   - 在「远程音频 URL」输入可跨域访问的 mp3/ogg 链接（例如 `https://samplelib.com/lib/preview/mp3/sample-3s.mp3`）。
   - 或者点击「从本地选择音频文件」上传 `audio/*` 文件。
2. **控制播放**
   - 加载成功后即可播放；暂停时再次播放会从暂停点继续。
   - 进度条支持拖动：按下时自动暂停，松开后跳转到新位置并按需恢复播放。
   - 调节音量滑块即可实时改变输出音量。
3. **可视化模式**
   - 右上角单选按钮可在「频谱」「波形」之间切换，画面会实时更新。

## 目录结构
```
├── src/
│   ├── components/
│   │   ├── AudioControls.tsx      # 播放控制与进度条
│   │   ├── SourceSelector.tsx     # URL 输入 + 文件上传
│   │   └── VisualizerCanvas.tsx   # Canvas 容器
│   ├── hooks/
│   │   ├── useAudioEngine.ts      # 管理 AudioContext/播放状态
│   │   └── useVisualizer.ts       # 频谱/波形渲染逻辑
│   ├── App.tsx / App.css          # 布局与样式
│   ├── main.tsx / index.css       # 入口与全局样式
│   └── vite-env.d.ts
├── public/vite.svg
├── package.json / pnpm-lock.yaml
├── vite.config.ts / tsconfig*.json
└── docs/音乐可视化设计方案.md
```

## 常见问题
- **跨域失败**：如遇“音频加载失败，请确认链接可用并允许跨域访问”，说明目标服务器未开启 CORS，可改用支持跨域的示例链接或本地文件。
- **浏览器自动播放策略**：首次交互前 `AudioContext` 会被暂停，需要用户点击加载 / 播放后才会真正发声。

欢迎根据需求扩展更多可视化形态或增加全局状态管理。EOF
