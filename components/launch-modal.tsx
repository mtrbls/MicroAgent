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
      <DialogContent className="max-h-[85vh] sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3 text-left">
            <MateAvatar name={mate.name} color={mate.color} size="md" />
            <div className="flex-1">
              <DialogTitle>{mate.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">{mate.tagline}</p>
            </div>
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="max-h-[50vh] min-h-[120px] overflow-y-auto rounded-md border border-border bg-secondary/40 p-3"
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

        <DialogFooter>
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {isStreaming ? "Working..." : isDone ? "Done" : " "}
            </span>
            <Button onClick={() => onOpenChange(false)}>
              {isDone || !isStreaming ? "Close" : "Stop"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
