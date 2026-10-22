import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { renderMarkdown } from './support/build/renderMarkdown.js';

const privacyPolicyPath = fileURLToPath(new URL('./docs/support/privacy_policy.md', import.meta.url));

function privacyPolicyPlugin() {
  return {
    name: 'support-privacy-policy-content',
    transformIndexHtml(html, ctx) {
      if (!ctx.filename.includes('/privacy')) return html;
      const policy = renderMarkdown(readFileSync(privacyPolicyPath, 'utf8'));
      return html.replace('<!-- PRIVACY_POLICY_CONTENT -->', policy);
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL('./support', import.meta.url)),
  base: '/support/',
  publicDir: false,
  plugins: [react(), privacyPolicyPlugin()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: { '/api/support': 'http://127.0.0.1:8787' },
  },
  define: {
    'import.meta.env.VITE_SUPPORT_API_BASE': JSON.stringify(process.env.VITE_SUPPORT_API_BASE || ''),
  },
  build: {
    outDir: '../dist/support',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        support: fileURLToPath(new URL('./support/index.html', import.meta.url)),
        privacy: fileURLToPath(new URL('./support/privacy.html', import.meta.url)),
        'privacy/index': fileURLToPath(new URL('./support/privacy/index.html', import.meta.url)),
      },
    },
  },
});
