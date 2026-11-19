import { describe, expect, it } from 'vitest';
import { specFluidEndpoints } from './model';

describe('Spec-Fluid view builder model', () => {
  it('reads its one endpoint from the settings', () => {
    expect(specFluidEndpoints({ endpoint: ' http://localhost:8081/spec-fluid/ ' })).toEqual(['http://localhost:8081/spec-fluid']);
    expect(specFluidEndpoints({ endpoint: '' })).toEqual([]);
    expect(specFluidEndpoints({})).toEqual([]);
  });
});
