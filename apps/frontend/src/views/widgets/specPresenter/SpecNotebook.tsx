import type { ReactNode } from 'react';
import { Tabs } from 'antd';
import type { SpecFluidNode } from '@fluid/shared';
import { openPageKey } from './model';

interface SpecNotebookProps {
  pages: { title: string; node: SpecFluidNode }[];
  selected?: number;
  /** Draws the content of a page (SpecNodeView, passed down to avoid a cyclic import). */
  renderPage: (node: SpecFluidNode) => ReactNode;
}

/** A Pharo notebook (`SpNotebookPresenter`) as antd tabs, open on Pharo's selected page. */
export function SpecNotebook({ pages, selected, renderPage }: SpecNotebookProps) {
  return (
    <Tabs
      size="small"
      defaultActiveKey={openPageKey(pages.length, selected)}
      items={pages.map((page, index) => ({
        key: String(index),
        label: page.title || `Page ${index + 1}`,
        children: renderPage(page.node),
      }))}
    />
  );
}
