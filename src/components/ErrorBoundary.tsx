"use client";
import { Component, ReactNode } from "react";

export default class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return this.props.fallback || (
        <div style={{ padding: 24, color: "var(--text-primary)" }}>
          <h2>Something went wrong</h2>
          <pre style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
            {(this.state.error as Error).message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
