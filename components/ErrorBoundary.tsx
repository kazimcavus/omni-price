import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/** Beklenmeyen bir hata olduğunda beyaz ekran yerine mesaj gösterir. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-lg w-full bg-white border border-red-200 rounded-xl p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-red-700">Bir hata oluştu</h1>
          <p className="mt-2 text-sm text-slate-600">
            Uygulama beklenmedik bir hatayla karşılaştı. Sayfayı yenileyip tekrar deneyin.
          </p>
          <pre className="mt-3 max-h-48 overflow-auto rounded bg-slate-100 p-3 text-xs text-slate-700 whitespace-pre-wrap">
            {error.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              Tekrar dene
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              Sayfayı yenile
            </button>
          </div>
        </div>
      </div>
    );
  }
}
