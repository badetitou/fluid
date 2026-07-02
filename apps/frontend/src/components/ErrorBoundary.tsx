import { Component, type ReactNode } from 'react';
import { Alert } from 'antd';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Short label shown in the fallback message (e.g. the column title). */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors from its subtree and shows an inline message instead of
 * letting the whole app unmount into a blank screen. Used to isolate each Miller
 * column so one failing perspective cannot take down the rest of the navigation.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16 }}>
          <Alert
            type="error"
            showIcon
            message={this.props.label ? `${this.props.label} failed to render` : 'Something went wrong'}
            description={this.state.error.message}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
