import { Tooltip } from 'antd';
import type { PyramidBrick as Brick } from './pyramidLayout';
import styles from './Pyramid.module.css';

/** What the tooltip says under the metric's name: what it measures, its thresholds and level. */
function explanation(brick: Brick): string {
  const parts = [brick.description];
  if (brick.thresholds) {
    const [low, average, high] = brick.thresholds;
    parts.push(`Thresholds: low ${low}, average ${average}, high ${high}.`);
    parts.push(brick.level ? `${brick.text} is closest to ${brick.level}.` : 'Not computable from the data.');
  } else if (brick.kind === 'value' && !brick.text) parts.push('Not found in the data.');
  return parts.filter(Boolean).join(' ');
}

function classesOf(brick: Brick): string {
  const color = brick.kind === 'ratio' && brick.level ? styles[brick.level] : styles[brick.part];
  return [styles.brick, styles[brick.kind], color].filter(Boolean).join(' ');
}

/** One brick of the pyramid: a metric's name, its value, a colored ratio or a filler; hover tells what it is. */
export function PyramidBrick({ brick }: { brick: Brick }) {
  const position = { gridRow: brick.row + 1, gridColumn: `${brick.col + 1} / span ${brick.span}` };
  if (brick.kind === 'fill') return <div className={classesOf(brick)} style={position} aria-hidden />;
  const details = explanation(brick);
  const title = (
    <>
      <div className={styles.tooltipName}>{brick.title}</div>
      {details}
    </>
  );
  return (
    <Tooltip title={title}>
      <div
        className={classesOf(brick)}
        style={position}
        tabIndex={0}
        role="img"
        aria-label={[brick.title, brick.kind === 'label' ? '' : brick.text || 'no value', details].filter(Boolean).join(' — ')}
      >
        {brick.text}
      </div>
    </Tooltip>
  );
}
