import { Button, ColorPicker } from 'antd';
import { UndoOutlined } from '@ant-design/icons';
import { useBuilderColors, type FluidPlugin } from '../../entities/plugin';
import styles from './PluginManager.module.css';

/** The colour of each view builder of a plugin, as marked on its perspectives' pills; the user may change it. */
export function BuilderColors({ plugin }: { plugin: FluidPlugin }) {
  const { colors, chosen, setColor } = useBuilderColors();
  const builders = plugin.manifest.contributes.viewBuilders ?? [];
  if (builders.length === 0) return null;
  return (
    <div className={styles.builderColors}>
      {builders.map(({ id, label }) => (
        <span key={id} className={styles.builderColor}>
          <ColorPicker
            size="small"
            disabledAlpha
            value={colors.get(id)}
            onChangeComplete={(c) => setColor(id, c.toHexString())}
            aria-label={`Colour of ${label}`}
          />
          <span className={styles.settingLabel}>{builders.length > 1 ? label : 'Perspective colour'}</span>
          {chosen[id] && (
            <Button
              size="small"
              type="text"
              icon={<UndoOutlined />}
              onClick={() => setColor(id)}
              aria-label={`Reset the colour of ${label}`}
              title="Back to the builder's own colour"
            />
          )}
        </span>
      ))}
    </div>
  );
}
