import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntdApp } from 'antd';
import 'antd/dist/reset.css';
import { McpViewer } from './McpViewer';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AntdApp>
      <McpViewer />
    </AntdApp>
  </React.StrictMode>,
);
