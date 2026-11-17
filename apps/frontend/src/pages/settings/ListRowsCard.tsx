import { Card, Checkbox, InputNumber, Space, Typography } from 'antd';
import { useSourceSettings } from '../../entities/source';
import styles from './SettingsPage.module.css';

const toLimit = (value: number | null): number | undefined => (value && value > 0 ? value : undefined);

/** How many rows of a list the connected source loads, and how "load all" behaves. */
export function ListRowsCard() {
  const { own, defaults, effective, offsetArg, update } = useSourceSettings();
  return (
    <Card title="Large lists">
      <Space orientation="vertical" className={styles.full}>
        <div>
          <Typography.Text strong>Rows loaded at first</Typography.Text>
          <Typography.Paragraph type="secondary" className={styles.control}>
            Lists of this source load this many rows; a banner offers to load more when there may be more. Empty, each
            view keeps its own number (100 for the default lists).
          </Typography.Paragraph>
          <InputNumber
            aria-label="Rows loaded at first"
            min={1}
            step={100}
            value={own.rowLimit ?? null}
            placeholder={defaults.rowLimit ? String(defaults.rowLimit) : 'per view'}
            onChange={(v) => update({ rowLimit: toLimit(v) })}
          />
        </div>
        <div>
          <Typography.Text strong>Most rows per request</Typography.Text>
          <Typography.Paragraph type="secondary" className={styles.control}>
            The most rows the server answers at once (Moose: 1000). Known, fluid tells a cut list from a short one
            {offsetArg ? `, and reads larger ones page by page with “${offsetArg}”` : ''}.
          </Typography.Paragraph>
          <InputNumber
            aria-label="Most rows per request"
            min={1}
            step={100}
            value={own.maxPerRequest ?? null}
            placeholder={defaults.maxPerRequest ? String(defaults.maxPerRequest) : 'unknown'}
            onChange={(v) => update({ maxPerRequest: toLimit(v) })}
          />
        </div>
        <Checkbox checked={effective.confirmLoadAll} onChange={(e) => update({ confirmLoadAll: e.target.checked })}>
          Ask before loading every row of a list
        </Checkbox>
        <Typography.Text type="secondary">
          {offsetArg
            ? `This source pages its lists with “${offsetArg}”.`
            : 'This source has no offset argument: “load all” asks every row at once.'}
        </Typography.Text>
      </Space>
    </Card>
  );
}
