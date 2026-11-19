import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The MCP App viewer: one self-contained HTML file (inline JS and CSS, lazy chunks included), served
// by `fluid mcp` as ui://fluid/viewer. Output in dist-viewer/viewer.html. See docs/architecture/MCP.md.

/**
 * Widgets left out of the viewer, by the folder of their `lazy` module. They are replaced at build time
 * by a placeholder, so their libraries are not bundled. Override to measure: FLUID_VIEWER_STUB=network,code.
 * - network: ForceAtlas2 and the layered layout run in web workers, which the host sandbox forbids.
 * - model3d: three.js alone is more than a third of the page.
 */
const STUBBED = (process.env.FLUID_VIEWER_STUB ?? 'network,model3d').split(',').filter(Boolean);
const STUB = fileURLToPath(new URL('./src/app/mcp-viewer/UnavailableWidget.tsx', import.meta.url));
const VIRTUAL = '\0fluid-viewer-unavailable';
// Every name the `lazy` modules of the widgets export, all drawn by the one placeholder component.
const LAZY_NAMES = ['LazyNetworkWidget', 'LazyModel3dWidget', 'LazyScene3dWidget', 'LazyRichTextWidget', 'LazyCodeWidget', 'LazyMarkdown', 'LazyCodeBlock'];

function stubWidgets(folders: string[]): Plugin {
  const pattern = new RegExp(`/widgets/(${folders.join('|')})/lazy$`);
  return {
    name: 'fluid-viewer-stub-widgets',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (folders.length === 0 || !importer || !source.startsWith('.')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && pattern.test(resolved.id.replace(/\.tsx?$/, '')) ? VIRTUAL : null;
    },
    load: (id) =>
      id === VIRTUAL
        ? `export { ${LAZY_NAMES.map((n) => `UnavailableWidget as ${n}`).join(', ')} } from ${JSON.stringify(STUB)};`
        : null,
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [stubWidgets(STUBBED), react(), viteSingleFile()],
  build: {
    outDir: 'dist-viewer',
    emptyOutDir: true,
    rollupOptions: { input: 'viewer.html' },
    chunkSizeWarningLimit: 100_000,
  },
});
