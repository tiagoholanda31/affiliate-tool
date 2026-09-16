import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

import { cn } from "@/lib/utils";

/**
 * Markdown sanitizado para descrições de produto (docs/spec/04).
 * Sem `dangerouslySetInnerHTML` cru — o rehype-sanitize remove HTML perigoso.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-3 text-base leading-relaxed text-navy-800",
        "[&_a]:text-teal-700 [&_a]:underline [&_a]:underline-offset-2",
        "[&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-navy-900",
        "[&_h3]:mt-4 [&_h3]:font-display [&_h3]:text-lg [&_h3]:text-navy-900",
        "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
        "[&_p]:text-pretty",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
