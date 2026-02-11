/**
 * LightMarkdown — a lightweight replacement for Streamdown.
 *
 * Streamdown bundles Mermaid (~65 MB) and Shiki (~2.2 MB) for diagram
 * rendering and syntax highlighting. Our app only uses it to render
 * AI-generated prose (no diagrams, no code blocks with highlighting).
 *
 * This component uses react-markdown + remark-gfm (both already in the
 * dependency tree) and produces the same visual output at a fraction of
 * the bundle cost.
 */

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface LightMarkdownProps {
  children: string;
  className?: string;
}

const LightMarkdown = memo(
  ({ children, className }: LightMarkdownProps) => {
    if (!children) return null;

    return (
      <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Ensure links open in new tab
          a: ({ children: linkChildren, href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {linkChildren}
            </a>
          ),
          // Style tables consistently
          table: ({ children: tableChildren, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse" {...props}>
                {tableChildren}
              </table>
            </div>
          ),
          th: ({ children: thChildren, ...props }) => (
            <th className="border border-border px-3 py-2 bg-muted/50 text-left font-semibold text-sm" {...props}>
              {thChildren}
            </th>
          ),
          td: ({ children: tdChildren, ...props }) => (
            <td className="border border-border px-3 py-2 text-sm" {...props}>
              {tdChildren}
            </td>
          ),
          // Simple code blocks without syntax highlighting
          code: ({ children: codeChildren, className: codeClassName, ...props }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code className="bg-muted/60 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                  {codeChildren}
                </code>
              );
            }
            return (
              <pre className="bg-muted/40 rounded-lg p-4 overflow-x-auto my-4">
                <code className="text-sm font-mono" {...props}>
                  {codeChildren}
                </code>
              </pre>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
      </div>
    );
  },
  (prev, next) => prev.children === next.children && prev.className === next.className
);

LightMarkdown.displayName = 'LightMarkdown';

export { LightMarkdown };
export default LightMarkdown;
