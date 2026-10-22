import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App as AntdApp } from 'antd';
import 'antd/dist/reset.css';
import './shared/design/badetitou.css';
import { App } from './App';
import { PluginRuntime } from './app/PluginRuntime';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PluginRuntime>
      <AntdApp>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
      </AntdApp>
    </PluginRuntime>
  </React.StrictMode>,
);
