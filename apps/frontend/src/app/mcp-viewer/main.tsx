import ReactDOM from 'react-dom/client';
import { App as AntdApp } from 'antd';
import 'antd/dist/reset.css';
import { McpViewer } from './McpViewer';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  // No StrictMode: its double-run effects would make the host see two `ui/initialize`.
  <AntdApp>
    <McpViewer />
  </AntdApp>,
);
