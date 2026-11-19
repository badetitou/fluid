import { describe, expect, it } from 'vitest';
import { loadViewerHtml, PLACEHOLDER_HTML } from './viewerHtml';

describe('loadViewerHtml', () => {
  it('serves the packaged viewer when the file is there', () => {
    const page = loadViewerHtml('/pkg/dist/viewer.html', (p) => (p === '/pkg/dist/viewer.html' ? '<html>real</html>' : ''));
    expect(page).toEqual({ html: '<html>real</html>', source: 'packaged' });
  });

  it('falls back to the placeholder when the file is missing or empty', () => {
    const missing = loadViewerHtml('/nope', () => {
      throw new Error('ENOENT');
    });
    expect(missing).toEqual({ html: PLACEHOLDER_HTML, source: 'placeholder' });
    expect(loadViewerHtml('/empty', () => '  \n').source).toBe('placeholder');
  });
});
