import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Something went wrong loading this view
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md leading-relaxed">
            Don't worry! Your course notes and study progress are completely safe. Click below to refresh or return to your dashboard.
          </p>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reload Page</span>
            </button>
            <a
              href="/dashboard"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Go to Dashboard</span>
            </a>
          </div>

          {import.meta.env?.DEV && this.state.error && (
            <div className="mt-8 p-4 rounded-xl bg-slate-900 border border-slate-800 text-left max-w-xl w-full text-xs font-mono text-rose-300 overflow-auto max-h-40">
              {this.state.error.toString()}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
