import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import monacoEditorPluginModule from 'vite-plugin-monaco-editor';
// @ts-ignore - CommonJS module
var monacoEditorPlugin = monacoEditorPluginModule.default;
export default defineConfig({
    plugins: [
        react(),
        monacoEditorPlugin({
            languageWorkers: ['editorWorkerService']
        })
    ],
    server: {
        port: 5173
    }
});
