import { Empty } from 'antd';
import type { CodeWidget as CodeWidgetSpec, DataBinding } from '@fluid/shared';
import { guessLanguage } from '../richtext/richTextModel';
import { CodeLines } from './CodeLines';
import { CodeToolbar } from './CodeToolbar';
import { useCodeView } from './useCodeView';

interface CodeWidgetProps {
  widget: CodeWidgetSpec;
  data: unknown;
  resolve: (binding: DataBinding) => unknown;
}

/** Source code with line numbers and search; a diff when it compares, annotated from the data. */
export function CodeWidget({ widget, data, resolve }: CodeWidgetProps) {
  const view = useCodeView(widget, data, resolve);
  if (!view.source && !view.isDiff) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No code" />;

  return (
    <div>
      <CodeToolbar view={view} compareLabel={widget.compare?.label} searchable={widget.search !== false} />
      <CodeLines
        view={view}
        language={guessLanguage(view.source, widget.language)}
        wrap={widget.wrap ?? false}
        maxHeight={widget.height}
      />
    </div>
  );
}
