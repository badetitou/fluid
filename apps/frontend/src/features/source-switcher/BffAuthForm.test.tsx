import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BffAuthForm } from './BffAuthForm';

const config = { id: 's', name: 'n', url: 'http://x', authKind: 'header' as const, headerName: 'Authorization', hasSecret: false };

function setup(saved: boolean) {
  const onSave = vi.fn().mockResolvedValue(saved);
  render(<BffAuthForm config={config} busy={false} onSave={onSave} onRemoveSecret={vi.fn()} onRemoveClientSecret={vi.fn()} />);
  const input = screen.getByLabelText('Secret') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'tok-123' } });
  fireEvent.click(screen.getByRole('button', { name: /Save/ }));
  return { onSave, input };
}

describe('BffAuthForm', () => {
  it('empties the secret field once the save worked', async () => {
    const { onSave, input } = setup(true);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ secret: 'tok-123' }));
    await waitFor(() => expect(input.value).toBe(''));
    expect(document.body.innerHTML).not.toContain('tok-123');
  });

  it('keeps the secret in the field when the save failed, to retry', async () => {
    const { onSave, input } = setup(false);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(input.value).toBe('tok-123');
  });
});
