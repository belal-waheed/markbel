import React, { Component, ErrorInfo, ReactNode } from 'react';
import Dexie from 'dexie';
import { Database, AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isRecovering: boolean;
}

export class DatabaseErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    isRecovering: false
  };

  public static getDerivedStateFromError(error: Error): State {
    const errorString = (error.message || '').toLowerCase();
    const isDbError = 
      error.name === 'QuotaExceededError' ||
      errorString.includes('database') ||
      errorString.includes('dexie') ||
      errorString.includes('indexeddb') ||
      errorString.includes('idb');
      
    // Only capture storage/DB errors. Let normal React errors bubble up.
    if (isDbError) {
      return { hasError: true, isRecovering: false };
    }
    throw error;
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[DatabaseErrorBoundary] Uncaught database error:', error, errorInfo);
  }

  private handleRecovery = async () => {
    this.setState({ isRecovering: true });
    try {
      console.warn('Initiating disaster recovery: Wiping local IndexedDB vault...');
      await Dexie.delete('MarkbelDatabase');
      console.warn('Local vault wiped. Reloading application to trigger fresh sync.');
      window.location.reload();
    } catch (err) {
      console.error('Failed to wipe database during recovery:', err);
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#090d16] font-sans p-6 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <Database className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-[#e1e4ea] mb-2">Local Vault Corrupted</h1>
          <p className="text-sm text-[#8c91a0] max-w-sm mb-8 leading-relaxed">
            Your browser's offline storage ran out of space or became corrupted. 
            Don't worry—your bookmarks are safely backed up in the cloud.
          </p>
          
          <button
            onClick={this.handleRecovery}
            disabled={this.state.isRecovering}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {this.state.isRecovering ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Rebuilding Vault...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                Recover & Re-sync Data
              </>
            )}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
