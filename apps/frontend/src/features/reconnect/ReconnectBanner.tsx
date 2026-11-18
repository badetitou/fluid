import { Alert, Button } from 'antd';
import { signInHint, useReconnect } from '../../entities/source';
import { reconnectMessage } from './model';

/** A non-blocking prompt, shown when the connected source asks to sign in again: "Reconnect" runs the sign-in. */
export function ReconnectBanner() {
  const { required, status, reconnect } = useReconnect();
  if (!required) return null;
  const hint = signInHint(status);

  return (
    <Alert
      banner
      closable={false}
      type="warning"
      title={hint ? `${reconnectMessage(required)} ${hint}` : reconnectMessage(required)}
      action={
        <Button size="small" type="primary" onClick={reconnect} loading={status === 'waiting'}>
          Reconnect
        </Button>
      }
    />
  );
}
