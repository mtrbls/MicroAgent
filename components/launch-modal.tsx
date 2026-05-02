"use client"

import { useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MateAvatar } from "./avatar"
import { MarkdownMessage } from "./markdown-message"
import { Loader2 } from "lucide-react"
import type { Mate } from "@/lib/types"

interface LaunchModalProps {
  mate: Mate
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LaunchModal({ mate, open, onOpenChange }: LaunchModalProps) {
  const fired = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat({
    id: `${mate.id}-launch`,
    transport: new DefaultChatTransport({ api: `/api/mate/${mate.id}/act` }),
  })

  useEffect(() => {
    if (open && !fired.current) {
      fired.current = true
      sendMessage({ text: "Run your action now." })
    }
  }, [open, sendMessage])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const assistantText =
    messages
      .filter((m) => m.role === "assistant")
      .map(
        (m) =>
          m.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("\n\n") || ""
      )
      .join("\n\n") || ""

  const isStarting = status === "submitted" && !assistantText
  const isStreaming = status === "streaming"
  const isDone = status === "ready" && messages.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full opacity-30 blur-3xl"
          style={{ background: mate.color }}
        />

        <DialogHeader className="relative px-6 pt-6">
          <div className="flex items-start gap-4 text-left">
            <MateAvatar name={mate.name} color={mate.color} size="lg" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {mate.name}
              </DialogTitle>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
                {mate.archetype}
              </p>
              <p className="mt-1.5 text-sm text-foreground/80">{mate.tagline}</p>
            </div>
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="relative mx-6 mt-4 max-h-[50vh] min-h-[140px] overflow-y-auto rounded-xl border border-border/50 bg-secondary/40 p-4"
        >
          {isStarting ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Launching {mate.name}...
            </div>
          ) : assistantText ? (
            <MarkdownMessage>{assistantText}</MarkdownMessage>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for response...</p>
          )}
        </div>

        <DialogFooter className="relative mt-4 border-t border-border/30 bg-background/40 px-6 py-4">
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {isStreaming ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Working
                </span>
              ) : isDone ? (
                "Done"
              ) : (
                " "
              )}
            </span>
            <Button
              onClick={() => onOpenChange(false)}
              variant={isStreaming ? "outline" : "default"}
              className="rounded-full"
            >
              {isDone || !isStreaming ? "Close" : "Stop"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
