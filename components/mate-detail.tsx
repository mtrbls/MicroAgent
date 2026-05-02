"use client"

import { useState, useEffect, useRef } from "react"
import type { Mate, Episode, Schedule, ScheduleCadence } from "@/lib/types"
import { MateAvatar } from "./avatar"
import { ExperienceBar } from "./experience-bar"
import { EpisodeLog } from "./episode-log"
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
}

export function MateDetail({ mate, open, onOpenChange, onArchive }: MateDetailProps) {
  return (
    <Sheet open={open && !!mate} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col sm:max-w-[50vw]">
        {mate ? (
          <MateDetailContent mate={mate} onArchive={onArchive} />
        ) : (
          <SheetTitle className="sr-only">Mate detail</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  )
}

interface MateDetailContentProps {
  mate: Mate
  onArchive?: (mateId: string) => void
}

interface MateDetailData {
  mate: Mate
  episodes: Episode[]
}

function MateDetailContent({ mate, onArchive }: MateDetailContentProps) {
  const [data, setData] = useState<MateDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [confidenceThreshold, setConfidenceThreshold] = useState(mate.confidence_threshold ?? 0.7)
  const [authStatus, setAuthStatus] = useState<Record<string, { connected: boolean; authUrl?: string }>>({})
  const [authLoading, setAuthLoading] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const [schedule, setSchedule] = useState<Schedule>(
    mate.schedule ?? { cadence: "manual" }
  )

  const { messages, sendMessage, status } = useChat({
    id: mate.id,
    transport: new DefaultChatTransport({ api: `/api/mate/${mate.id}/act` }),
  })

  useEffect(() => {
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
  }, [mate.id])

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages])

  const handleConfidenceChange = async (value: number[]) => {
    setConfidenceThreshold(value[0])
    await fetch(`/api/mate/${mate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confidence_threshold: value[0] }),
    })
  }

  const persistSchedule = async (next: Schedule) => {
    setSchedule(next)
    await fetch(`/api/mate/${mate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schedule: next.cadence === "manual" ? null : next,
      }),
    })
  }

  return (
    <>
      <SheetHeader>
        <div className="flex items-start gap-4">
          <MateAvatar name={mate.name} color={mate.color} size="lg" />
          <div className="flex-1">
            <SheetTitle>{mate.name}</SheetTitle>
            <p className="text-sm capitalize text-muted-foreground">{mate.archetype}</p>
            <p className="mt-1 text-sm text-foreground/80">{mate.tagline}</p>
          </div>
        </div>
      </SheetHeader>
      <ExperienceBar experience={mate.experience ?? 0} className="mt-3" />

      <Tabs defaultValue="chat" className="mt-4 flex min-h-0 flex-1 flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="chat" className="flex-1">
            Chat
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1">
            Activity
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

        <TabsContent value="settings" className="m-0 mt-4 min-h-0 flex-1 overflow-auto">
          <div className="space-y-6">
            <div>
              <h4 className="mb-3 text-sm font-medium text-foreground">
                Connected apps
              </h4>
              {authLoading ? (
                <div className="py-4 text-sm text-muted-foreground">Loading...</div>
              ) : Object.keys(authStatus).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No apps configured for this mate.
                </p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(authStatus).map(([app, s]) => (
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
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-6">
              <h4 className="mb-3 text-sm font-medium text-foreground">Schedule</h4>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground">Cadence</label>
                  <select
                    value={schedule.cadence}
                    onChange={(e) => {
                      const cadence = e.target.value as ScheduleCadence
                      const next: Schedule =
                        cadence === "manual"
                          ? { cadence }
                          : {
                              cadence,
                              time: schedule.time ?? "09:00",
                              ...(cadence === "weekly"
                                ? { day: schedule.day ?? 1 }
                                : {}),
                            }
                      void persistSchedule(next)
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="manual">Manual (no auto-run)</option>
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                {schedule.cadence !== "manual" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <label className="text-xs text-muted-foreground">Time</label>
                      <input
                        type="time"
                        value={schedule.time ?? "09:00"}
                        onChange={(e) =>
                          void persistSchedule({ ...schedule, time: e.target.value })
                        }
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    {schedule.cadence === "weekly" && (
                      <div className="grid gap-2">
                        <label className="text-xs text-muted-foreground">Day</label>
                        <select
                          value={schedule.day ?? 1}
                          onChange={(e) =>
                            void persistSchedule({
                              ...schedule,
                              day: Number(e.target.value),
                            })
                          }
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value={0}>Sunday</option>
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                          <option value={6}>Saturday</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {schedule.cadence === "manual"
                    ? "This action only runs when you tap Launch."
                    : "Schedules are saved here. Wire a Vercel cron to /api/cron/run to fire them automatically."}
                </p>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h4 className="mb-3 text-sm font-medium text-foreground">
                Confidence threshold: {Math.round(confidenceThreshold * 100)}%
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

            <div className="border-t border-border pt-6">
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => onArchive?.(mate.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Archive mate
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}
