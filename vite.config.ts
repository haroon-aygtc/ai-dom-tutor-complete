import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

// Update manifest to point to TypeScript source files
const manifestWithSrc = {
  ...manifest,
  background: {
    service_worker: 'src/background.ts',
    type: 'module'
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content.ts'],
      css: ['public/content.css'],
      run_at: 'document_idle'
    }
  ],
  action: {
    default_popup: 'public/popup.html',
    default_title: 'AI DOM Tutor Settings'
  }
};

export default defineConfig({
  plugins: [crx({ manifest: manifestWithSrc as any })],
  build: {
    target: 'es2022',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: 'public/popup.html'
      }
    }
  },
  server: {
    hmr: true,
    port: 5173
  },
});
