import { Component, type ErrorInfo, type ReactNode } from 'react';
import { pushFrontendRuntimeError } from '../../frontendRuntimeLogger';
import type { SettingsPanelTabValue } from './SettingsPanelTabSections';

export class SettingsTabErrorBoundary extends Component<
  { activeTab: SettingsPanelTabValue; children: ReactNode },
  { errorMessage: string }
> {
  state = { errorMessage: '' };

  static getDerivedStateFromError(error: unknown) {
    return {
      errorMessage: error instanceof Error ? error.message : '设置页加载失败。',
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error(`Settings tab "${this.props.activeTab}" crashed:`, error, errorInfo);
    pushFrontendRuntimeError('settings', `settings tab "${this.props.activeTab}" crashed`, error, {
      activeTab: this.props.activeTab,
      componentStack: errorInfo.componentStack,
    });

  }

  componentDidUpdate(previousProps: { activeTab: SettingsPanelTabValue }) {
    if (previousProps.activeTab !== this.props.activeTab && this.state.errorMessage) {
      this.setState({ errorMessage: '' });
    }
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <div className="rounded-sm border border-destructive/40 bg-destructive/10 px-4 py-6 text-xs text-destructive">
          <div className="font-semibold">当前页面加载失败，可以重试或切换其他页面。</div>
          <div className="mt-2 break-words opacity-80">{this.state.errorMessage}</div>
          <button
            type="button"
            className="mt-4 rounded-sm border border-destructive/50 px-3 py-2 text-2xs font-semibold uppercase tracking-widest transition-colors hover:bg-destructive/10"
            onClick={() => this.setState({ errorMessage: '' })}
          >
            重试当前页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
