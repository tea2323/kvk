import React from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[React ErrorBoundary caught error]:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0b0f] text-slate-200">
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#0f1117] border border-rose-500/30 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h2 className="font-sans font-bold text-white text-lg tracking-tight">
                {this.props.title || 'Page Encountered an Error'}
              </h2>
              <p className="font-sans text-xs text-slate-400 mt-1">
                A component encountered an issue during rendering. You can reload the page or return to the booking form.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-black/60 border border-[#1c1f2e] text-left text-xs font-mono text-rose-300 overflow-x-auto max-h-36">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => { window.location.hash = '#/' }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-sans text-xs font-semibold bg-[#1c1f2e] hover:bg-[#2a2d3a] text-slate-300 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Go to Form</span>
              </button>

              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-sans text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
