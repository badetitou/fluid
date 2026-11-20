import { useEffect, useRef, useState } from 'react';
import type { GroupSourceAdder } from '../../entities/plugin';
import { isAbort, providerFormError, providerInput } from './providerFormModel';

/** The state of one provider's add form: what is typed, whether it is being sent, and why it failed. */
export function useProviderSourceForm(submit: GroupSourceAdder['submit']) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const input = providerInput(value);
  const send = async () => {
    if (!input || busy) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError(undefined);
    try {
      await submit(input, current.signal);
      if (!current.signal.aborted) setValue('');
    } catch (err) {
      if (!current.signal.aborted && !isAbort(err)) setError(providerFormError(err));
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  };
  const change = (next: string) => {
    setValue(next);
    setError(undefined);
  };

  return { value, change, busy, error, canSend: input !== null && !busy, send };
}
