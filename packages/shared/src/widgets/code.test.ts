import { describe, expect, it } from 'vitest';
import { codeRulesSchema, codeWidgetSchema, methodRulesExample } from './code';

const base = { data: { query: 'ast' }, parentField: 'parent' };

describe('codeRulesSchema', () => {
  it('requires a position mode', () => {
    const result = codeRulesSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('lineField');
  });

  it('accepts lines or offsets', () => {
    expect(codeRulesSchema.safeParse({ ...base, lineField: 'line' }).success).toBe(true);
    expect(codeRulesSchema.safeParse({ ...base, startOffsetField: 'start' }).success).toBe(true);
  });

  it('is valid in the curated example', () => {
    const [source] = methodRulesExample.widgets;
    expect(codeWidgetSchema.safeParse(source).success).toBe(true);
  });
});
