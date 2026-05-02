"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function MarkdownMessage({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-foreground/10 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_p]:my-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
