import { describe, expect, it } from 'vitest';
import { mcpWidgetCatalog, MCP_UNAVAILABLE_WIDGETS } from './hostCatalog';

describe('mcpWidgetCatalog', () => {
  it('keeps the widgets the viewer draws and drops the others', () => {
    const types = mcpWidgetCatalog().map((c) => c.type);
    expect(types).toContain('table');
    expect(types).toContain('richtext');
    for (const t of MCP_UNAVAILABLE_WIDGETS) expect(types).not.toContain(t);
  });
});
