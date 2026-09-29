import React, { Component, ErrorInfo, ReactNode } from 'react';
import { 
  APP_RELEASE_LABEL, 
  APP_VERSION, 
  STABLE_BASELINE_VERSION, 
  executeEmergencyFallbackToStableV1, 
  exportSnapshotToFile,
  recordCrashAndCheckFallback 
} from '../config/version';
import { AlertTriangle, RotateCcw, Download, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  autoFallbackTriggered: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    autoFallbackTriggered: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] Captured runtime exception:', error, errorInfo);
    const shouldAutoFallback = recordCrashAndCheckFallback();
    this.setState({ errorInfo, autoFallbackTriggered: shouldAutoFallback });
  }

  private handleFallbackToStable = async () => {
    await executeEmergencyFallbackToStableV1();
  };

  private handleExportBackup = () => {
    exportSnapshotToFile();
  };

  private handleHardReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'An unexpected runtime issue occurred.';

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-sky-500 selection:text-white">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Top Status Header */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">{APP_RELEASE_LABEL}</h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Safe Fallback Mode
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated recovery protection for production patch releases
                </p>
              </div>
            </div>

            {/* Error Diagnostics Box */}
            <div className="p-4 bg-slate-950/90 rounded-2xl border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span className="font-mono">Current Version: {APP_VERSION}</span>
                <span className="font-mono text-emerald-400">Stable Baseline: v{STABLE_BASELINE_VERSION}</span>
              </div>
              <p className="font-mono text-rose-400 break-words leading-relaxed text-[11px] bg-rose-950/30 p-2.5 rounded-xl border border-rose-900/40">
                {errorMsg}
              </p>
            </div>

            {/* Explanation & Action Notice */}
            <div className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
              <p>
                The application encountered an error while executing the current release. Your business database, customer balances, and delivery records remain safely stored in the cloud.
              </p>
              <p className="text-slate-400 text-[11px]">
                You can instantly rollback to the stable baseline version, export a data backup, or reload cleanly.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleFallbackToStable}
                className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-600/20 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Fallback to Stable v{STABLE_BASELINE_VERSION} & Clear Cache</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={this.handleExportBackup}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-850 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Backup</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleHardReload}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-850 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Hard Refresh</span>
                </button>
              </div>
            </div>

            <div className="text-center pt-1">
              <span className="text-[11px] text-slate-500 font-mono">
                Water Distributor Engine • Fault-Tolerant Production Fallback
              </span>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
