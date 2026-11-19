import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'حدث خطأ غير متوقع في التطبيق.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#090B0E] p-6"
        >
          <div className="max-w-lg w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] p-8 text-center space-y-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              تعذر إتمام العملية
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
