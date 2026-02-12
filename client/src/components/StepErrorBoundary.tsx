import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Human-readable name of the step/section, e.g. "Revenue Analysis" */
  stepName?: string;
  /** Optional fallback UI to render instead of the default error card */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * A lightweight error boundary designed to wrap individual steps/sections
 * of the property analysis flow. Unlike the global ErrorBoundary, this one
 * does NOT take down the entire page — it shows a contained error card
 * and lets the user retry just that section.
 */
class StepErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[StepErrorBoundary] Error in "${this.props.stepName || 'unknown step'}":`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-6 my-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-800 mb-1">
                {this.props.stepName
                  ? `Error loading ${this.props.stepName}`
                  : "Something went wrong in this section"}
              </h3>
              <p className="text-xs text-red-600 mb-3">
                {this.state.error?.message || "An unexpected error occurred."}
              </p>
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default StepErrorBoundary;
