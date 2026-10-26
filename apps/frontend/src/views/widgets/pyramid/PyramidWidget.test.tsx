import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PyramidWidget } from './PyramidWidget';
import { pyramidData, pyramidSpec } from './pyramidFixture';

afterEach(cleanup);

describe('PyramidWidget', () => {
  it('draws the curated example: metrics, colored ratios and the legend', () => {
    const { container } = render(<PyramidWidget widget={pyramidSpec} data={pyramidData} />);
    expect(screen.getByRole('group', { name: 'Overview pyramid' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /^Lines of code \(LOC\) — 24/ })).toBeTruthy();
    const locNom = screen.getByRole('img', { name: /^Operation structuring \(LOC\/NOM\) — 8 — / });
    expect(locNom.getAttribute('aria-label')).toMatch(/Thresholds: low 4.92, average 6.91, high 8.9. 8 is closest to high/);
    expect(locNom.className).toMatch(/high/);
    expect(container.querySelectorAll('[aria-hidden]').length).toBeGreaterThan(0);
    expect(screen.getByText(/Ratios against Smalltalk thresholds/)).toBeTruthy();
  });

  it('lets the bricks be reached from the keyboard', () => {
    render(<PyramidWidget widget={pyramidSpec} data={pyramidData} />);
    const andc = screen.getByRole('img', { name: /^Average number of derived classes \(ANDC\) — 0.66/ });
    expect(andc.tabIndex).toBe(0);
  });

  it('explains an empty result instead of drawing an empty pyramid', () => {
    render(<PyramidWidget widget={pyramidSpec} data={null} />);
    expect(screen.getByText(/No data: the query returned nothing/)).toBeTruthy();
  });

  it('explains when no configured metric is in the result', () => {
    render(<PyramidWidget widget={{ ...pyramidSpec, nop: 'numberOfPackages' }} data={{ id: 'p1' }} />);
    expect(screen.getByText(/No metric found/)).toBeTruthy();
  });
});
