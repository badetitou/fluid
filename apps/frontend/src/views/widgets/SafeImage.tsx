import { useState } from 'react';
import { Button, Checkbox, Image, Popconfirm, Space, Tooltip, Typography } from 'antd';
import { PictureOutlined, WarningOutlined } from '@ant-design/icons';
import { checkImageUrl, isHostTrusted, trustHost } from '../imageSafety';
import styles from './SafeImage.module.css';

const SIZE = 96;

/**
 * Renders an image URL coming from data. Nothing is fetched until the URL has
 * passed `checkImageUrl` AND the user confirmed (or trusted the host earlier in
 * this session). See imageSafety.ts for the rationale.
 */
export function SafeImage({ value }: { value: unknown }) {
  const check = checkImageUrl(value);
  const host = check.ok ? check.url.hostname : '';
  const [loaded, setLoaded] = useState(() => check.ok && isHostTrusted(host));
  const [remember, setRemember] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!check.ok) {
    return (
      <Space size={4}>
        <Tooltip title={`Image blocked: ${check.reason}`}>
          <WarningOutlined className={styles.warning} />
        </Tooltip>
        <Typography.Text type="secondary" className={styles.breakAll}>
          {String(value)}
        </Typography.Text>
      </Space>
    );
  }

  const href = check.url.href;

  if (!loaded) {
    return (
      <Popconfirm
        title={`Load an image from ${host}?`}
        description={
          <Space orientation="vertical" size={4} className={styles.prompt}>
            <Typography.Text type="secondary" className={styles.breakAll}>
              {href}
            </Typography.Text>
            <Typography.Text type="secondary">
              Your browser will contact this host, which can see your IP address.
            </Typography.Text>
            <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
              Trust {host} for this session
            </Checkbox>
          </Space>
        }
        okText="Load"
        cancelText="Cancel"
        onConfirm={() => {
          if (remember) trustHost(host);
          setLoaded(true);
        }}
      >
        <Button size="small" icon={<PictureOutlined />}>
          Load image · {host}
        </Button>
      </Popconfirm>
    );
  }

  if (failed) {
    return (
      <Typography.Text type="secondary" className={styles.breakAll}>
        {href}
      </Typography.Text>
    );
  }

  return (
    <Image
      src={href}
      alt=""
      width={SIZE}
      height={SIZE}
      className={styles.image}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
