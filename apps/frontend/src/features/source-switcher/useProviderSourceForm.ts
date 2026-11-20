import { useEffect, useRef, useState } from 'react';
import type { GroupSourceAdder } from '../../entities/plugin';
import { isAbort, providerFormError, providerInput } from './providerFormModel';

/**
 * The state of one provider's add form: what is typed, whether it is being sent, and why it failed.
 * The form lives in the switcher's popup: closing it unmounts the form but does not cancel a send
 * (the provider's sources are still listed again once it resolves); only a newer send supersedes it.
 */
export function useProviderSourceForm(submit: GroupSourceAdder['submit']) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const input = providerInput(value);
  const send = async () => {
    if (!input || busy) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const live = () => mounted.current && !current.signal.aborted;
    setBusy(true);
    setError(undefined);
    try {
      await submit(input, current.signal);
      if (live()) setValue('');
    } catch (err) {
      if (live() && !isAbort(err)) setError(providerFormError(err));
    } finally {
      if (live()) setBusy(false);
    }
  };
  const change = (next: string) => {
    setValue(next);
    setError(undefined);
  };

  return { value, change, busy, error, canSend: input !== null && !busy, send };
}
