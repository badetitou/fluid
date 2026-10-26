import { CodeOutlined } from '@ant-design/icons';
import type { PageAction, PageActionPanelProps } from '../../../pageAction';
import { ENDPOINT_SETTING } from '../model';
import { ScriptPanel } from './ScriptPanel';

/** The script panel, docked under the column, on the column's entity. */
function ScriptCommandPanel({ context, onClose }: PageActionPanelProps) {
  const endpoint = context.settings[ENDPOINT_SETTING];
  const { itemId } = context.column;
  if (!endpoint || !itemId) return null;
  return <ScriptPanel key={itemId} endpoint={endpoint} itemId={itemId} onClose={onClose} />;
}

/**
 * A command of the floating button of a detail column, once the Spec-Fluid
 * endpoint is set: Smalltalk run by the image on the column's entity (`self`).
 */
export const pharoScriptAction: PageAction = {
  id: 'pharo-script',
  label: 'Pharo script',
  description: 'Smalltalk script on this entity (self)',
  Icon: CodeOutlined,
  available: ({ settings, column }) =>
    !!settings[ENDPOINT_SETTING] && column.columnKind === 'detail' && !!column.itemId,
  Panel: ScriptCommandPanel,
};
