"use client"

import { useEffect, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MateAvatar } from "./avatar"
import { MarkdownMessage } from "./markdown-message"
import { Loader2, Send } from "lucide-react"
import type { Mate } from "@/lib/types"

interface LaunchModalProps {
  mate: Mate
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LaunchModal({ mate, open, onOpenChange }: LaunchModalProps) {
  const fired = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")

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

  const isStarting =
    (status === "submitted" || status === "streaming") && messages.length <= 1

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || status === "streaming" || status === "submitted") return
    sendMessage({ text: input })
    setInput("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
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
          className="relative mx-6 mt-4 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/50 bg-secondary/40 p-4"
        >
          {isStarting && messages.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Launching {mate.name}...
            </div>
          ) : (
            messages
              // Hide the auto "Run your action now." trigger so the user only
              // sees the back-and-forth they explicitly initiated.
              .filter(
                (m, i) =>
                  !(
                    i === 0 &&
                    m.role === "user" &&
                    m.parts?.some(
                      (p) => p.type === "text" && p.text === "Run your action now."
                    )
                  )
              )
              .map((msg) => {
                const text =
                  msg.parts
                    ?.filter(
                      (p): p is { type: "text"; text: string } => p.type === "text"
                    )
                    .map((p) => p.text)
                    .join("\n\n") || ""
                if (!text) return null
                return (
                  <div
                    key={msg.id}
                    className={
                      msg.role === "user"
                        ? "ml-8 rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "mr-8 rounded-xl bg-card px-3 py-2 text-sm"
                    }
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownMessage>{text}</MarkdownMessage>
                    ) : (
                      <p className="whitespace-pre-wrap">{text}</p>
                    )}
                  </div>
                )
              })
          )}
          {(status === "submitted" ||
            (status === "streaming" &&
              messages[messages.length - 1]?.role !== "assistant")) && (
            <div className="mr-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Working
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative mt-4 flex items-center gap-2 border-t border-border/30 bg-background/60 px-6 py-4"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Reply to ${mate.name}...`}
            className="flex-1 rounded-full"
            disabled={status === "streaming" || status === "submitted"}
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full"
            disabled={!input.trim() || status === "streaming" || status === "submitted"}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
