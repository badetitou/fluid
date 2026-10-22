// Example fluid widget plugin. No bundler needed: fluid hands the module its
// React, antd and widget hooks (`host`), and renders what `widgets` returns.

const valueAt = (row, path) =>
  path
    .split('.')
    .reduce(
      (v, key) => (v == null ? undefined : Array.isArray(v) ? v.map((x) => x?.[key]) : v[key]),
      row,
    );

function countValues(rows, field, max) {
  const groups = new Map();
  for (const row of rows) {
    const values = [valueAt(row, field)].flat();
    for (const value of values) {
      if (value == null || value === '') continue;
      const key = String(value);
      const group = groups.get(key) ?? { value, count: 0, rows: [] };
      group.count += 1;
      group.rows.push(row);
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, max);
}

export default function plugin(host) {
  const { React, antd, useWidgetTheme } = host;
  const h = React.createElement;

  function TagCloud({ widget, data, emit }) {
    const theme = useWidgetTheme(widget.type);
    const [selected, setSelected] = React.useState(null);
    const rows = Array.isArray(data) ? data : data == null ? [] : [data];
    const tags = React.useMemo(
      () => countValues(rows, widget.field, widget.max ?? 40),
      [rows, widget.field, widget.max],
    );
    if (tags.length === 0)
      return h(antd.Empty, { image: antd.Empty.PRESENTED_IMAGE_SIMPLE, description: 'No data' });

    const top = tags[0].count;
    const bottom = tags[tags.length - 1].count;
    const size = (count) =>
      top === bottom ? 16 : 12 + Math.round(((count - bottom) / (top - bottom)) * 16);

    return h(
      'div',
      {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 12px',
          alignItems: 'baseline',
          padding: 4,
        },
      },
      tags.map((tag, i) => {
        const active = selected === String(tag.value);
        return h(
          'button',
          {
            key: String(tag.value),
            type: 'button',
            title: `${tag.count} row(s)`,
            onClick: () => {
              setSelected(String(tag.value));
              emit('selected', tag);
            },
            style: {
              all: 'unset',
              cursor: 'pointer',
              fontSize: size(tag.count),
              fontWeight: active ? 700 : 500,
              color: theme.vars.tag ?? theme.series[i % theme.series.length],
              borderBottom: `2px solid ${active ? theme.primary : 'transparent'}`,
              fontFamily: theme.fontFamily,
            },
          },
          String(tag.value),
        );
      }),
    );
  }

  return { widgets: { 'tagcloud/cloud': { Render: TagCloud } } };
}
