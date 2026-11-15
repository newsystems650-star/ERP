import React from 'react';
import { AlertTriangle, RotateCcw, Sparkles } from 'lucide-react';

interface ModuleErrorBoundaryProps {
  moduleName: string;
  onErrorCaptured: (message: string) => void;
  onOpenAi: () => void;
  children: React.ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ModuleErrorBoundary extends React.Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return { hasError: true, errorMessage: error.message || 'Error inesperado en el módulo' };
  }

  componentDidCatch(error: Error) {
    this.props.onErrorCaptured(`[${this.props.moduleName}] ${error.message}`);
  }

  componentDidUpdate(prevProps: ModuleErrorBoundaryProps) {
    if (prevProps.moduleName !== this.props.moduleName && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-xl mx-auto space-y-4">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <h3 className="font-bold text-base">Error detectado en {this.props.moduleName}</h3>
              <p className="text-xs text-red-600 font-mono mt-0.5">{this.state.errorMessage}</p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            El error quedó registrado para que puedas diagnosticarlo y corregirlo con el Asistente
            IA sin perder tu sesión.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reintentar módulo
            </button>
            <button
              type="button"
              onClick={this.props.onOpenAi}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Corregir con Asistente IA
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
