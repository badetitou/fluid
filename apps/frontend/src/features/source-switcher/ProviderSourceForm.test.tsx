import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProviderSourceForm } from './ProviderSourceForm';

function setup(submit: (input: string, signal: AbortSignal) => Promise<void>) {
  render(
    <ProviderSourceForm
      adder={{ label: 'Analyse a GitHub repository', placeholder: 'owner/name', hint: 'Public repositories only', submit }}
    />,
  );
  const input = screen.getByLabelText('Analyse a GitHub repository') as HTMLInputElement;
  const add = screen.getByRole('button', { name: /Add/ });
  return { input, add };
}

describe('ProviderSourceForm', () => {
  it('sends the trimmed input, then empties the field', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const { input, add } = setup(submit);
    expect(screen.getByText('Public repositories only')).toBeTruthy();
    expect(add).toHaveProperty('disabled', true);
    fireEvent.change(input, { target: { value: '  badetitou/fluid ' } });
    fireEvent.click(add);
    expect(submit).toHaveBeenCalledWith('badetitou/fluid', expect.any(AbortSignal));
    await waitFor(() => expect(input.value).toBe(''));
  });

  it('shows why the provider refused, keeps the input, and clears the error on typing', async () => {
    const { input, add } = setup(vi.fn().mockRejectedValue(new Error('Expected owner/name')));
    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.click(add);
    expect((await screen.findByRole('alert')).textContent).toBe('Expected owner/name');
    expect(input.value).toBe('nope');
    fireEvent.change(input, { target: { value: 'nope/x' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not cancel a send when the popup closes and unmounts the form', async () => {
    let signal: AbortSignal | undefined;
    let resolve: () => void = () => {};
    const submit = vi.fn((_input: string, s: AbortSignal) => {
      signal = s;
      return new Promise<void>((r) => (resolve = r));
    });
    render(<ProviderSourceForm adder={{ label: 'Repo', submit }} />);
    fireEvent.change(screen.getByLabelText('Repo'), { target: { value: 'a/b' } });
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));
    cleanup();
    expect(signal?.aborted).toBe(false);
    resolve();
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });
});
