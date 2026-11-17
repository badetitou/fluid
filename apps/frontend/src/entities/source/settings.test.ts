import { describe, expect, it } from 'vitest';
import { effectiveSettings, providerLimits, updateSettings } from './settings';

const MOOSE = 'http://localhost:8080/graphql';
const groups = [
  { providerId: 'a', label: 'A', sources: [{ name: 'Other', url: 'http://other/graphql' }] },
  { providerId: 'b', label: 'B', sources: [{ name: 'Moose', url: MOOSE, limits: { maxPerRequest: 1000 } }] },
];

describe('source settings', () => {
  it('takes the limits of the provider offering the source', () => {
    expect(providerLimits(MOOSE, groups)).toEqual({ maxPerRequest: 1000 });
    expect(providerLimits('http://unknown/graphql', groups)).toEqual({});
  });

  it('puts the user settings over the provider limits, and asks before load all by default', () => {
    expect(effectiveSettings(undefined, { maxPerRequest: 1000 })).toEqual({
      rowLimit: undefined,
      maxPerRequest: 1000,
      confirmLoadAll: true,
    });
    expect(effectiveSettings({ rowLimit: 300, maxPerRequest: 500, confirmLoadAll: false }, { maxPerRequest: 1000 })).toEqual({
      rowLimit: 300,
      maxPerRequest: 500,
      confirmLoadAll: false,
    });
  });

  it('clears emptied or invalid values', () => {
    expect(updateSettings({ rowLimit: 300 }, { rowLimit: undefined })).toEqual({});
    expect(updateSettings({ rowLimit: 300 }, { maxPerRequest: 0 })).toEqual({ rowLimit: 300 });
    expect(updateSettings(undefined, { rowLimit: 2.5, confirmLoadAll: false })).toEqual({ confirmLoadAll: false });
  });
});
