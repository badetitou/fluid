// -----------------------------------------------------------------------------
// fluid Open Views — reading the old Spec-Fluid format
// -----------------------------------------------------------------------------
// Spec-Fluid (`../specFluid.ts`) is the first Open Views provider. Until every
// server speaks Open Views, its documents are converted here: `table` becomes
// `columnedList`, `notebook` becomes `tabs`, svg `refs` become `hotspots`, tree
// `hasMore` becomes `truncated`, `unsupported.presenter` becomes `type`.

import type {
  SpecFluidNode,
  SpecFluidTabResponse,
  SpecFluidTabsResponse,
  SpecFluidTreeNode,
} from '../specFluid';
import type { ViewItem } from './items';
import type { ViewNode } from './nodes';
import type { ObjectViewsResponse, ViewResponse } from './protocol';

function treeItem(node: SpecFluidTreeNode): ViewItem {
  return {
    cells: node.cells,
    ...(node.ref ? { ref: node.ref } : {}),
    ...(node.children ? { children: node.children.map(treeItem) } : {}),
    ...(node.hasMore ? { truncated: true } : {}),
  };
}

function truncation(truncated: boolean | undefined): { truncated?: boolean } {
  return truncated ? { truncated: true } : {};
}

/** Converts one Spec-Fluid node (and its children) into an Open Views node. */
export function specFluidNodeToViewNode(node: SpecFluidNode): ViewNode {
  switch (node.kind) {
    case 'table':
      return {
        kind: 'columnedList',
        columns: node.columns,
        items: node.rows.map((row) => ({ cells: row.cells, ...(row.ref ? { ref: row.ref } : {}) })),
        ...truncation(node.truncated),
      };
    case 'tree':
      return {
        kind: 'tree',
        columns: node.columns,
        roots: node.roots.map(treeItem),
        ...truncation(node.truncated),
      };
    case 'svg':
      return { kind: 'svg', svg: node.svg, ...(node.refs ? { hotspots: node.refs } : {}) };
    case 'composite':
      return { kind: 'composite', direction: node.direction, children: node.children.map(specFluidNodeToViewNode) };
    case 'notebook':
      return {
        kind: 'tabs',
        tabs: node.pages.map((page) => ({ title: page.title, node: specFluidNodeToViewNode(page.node) })),
        ...(node.selected !== undefined ? { selected: node.selected } : {}),
      };
    case 'unsupported':
      return { kind: 'unsupported', type: node.presenter, ...(node.message ? { message: node.message } : {}) };
    case 'text':
    case 'label':
    case 'diff':
      return node;
  }
}

/** Converts `GET <endpoint>/entities/<id>/tabs` into an Open Views object views response. */
export function specFluidTabsToViews(response: SpecFluidTabsResponse): ObjectViewsResponse {
  const { id, type, name } = response.entity;
  return {
    object: { id, ...(type ? { type } : {}), ...(name ? { label: name } : {}) },
    views: response.tabs.map((tab) => ({ key: tab.key, title: tab.title, priority: tab.order })),
  };
}

/** Converts `GET <endpoint>/entities/<id>/tabs/<key>` into an Open Views view response. */
export function specFluidTabToView(response: SpecFluidTabResponse): ViewResponse {
  return {
    key: response.key,
    title: response.title,
    priority: response.order,
    view: specFluidNodeToViewNode(response.root),
  };
}
