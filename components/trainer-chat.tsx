"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Send, Bot, User, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TrainerChatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onForgeRequested?: (description: string) => void
}

export function TrainerChat({ open, onOpenChange, onForgeRequested }: TrainerChatProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/trainer" }),
  })

  const isLoading = status === "streaming" || status === "submitted"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Check for forge requests in tool calls (AI SDK v6: parts are typed as `tool-<name>`).
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role !== "assistant" || !lastMessage.parts) return
    for (const part of lastMessage.parts as Array<{ type: string; state?: string; output?: unknown }>) {
      if (part.type === "tool-forge_mate" && part.state === "output-available") {
        const out = part.output as { action?: string; description?: string } | undefined
        if (out?.action === "open_forge" && out.description) {
          onForgeRequested?.(out.description)
        }
      }
    }
  }, [messages, onForgeRequested])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput("")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Trainer
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-4" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bot className="mb-3 h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">{"I'm"} your Trainer</p>
                <p className="mt-1 text-sm text-muted-foreground/70">
                  I route tasks to your mates and help you forge new ones
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  )}
                >
                  {(message.parts as Array<{ type: string; text?: string; state?: string; output?: unknown }> | undefined)?.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <p key={index} className="whitespace-pre-wrap text-sm">
                          {part.text}
                        </p>
                      )
                    }
                    if (part.type.startsWith("tool-")) {
                      const toolName = part.type.slice("tool-".length)
                      return (
                        <div
                          key={index}
                          className="mt-2 rounded border border-border bg-card p-2 text-xs"
                        >
                          <span className="font-medium text-muted-foreground">
                            Tool: {toolName}
                          </span>
                          {part.state === "output-available" && (
                            <pre className="mt-1 overflow-x-auto text-foreground/80">
                              {JSON.stringify(part.output, null, 2)}
                            </pre>
                          )}
                        </div>
                      )
                    }
                    return null
                  })}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="flex items-center rounded-lg bg-secondary px-4 py-2">
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border pt-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the trainer..."
            className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
