import { Alert } from 'antd';
import { useModelResolution } from './useModelResolution';

const README_URL = 'https://github.com/badetitou/fluid#semantic-resolution-scip';

interface ModelResolutionAlertProps {
  className?: string;
}

/** Warns when the connected Model only has syntax-resolved relations, and points to the README. */
export function ModelResolutionAlert({ className }: ModelResolutionAlertProps) {
  const resolution = useModelResolution();
  if (resolution !== 'incomplete') return null;

  return (
    <Alert
      className={className}
      type="warning"
      showIcon
      closable
      title="Incomplete model: relations were resolved from syntax only (no SCIP index)."
      description={
        <>
          Some calls and references are best-effort. Read the{' '}
          <a href={README_URL} target="_blank" rel="noopener noreferrer">
            README
          </a>{' '}
          to go further.
        </>
      }
    />
  );
}
