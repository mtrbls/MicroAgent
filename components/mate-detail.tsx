"use client"

import { useState, useEffect, useRef } from "react"
import type { Mate, Episode, MemoryFact } from "@/lib/types"
import { MateAvatar } from "./avatar"
import { LevelBadge } from "./level-badge"
import { EpisodeLog } from "./episode-log"
import { MemoryFacts } from "./memory-facts"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Trash2, Link2, Check, ExternalLink, Send } from "lucide-react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Input } from "@/components/ui/input"
import { MarkdownMessage } from "./markdown-message"

interface MateDetailProps {
  mate: Mate | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onArchive?: (mateId: string) => void
  /** When this number changes, auto-send a launch message to the mate. */
  launchKey?: number
}

interface MateDetailData {
  mate: Mate
  episodes: Episode[]
  memoryFacts: MemoryFact[]
}

export function MateDetail({ mate, open, onOpenChange, onArchive, launchKey }: MateDetailProps) {
  const [data, setData] = useState<MateDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [confidenceThreshold, setConfidenceThreshold] = useState(mate?.confidence_threshold ?? 0.7)
  const [authStatus, setAuthStatus] = useState<Record<string, { connected: boolean; authUrl?: string }>>({})
  const [authLoading, setAuthLoading] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const lastLaunchKey = useRef<number | undefined>(undefined)

  const { messages, sendMessage, status } = useChat({
    id: mate?.id,
    transport: new DefaultChatTransport({ api: `/api/mate/${mate?.id}/act` }),
  })

  useEffect(() => {
    if (mate?.id && open) {
      setLoading(true)
      fetch(`/api/mate/${mate.id}`)
        .then((res) => res.json())
        .then((d) => {
          setData(d)
          setConfidenceThreshold(d.mate?.confidence_threshold ?? 0.7)
        })
        .catch(console.error)
        .finally(() => setLoading(false))

      setAuthLoading(true)
      fetch(`/api/mate/${mate.id}/auth`)
        .then((res) => res.json())
        .then((d) => setAuthStatus(d.connections || {}))
        .catch(console.error)
        .finally(() => setAuthLoading(false))
    }
  }, [mate?.id, open])

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages])

  // Auto-fire the mate's one action when a launch is requested.
  useEffect(() => {
    if (!open || !mate?.id || launchKey === undefined) return
    if (lastLaunchKey.current === launchKey) return
    lastLaunchKey.current = launchKey
    sendMessage({ text: "Run your action now." })
  }, [launchKey, open, mate?.id, sendMessage])

  if (!mate) return null

  const handleConfidenceChange = async (value: number[]) => {
    setConfidenceThreshold(value[0])
    await fetch(`/api/mate/${mate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confidence_threshold: value[0] }),
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col sm:max-w-[50vw]">
        <SheetHeader>
          <div className="flex items-start gap-4">
            <MateAvatar name={mate.name} color={mate.color} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <SheetTitle>{mate.name}</SheetTitle>
                <LevelBadge level={mate.level} />
              </div>
              <p className="text-sm capitalize text-muted-foreground">{mate.archetype}</p>
              <p className="mt-1 text-sm text-foreground/80">{mate.tagline}</p>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="chat" className="mt-4 flex min-h-0 flex-1 flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="chat" className="flex-1">
              Chat
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1">
              Activity
            </TabsTrigger>
            <TabsTrigger value="memory" className="flex-1">
              Memory
            </TabsTrigger>
            <TabsTrigger value="connections" className="flex-1">
              Apps
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="m-0 mt-4 flex min-h-0 flex-1 flex-col">
            <div ref={chatScrollRef} className="flex-1 space-y-3 overflow-y-auto pr-2">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Ask {mate.name} to do something...
                </p>
              ) : (
                messages.map((msg) => {
                  const text =
                    msg.parts
                      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                      .map((p) => p.text)
                      .join("\n\n") || ""
                  return (
                    <div
                      key={msg.id}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "ml-8 bg-primary text-primary-foreground"
                          : "mr-8 bg-secondary text-secondary-foreground"
                      }`}
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
                <div className="mr-8 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
                    Thinking...
                  </span>
                </div>
              )}
            </div>
            <form
              className="mt-3 flex gap-2 border-t border-border pt-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (chatInput.trim()) {
                  sendMessage({ text: chatInput })
                  setChatInput("")
                }
              }}
            >
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Message ${mate.name}...`}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={status === "streaming"}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="activity" className="m-0 mt-4 min-h-0 flex-1 overflow-auto">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : (
              <EpisodeLog episodes={data?.episodes || []} />
            )}
          </TabsContent>

          <TabsContent value="memory" className="m-0 mt-4 min-h-0 flex-1 overflow-auto">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : (
              <MemoryFacts facts={data?.memoryFacts || []} />
            )}
          </TabsContent>

          <TabsContent value="connections" className="m-0 mt-4 min-h-0 flex-1 overflow-auto">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect apps to give {mate.name} real capabilities.
              </p>
              {authLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : Object.keys(authStatus).length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No apps configured for this mate.
                </div>
              ) : (
                Object.entries(authStatus).map(([app, s]) => (
                  <div
                    key={app}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <Link2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium capitalize">{app.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.connected ? "Connected" : "Not connected"}
                        </p>
                      </div>
                    </div>
                    {s.connected ? (
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <Check className="h-4 w-4" />
                        Active
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (s.authUrl) window.open(s.authUrl, "_blank")
                        }}
                      >
                        Connect
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="m-0 mt-4 min-h-0 flex-1 overflow-auto">
            <div className="space-y-6">
              <div>
                <h4 className="mb-3 text-sm font-medium text-foreground">
                  Confidence Threshold: {Math.round(confidenceThreshold * 100)}%
                </h4>
                <Slider
                  value={[confidenceThreshold]}
                  onValueChange={handleConfidenceChange}
                  min={0.5}
                  max={0.99}
                  step={0.01}
                  className="w-full"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Actions below this confidence will require approval
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={() => onArchive?.(mate.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Archive Mate
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
