import type { ReactNode } from 'react';
import { Tabs } from 'antd';
import type { ViewNode } from '@fluid/shared';
import { openPageKey } from './model';

interface SpecNotebookProps {
  tabs: { title: string; node: ViewNode }[];
  selected?: number;
  /** Draws the content of a tab (SpecNodeView, passed down to avoid a cyclic import). */
  renderTab: (node: ViewNode) => ReactNode;
}

/** A `tabs` node (Pharo's notebook) as antd tabs, open on the selected one. */
export function SpecNotebook({ tabs, selected, renderTab }: SpecNotebookProps) {
  return (
    <Tabs
      size="small"
      defaultActiveKey={openPageKey(tabs.length, selected)}
      items={tabs.map((tab, index) => ({
        key: String(index),
        label: tab.title || `Tab ${index + 1}`,
        children: renderTab(tab.node),
      }))}
    />
  );
}
