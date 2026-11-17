import { useState } from 'react';
import { SendOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import styles from './Chat.module.css';

interface ChatInputProps {
  disabled: boolean;
  onSend: (text: string) => void;
}

/** The message box: Enter sends, Shift+Enter adds a line. */
export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText('');
  };
  return (
    <div className={styles.footer}>
      <Input.TextArea
        className={styles.input}
        value={text}
        autoFocus
        autoSize={{ minRows: 1, maxRows: 6 }}
        placeholder="Ask something… (Enter to send, Shift+Enter for a new line)"
        aria-label="Message"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
          e.preventDefault();
          submit();
        }}
      />
      <Button type="primary" icon={<SendOutlined />} aria-label="Send" disabled={disabled || !text.trim()} onClick={submit} />
    </div>
  );
}
