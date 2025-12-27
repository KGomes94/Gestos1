import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-md w-full">
            <div className="bg-red-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-red-600">
                <AlertTriangle size={32} />
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Algo correu mal</h1>
            <p className="text-gray-500 text-sm mb-6">
              Ocorreu um erro inesperado na aplicação. Os dados estão seguros, mas a interface precisa ser reiniciada.
            </p>
            
            <div className="bg-gray-100 p-3 rounded-lg text-xs font-mono text-left text-gray-600 mb-6 overflow-auto max-h-32 border border-gray-200">
                {this.state.error?.message || 'Erro desconhecido'}
            </div>

            <button
              onClick={() => {
                  localStorage.clear(); // Limpeza de segurança
                  window.location.reload();
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw size={18} /> Reiniciar Aplicação (Limpar Cache)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;