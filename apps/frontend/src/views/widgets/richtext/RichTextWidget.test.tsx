import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { postBodyExample, type RichTextWidget as RichTextWidgetSpec } from '@fluid/shared';
import { RichTextWidget } from './RichTextWidget';

const bodySpec = postBodyExample.widgets.find((w) => w.type === 'richtext') as RichTextWidgetSpec;

describe('RichTextWidget', () => {
  it('renders the example body as Markdown, without raw HTML', () => {
    const body = '# Release\n\nSome **bold** text <script>alert(1)</script>';
    const { container } = render(<RichTextWidget widget={bodySpec} data={{ body }} />);
    expect(container.querySelector('h1')?.textContent).toBe('Release');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('script')).toBeNull();
  });

  it('highlights code', () => {
    const widget: RichTextWidgetSpec = { ...bodySpec, format: 'code', language: 'json' };
    const { container } = render(<RichTextWidget widget={widget} data={{ body: '{"a": 1}' }} />);
    expect(container.querySelector('pre')?.textContent).toContain('"a"');
    expect(container.querySelector('.token')).toBeTruthy();
  });

  it('shows an empty state without text', () => {
    render(<RichTextWidget widget={bodySpec} data={{ body: '' }} />);
    expect(screen.getByText('No text')).toBeTruthy();
  });
});
