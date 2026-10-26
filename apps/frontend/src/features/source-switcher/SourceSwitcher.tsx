import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { Button, Divider, Flex, Select, type RefSelectProps } from 'antd';
import { ApiOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { AddSourceForm } from './AddSourceForm';
import { SourceOptionLabel } from './SourceOptionLabel';
import { useSourceSwitcher } from './useSourceSwitcher';
import styles from './SourceSwitcher.module.css';

// A press in the menu would focus the field again, and so reopen the menu.
const keepClosed = (e: MouseEvent) => e.preventDefault();

/**
 * The connected GraphQL source, as `<name> — <url>`, and a quick switch to the
 * user's other sources, to those plugins offer, or to a new one.
 */
export function SourceSwitcher({ size }: { size: 'small' | 'middle' }) {
  const navigate = useNavigate();
  const { current, currentName, groups, switchTo } = useSourceSwitcher();
  const select = useRef<RefSelectProps>(null);
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () =>
      groups.map((g) => ({
        label: g.label,
        title: g.label,
        options: g.options.map((o) => ({ value: o.url, label: o.label })),
      })),
    [groups],
  );
  const names = useMemo(() => new Map(groups.flatMap((g) => g.options.map((o) => [o.url, o.name]))), [groups]);

  // Leaving the field too, so that the next click opens the menu again.
  const close = () => {
    setOpen(false);
    select.current?.blur();
  };
  const pick = (url: string, name?: string) => {
    close();
    switchTo(url, name);
  };

  return (
    <Select
      ref={select}
      className={styles.switcher}
      size={size}
      variant="borderless"
      aria-label="GraphQL source"
      prefix={<ApiOutlined className={styles.icon} />}
      showSearch={{ optionFilterProp: 'label' }}
      open={open}
      onOpenChange={setOpen}
      value={current ?? undefined}
      options={options}
      onChange={(url: string) => pick(url)}
      labelRender={({ value }) => <SourceOptionLabel url={String(value)} name={currentName} />}
      optionRender={({ value }) => <SourceOptionLabel url={String(value)} name={names.get(String(value))} />}
      popupMatchSelectWidth={false}
      classNames={{ popup: { root: styles.popup } }}
      popupRender={(menu) => (
        <>
          {menu}
          <Divider className={styles.divider} />
          <AddSourceForm onAdd={pick} />
          <Flex justify="end">
            <Button
              type="link"
              size="small"
              icon={<SettingOutlined />}
              onMouseDown={keepClosed}
              onClick={() => {
                close();
                navigate('/settings?section=connection');
              }}
            >
              Rename or remove sources
            </Button>
          </Flex>
        </>
      )}
    />
  );
}
