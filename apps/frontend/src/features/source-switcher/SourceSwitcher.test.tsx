import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { GroupSourceAdder } from '../../entities/plugin';
import { SourceSwitcher } from './SourceSwitcher';

let adders: (GroupSourceAdder & { providerId: string })[] = [];
vi.mock('./useSourceSwitcher', () => ({
  useSourceSwitcher: () => ({ current: null, currentName: undefined, groups: [], adders, switchTo: vi.fn() }),
}));

// antd's virtual list measures itself.
beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function openSwitcher() {
  render(
    <MemoryRouter>
      <SourceSwitcher size="middle" />
    </MemoryRouter>,
  );
  fireEvent.mouseDown(screen.getByRole('combobox'));
}

describe('SourceSwitcher', () => {
  it('shows one add form per provider that has one', () => {
    const submit = vi.fn();
    adders = [
      { providerId: 'gh', label: 'Analyse a GitHub repository', submit },
      { providerId: 'other', label: 'Add an image', submit },
    ];
    openSwitcher();
    expect(screen.getByLabelText('Analyse a GitHub repository')).toBeTruthy();
    expect(screen.getByLabelText('Add an image')).toBeTruthy();
  });

  it('shows no provider form when no provider has one', () => {
    adders = [];
    openSwitcher();
    expect(screen.getByLabelText('Source URL')).toBeTruthy();
    expect(screen.queryByLabelText('Analyse a GitHub repository')).toBeNull();
  });
});
