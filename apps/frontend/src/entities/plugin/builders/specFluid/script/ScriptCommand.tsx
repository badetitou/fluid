import { MillerColumnPathContext } from '../../../../../navigation/columnPath';
import type { PageAction, PageActionPanelProps } from '../../../pageAction';
import { ENDPOINT_SETTING } from '../model';
import { ScriptPanel } from './ScriptPanel';

/** The script panel, on the entity of the rightmost column; what it answers opens after that column. */
function ScriptCommandPanel({ context, onClose }: PageActionPanelProps) {
  const endpoint = context.settings[ENDPOINT_SETTING];
  const itemId = context.focus?.itemId;
  if (!endpoint || !itemId || !context.focus) return null;
  return (
    <MillerColumnPathContext.Provider value={context.focus.path}>
      <ScriptPanel key={itemId} endpoint={endpoint} itemId={itemId} onClose={onClose} />
    </MillerColumnPathContext.Provider>
  );
}

/**
 * A command of the floating button, once the Spec-Fluid endpoint is set and a
 * detail column is open: Smalltalk run by the image on that column's entity (`self`).
 */
export const pharoScriptAction: PageAction = {
  id: 'pharo-script',
  label: 'Pharo script',
  description: 'Smalltalk script on the entity of the last column (self).',
  available: ({ settings, focus }) => !!settings[ENDPOINT_SETTING] && !!focus?.itemId,
  Panel: ScriptCommandPanel,
};
