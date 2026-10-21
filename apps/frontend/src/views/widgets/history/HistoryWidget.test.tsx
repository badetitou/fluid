import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { historyWidgetExample as spec, type HistoryWidget as HistoryWidgetSpec } from '@fluid/shared';
import { asRows, resolveBinding } from '../../data';
import { HistoryWidget } from './HistoryWidget';

const author = { name: 'Ada Lovelace', avatarUrl: 'https://avatars.example.org/ada.png' };
const commits = {
  commits: [
    { id: 'a1335f3b45bf05796db7', message: 'Merge branch feat', date: '2026-10-21T10:00:00Z', author, parents: [{ id: 'm1' }, { id: 'f1' }] },
    { id: 'f1', message: 'add logo', date: '2026-10-21T09:00:00Z', author, parents: [{ id: 'r' }] },
    { id: 'm1', message: 'fix typo', date: '2026-10-21T08:00:00Z', author, parents: [{ id: 'r' }] },
    { id: 'r', message: 'initial commit', date: '2026-10-20T08:00:00Z', author: { name: 'Bob' }, parents: [] },
  ],
};
const rows = asRows(resolveBinding(spec.data, { commits }));

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

const renderWidget = (widget: HistoryWidgetSpec, data = rows) =>
  render(
    <MemoryRouter initialEntries={['/d/Commit']}>
      <Routes>
        <Route path="*" element={<><HistoryWidget widget={widget} rows={data} /><Location /></>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe('HistoryWidget', () => {
  it('lists the versions children first, with their author and short id', () => {
    const { container } = renderWidget(spec);
    expect(screen.getAllByRole('link').map((row) => row.getAttribute('aria-label'))).toEqual([
      'Merge branch feat',
      'add logo',
      'fix typo',
      'initial commit',
    ]);
    expect(screen.getByText('a1335f3')).toBeTruthy();
    expect(screen.getAllByText('Ada Lovelace')).toHaveLength(3);
    // Two lanes: the merged branch and the main line, one dot per version.
    expect(container.querySelectorAll('circle')).toHaveLength(4);
    expect(container.querySelector('circle')?.closest('svg')?.getAttribute('width')).toBe(String(6 * 2 + 2 * 14));
  });

  it('opens a version in a new column when its line is clicked', () => {
    renderWidget(spec);
    fireEvent.click(screen.getByLabelText('fix typo'));
    expect(screen.getByTestId('location').textContent).toContain('m1');
  });

  it('shows initials until the user allows the avatars host', () => {
    const { container } = renderWidget(spec);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getAllByText('AL').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Load avatars · avatars\.example\.org/ }));
    expect(container.querySelectorAll('img')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Load avatars/ })).toBeNull();
  });

  it('shows refs and extra columns, plain lines without linkTo, and an empty state', () => {
    const withRefs = rows.map((row, i) => (i === 0 ? { ...row, branches: ['main', 'origin/main'] } : row));
    renderWidget({ ...spec, linkTo: undefined, refsField: 'branches', columns: [{ key: 'author.name', title: 'Who' }] }, withRefs);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('origin/main')).toBeTruthy();
    expect(screen.getAllByText('Bob')).toHaveLength(2);
    cleanup();
    const { container } = renderWidget(spec, []);
    expect(container.querySelector('.ant-empty-description')?.textContent).toBe('No data');
  });

  it('warns when the versions are not linked to each other', () => {
    renderWidget({ ...spec, parentsField: 'parentCommits' });
    expect(screen.getByText(/No links between versions in "parentCommits"/).getAttribute('role')).toBe('status');
    cleanup();
    renderWidget(spec);
    expect(screen.queryByText(/No links between versions/)).toBeNull();
  });
});
