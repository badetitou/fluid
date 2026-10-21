import type { ReactNode } from 'react';
import { Tag, Typography } from 'antd';
import type { FormatKind } from '@fluid/shared';
import { SafeImage } from './widgets/SafeImage';

// Value formatting shared by table cells, descriptions and (text parts of) widgets.

const TAG_PALETTE = ['blue', 'green', 'gold', 'purple', 'magenta', 'cyan', 'volcano', 'geekblue'];

function tagColor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

function formatNumber(value: unknown, precision?: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision ?? 2,
  }).format(n);
}

export function formatCurrency(value: unknown, currency = 'EUR'): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
}

function formatDate(value: unknown, withTime: boolean): string {
  if (value == null || value === '') return '';
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value);
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

const empty = <Typography.Text type="secondary">—</Typography.Text>;

export interface FormatOptions {
  currency?: string;
  precision?: number;
}

/** Format a scalar value for display, returning a React node. */
export function formatValue(value: unknown, kind?: FormatKind, options?: FormatOptions): ReactNode {
  if (value == null || value === '') {
    return kind === 'boolean' ? formatBoolean(value) : empty;
  }

  switch (kind) {
    case 'currency':
      return formatCurrency(value, options?.currency);
    case 'number':
      return formatNumber(value, options?.precision);
    case 'percent': {
      const n = Number(value);
      return Number.isFinite(n) ? `${formatNumber(n, options?.precision)}%` : String(value);
    }
    case 'date':
      return formatDate(value, false);
    case 'datetime':
      return formatDate(value, true);
    case 'tag': {
      const text = String(value);
      return <Tag color={tagColor(text)}>{text}</Tag>;
    }
    case 'boolean':
      return formatBoolean(value);
    case 'image':
      return <SafeImage value={value} />;
    case 'text':
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

function formatBoolean(value: unknown): ReactNode {
  const truthy = value === true || value === 'true' || value === 1;
  return <Tag color={truthy ? 'green' : 'default'}>{truthy ? 'Yes' : 'No'}</Tag>;
}
