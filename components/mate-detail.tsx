"use client"

import { useState, useEffect } from "react"
import type { Mate, Episode, MemoryFact } from "@/lib/types"
import { MateAvatar } from "./avatar"
import { LevelBadge } from "./level-badge"
import { EpisodeLog } from "./episode-log"
import { MemoryFacts } from "./memory-facts"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ArrowUp, ArrowDown, Trash2, Link2, Check, ExternalLink, Send } from "lucide-react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRef } from "react"
import { Input } from "@/components/ui/input"

interface MateDetailProps {
  mate: Mate | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPromote?: (mateId: string) => void
  onDemote?: (mateId: string) => void
  onArchive?: (mateId: string) => void
}

interface MateDetailData {
  mate: Mate
  episodes: Episode[]
  memoryFacts: MemoryFact[]
}

export function MateDetail({
  mate,
  open,
  onOpenChange,
  onPromote,
  onDemote,
  onArchive,
}: MateDetailProps) {
  const [data, setData] = useState<MateDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [confidenceThreshold, setConfidenceThreshold] = useState(mate?.confidence_threshold ?? 0.7)
  const [authStatus, setAuthStatus] = useState<Record<string, { connected: boolean; authUrl?: string }>>({})
  const [authLoading, setAuthLoading] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const chatScrollRef = useRef<HTMLDivElement>(null)
  
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

      // Fetch auth status for connected apps
      setAuthLoading(true)
      fetch(`/api/mate/${mate.id}/auth`)
        .then((res) => res.json())
        .then((d) => {
          console.log("[v0] Auth response:", d)
          setAuthStatus(d.connections || {})
        })
        .catch(console.error)
        .finally(() => setAuthLoading(false))
    }
  }, [mate?.id, open])

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
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
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

        <Tabs defaultValue="chat" className="mt-4 flex-1">
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
            <TabsTrigger value="voice" className="flex-1">
              Voice
            </TabsTrigger>
            <TabsTrigger value="connections" className="flex-1">
              Apps
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">
              Settings
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 flex-1 overflow-auto">
            <TabsContent value="chat" className="m-0 flex h-[400px] flex-col">
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2">
                {messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Ask {mate.name} to do something...
                  </p>
                ) : (
                  messages.map((msg) => {
                    const text = msg.parts?.filter((p): p is { type: "text"; text: string } => p.type === "text").map((p) => p.text).join("") || ""
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "ml-8 bg-primary text-primary-foreground"
                            : "mr-8 bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {text}
                      </div>
                    )
                  })
                )}
                {status === "streaming" && (
                  <div className="mr-8 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
                    Thinking...
                  </div>
                )}
              </div>
              <form
                className="mt-3 flex gap-2"
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

            <TabsContent value="activity" className="m-0">
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : (
                <EpisodeLog episodes={data?.episodes || []} />
              )}
            </TabsContent>

            <TabsContent value="memory" className="m-0">
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : (
                <MemoryFacts facts={data?.memoryFacts || []} />
              )}
            </TabsContent>

            <TabsContent value="voice" className="m-0">
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-medium text-foreground">Register</h4>
                  <p className="rounded-lg bg-secondary px-3 py-2 text-sm capitalize">
                    {mate.voice.register}
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-medium text-foreground">Signature Phrases</h4>
                  <div className="flex flex-wrap gap-2">
                    {mate.voice.signature_phrases.map((phrase, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                      >
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-medium text-foreground">Forbidden Phrases</h4>
                  <div className="flex flex-wrap gap-2">
                    {mate.voice.forbidden_phrases.length > 0 ? (
                      mate.voice.forbidden_phrases.map((phrase, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-destructive/10 px-3 py-1 text-xs text-destructive"
                        >
                          {phrase}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">None specified</span>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="connections" className="m-0">
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
                  Object.entries(authStatus).map(([app, status]) => (
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
                            {status.connected ? "Connected" : "Not connected"}
                          </p>
                        </div>
                      </div>
                      {status.connected ? (
                        <div className="flex items-center gap-1 text-sm text-green-600">
                          <Check className="h-4 w-4" />
                          Active
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            console.log("[v0] Connect clicked, authUrl:", status.authUrl)
                            if (status.authUrl) {
                              window.open(status.authUrl, "_blank")
                            } else {
                              alert("No auth URL available - check console for API response")
                            }
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

            <TabsContent value="settings" className="m-0">
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

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">Squad Management</h4>
                  {mate.on_active_squad ? (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => onDemote?.(mate.id)}
                    >
                      <ArrowDown className="mr-2 h-4 w-4" />
                      Move to Bench
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => onPromote?.(mate.id)}
                    >
                      <ArrowUp className="mr-2 h-4 w-4" />
                      Add to Active Squad
                    </Button>
                  )}
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
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
