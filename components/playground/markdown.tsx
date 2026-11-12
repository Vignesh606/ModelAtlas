"use client";

import { memo, useRef, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/ui/copy-button";

/*
 * Renders model output as Markdown. react-markdown builds React elements
 * (it never injects raw HTML), so model output can't run scripts. GFM adds
 * tables and task lists; rehype-highlight adds syntax colors to fenced code.
 */

function CodeBlock({ node: _node, children, ...props }: ComponentPropsWithoutRef<"pre"> & { node?: unknown }) {
  const ref = useRef<HTMLPreElement>(null);
  return (
    <div className="group/code relative">
      <pre ref={ref} {...props}>
        {children}
      </pre>
      <CopyButton
        getText={() => ref.current?.textContent ?? ""}
        label="Copy code"
        className="absolute top-2 right-2 bg-surface opacity-0 group-hover/code:opacity-100 focus-visible:opacity-100"
      />
    </div>
  );
}

function ExternalLink({ node: _node, ...props }: ComponentPropsWithoutRef<"a"> & { node?: unknown }) {
  return <a {...props} target="_blank" rel="noopener noreferrer" />;
}

// Memoized: while one message streams, the others don't re-parse their markdown.
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="chat-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
        components={{ pre: CodeBlock, a: ExternalLink }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
