import { describe, expect, it } from 'vitest';
import {
  addDashboard,
  dashboardFromColumn,
  dashboardHref,
  forgetPerspective,
  GRAPH_PATH,
  newGraphDashboardNavState,
  readPreselect,
  removeDashboard,
  renameDashboard,
  selectedBarKey,
  type Dashboard,
} from './model';

const detail = dashboardFromColumn(
  { concept: 'Character', itemId: '1', perspective: { key: 'character-detail', title: 'Character detail' } },
  1000,
);

describe('dashboardFromColumn', () => {
  it('keeps the column concept, item and perspective, and names it after them', () => {
    expect(detail).toEqual({
      id: 'rs',
      title: 'Character detail · 1',
      concept: 'Character',
      itemId: '1',
      perspective: 'character-detail',
    });
    expect(dashboardHref(detail)).toBe('/d/~rs');
  });

  it('falls back to the concept name without a perspective', () => {
    expect(dashboardFromColumn({ concept: 'Location' }, 1)).toEqual({ id: '1', title: 'Location', concept: 'Location' });
  });
});

describe('dashboard list', () => {
  it('returns the existing dashboard for the same column', () => {
    const { list } = addDashboard([], detail);
    const again = addDashboard(list, { ...detail, id: 'other' });
    expect(again).toEqual({ list, dashboard: detail });
    expect(addDashboard(list, { ...detail, id: 'other', perspective: 'p2' }).list).toHaveLength(2);
  });

  it('removes by id and forgets a deleted perspective', () => {
    const other: Dashboard = { ...detail, id: 'b', perspective: 'gone' };
    const list = [detail, other];
    expect(removeDashboard(list, detail.id)).toEqual([other]);
    expect(forgetPerspective(list, 'gone')).toEqual([detail]);
  });

  it('renames by id, trimming, and ignores a blank title', () => {
    const other: Dashboard = { ...detail, id: 'b' };
    const list = [detail, other];
    expect(renameDashboard(list, 'b', '  Mine  ')).toEqual([detail, { ...other, title: 'Mine' }]);
    expect(renameDashboard(list, 'b', '   ')).toBe(list);
  });
});

describe('preselection', () => {
  it('round-trips through the navigation state and rejects anything else', () => {
    expect(readPreselect(newGraphDashboardNavState())).toEqual({ path: GRAPH_PATH, assistant: true });
    expect(readPreselect(null)).toBeNull();
    expect(readPreselect({ preselect: { path: 3 } })).toBeNull();
  });
});

describe('selectedBarKey', () => {
  it('highlights the dashboard the page starts from, even with columns opened after it', () => {
    expect(selectedBarKey('/d/~rs/Location@3')).toBe('dashboard:rs');
    expect(selectedBarKey('/d/Character/Character@1')).toBe('concept:Character');
    expect(selectedBarKey('/d/%40home/Character')).toBe('home');
    expect(selectedBarKey('/')).toBe('home');
  });

  it('highlights nothing elsewhere', () => {
    expect(selectedBarKey(GRAPH_PATH)).toBe('concept:@graph');
    expect(selectedBarKey('/d/Character@1')).toBe('');
    expect(selectedBarKey('/settings')).toBe('');
  });
});
