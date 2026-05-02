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
import { Loader2, Send, ThumbsUp, ThumbsDown, Check } from "lucide-react"
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
  const [feedbackVerdict, setFeedbackVerdict] = useState<
    "success" | "failure" | null
  >(null)
  const [feedbackComment, setFeedbackComment] = useState("")
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [feedbackSending, setFeedbackSending] = useState(false)

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
  const isIdle = status === "ready" && messages.length > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || status === "streaming" || status === "submitted") return
    sendMessage({ text: input })
    setInput("")
  }

  const lastAssistantId = () =>
    [...messages].reverse().find((m) => m.role === "assistant")?.id

  const submitVerdict = async (verdict: "success" | "failure") => {
    setFeedbackVerdict(verdict)
    setFeedbackSending(true)
    try {
      await fetch(`/api/mate/${mate.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "verdict",
          outcome: verdict,
          reference_id: lastAssistantId(),
        }),
      })
    } finally {
      setFeedbackSending(false)
    }
  }

  const submitLesson = async (text: string) => {
    setFeedbackSending(true)
    try {
      await fetch(`/api/mate/${mate.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "lesson",
          lesson: text,
          reference_id: lastAssistantId(),
        }),
      })
      setFeedbackSubmitted(true)
    } finally {
      setFeedbackSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col gap-0 overflow-hidden p-0 top-0 left-0 translate-x-0 translate-y-0 h-dvh w-screen max-w-none rounded-none border-0 sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:h-[85dvh] sm:w-[680px] sm:max-w-[92vw] sm:rounded-lg sm:border"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full opacity-30 blur-3xl"
          style={{ background: mate.color }}
        />

        <DialogHeader className="relative shrink-0 border-b border-border/30 px-6 pb-4 pt-6">
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
          className="relative min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4"
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

          {isIdle && (
            <div className="mt-2 mr-8 rounded-xl border border-border/50 bg-background/60 p-3">
              {feedbackVerdict === null ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Did this help {mate.name} learn? (+5 xp)
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => submitVerdict("success")}
                      disabled={feedbackSending}
                      title="Helpful"
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => submitVerdict("failure")}
                      disabled={feedbackSending}
                      title="Needs work"
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : feedbackSubmitted ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-600" />
                  Thanks — captured.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    {feedbackVerdict === "success" ? "Marked helpful." : "Marked needs work."}
                    {" Add a lesson? (optional)"}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="What should it do differently next time?"
                      className="rounded-md"
                    />
                    <Button
                      size="sm"
                      onClick={() => submitLesson(feedbackComment)}
                      disabled={feedbackSending || !feedbackComment.trim()}
                    >
                      {feedbackSending ? "..." : "Save"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative flex shrink-0 items-center gap-2 border-t border-border/30 bg-background/80 px-6 py-4"
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
