import { useState } from 'react';
import { AutoComplete, Button, Popover, Space, Tooltip } from 'antd';
import { ApartmentOutlined } from '@ant-design/icons';
import { ConceptPathPicker, type PathPickerMode } from '../../entities/concept';

interface PathInputProps {
  mode: PathPickerMode;
  /** For a field: the path of the rows it belongs to. */
  base?: string;
  suggestions: string[];
  /** Injected by Form.Item. */
  value?: string;
  onChange?: (value: string | undefined) => void;
}

const matches = (input: string, option?: { value: string }) =>
  String(option?.value ?? '').toLowerCase().includes(input.toLowerCase());

/** A dot path typed with suggestions, or picked on a graph of the schema. */
export function PathInput({ mode, base, suggestions, value, onChange }: PathInputProps) {
  const [open, setOpen] = useState(false);
  const label = mode === 'path' ? 'Pick the path on the schema graph' : 'Pick the field on the schema graph';

  const select = (picked: string) => {
    onChange?.(picked || undefined);
    setOpen(false);
  };

  return (
    <Space.Compact block>
      <AutoComplete
        allowClear
        value={value}
        onChange={onChange}
        options={suggestions.map((s) => ({ value: s, label: s }))}
        filterOption={matches}
        placeholder="dot.path"
      />
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement="left"
        // Unmounted once hidden, so the graph opens on the current value each time.
        destroyOnHidden
        content={<ConceptPathPicker mode={mode} base={base} value={value} onSelect={select} />}
      >
        <Tooltip title={label}>
          <Button aria-label={label} icon={<ApartmentOutlined />} />
        </Tooltip>
      </Popover>
    </Space.Compact>
  );
}
