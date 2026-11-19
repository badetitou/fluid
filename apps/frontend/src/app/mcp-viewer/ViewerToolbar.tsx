import { ArrowLeftOutlined, CommentOutlined, CompressOutlined, ExpandOutlined } from '@ant-design/icons';
import { Button, Flex } from 'antd';

interface Props {
  canGoBack: boolean;
  onBack: () => void;
  /** Shown while something is selected. */
  onAsk?: () => void;
  fullscreen: boolean;
  /** Shown when the host offers fullscreen. */
  onToggleFullscreen?: () => void;
}

/** Above the view: back after a link, ask about the selection, fullscreen. */
export function ViewerToolbar({ canGoBack, onBack, onAsk, fullscreen, onToggleFullscreen }: Props) {
  if (!canGoBack && !onAsk && !onToggleFullscreen) return null;
  return (
    <Flex gap={8} justify="flex-end" wrap>
      {canGoBack && (
        <Button size="small" icon={<ArrowLeftOutlined />} onClick={onBack}>
          Back
        </Button>
      )}
      {onAsk && (
        <Button size="small" icon={<CommentOutlined />} onClick={onAsk}>
          Ask about this
        </Button>
      )}
      {onToggleFullscreen && (
        <Button
          size="small"
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          icon={fullscreen ? <CompressOutlined /> : <ExpandOutlined />}
          onClick={onToggleFullscreen}
        />
      )}
    </Flex>
  );
}
