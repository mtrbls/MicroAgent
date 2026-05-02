"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import useSWR, { mutate } from "swr"
import type { Mate } from "@/lib/types"
import { MateRow } from "@/components/mate-row"
import { MateCard } from "@/components/mate-card"
import { MateDetail } from "@/components/mate-detail"
import { CreateAgent } from "@/components/create-agent"
import { LaunchModal } from "@/components/launch-modal"
import { McpSetupModal } from "@/components/mcp-setup-modal"
import { Button } from "@/components/ui/button"
import { Plus, RefreshCw, LogOut } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface SquadData {
  mates: Mate[]
}

const SUGGESTIONS: { emoji: string; label: string; prompt: string }[] = [
  {
    emoji: "📩",
    label: "Sweep my inbox",
    prompt:
      "Read my Gmail inbox from the last 24h. Surface 3-5 important emails (real people awaiting reply or with deadlines). For the rest, label them by category (Newsletter, Promo, Notification) — preview the count and ask before applying.",
  },
  {
    emoji: "📅",
    label: "Brief today's calendar",
    prompt:
      "Brief me on today's Google Calendar — every event from now through end of day in chronological order with attendees and a one-line prep note. Then list my free 30+ minute blocks.",
  },
  {
    emoji: "✍️",
    label: "Draft pending replies",
    prompt:
      "Find emails sent to me in the last 7 days that I haven't replied to and aren't from automated senders. Draft a short reply for each, matching the inferred tone. Don't auto-send.",
  },
  {
    emoji: "🐛",
    label: "Triage Linear tickets",
    prompt:
      "Read newly-created Linear tickets in my workspace. For each, suggest a priority (P0-P3) and an owner based on team labels. Output as a list — don't update tickets unless I confirm.",
  },
  {
    emoji: "📊",
    label: "Standup from yesterday",
    prompt:
      "Pull yesterday's commits from my GitHub repos and draft a Slack standup message: what shipped, what's in flight, any blockers. Don't auto-post.",
  },
  {
    emoji: "📝",
    label: "Capture to Notion",
    prompt:
      "When invoked with a note, append a timestamped entry to my Notion 'Journal' page. Take the text verbatim, prepend the current date and time, append as a new bullet.",
  },
]

export default function HomePage() {
  const { data, isLoading } = useSWR<SquadData>("/api/squad", fetcher, {
    refreshInterval: 5000,
  })

  const [selectedMate, setSelectedMate] = useState<Mate | null>(null)
  const [mateDetailOpen, setMateDetailOpen] = useState(false)
  const [launchMate, setLaunchMate] = useState<Mate | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createInitial, setCreateInitial] = useState<string>("")
  const [mcpSetupMate, setMcpSetupMate] = useState<Mate | null>(null)
  const [seeding, setSeeding] = useState(false)
  const autoSeededRef = useRef(false)

  // Always show the default pack: on first mount, sync the starter pack
  // ONLY if the user has no mates yet. Returning users skip the network
  // call entirely; the server still has a fast-path skip but avoiding
  // the round-trip is the bigger win on slow links.
  useEffect(() => {
    if (autoSeededRef.current) return
    if (!data) return // wait for /api/squad to resolve
    autoSeededRef.current = true
    if (data.mates && data.mates.length > 0) return
    fetch("/api/mates/seed", { method: "POST" })
      .then(() => mutate("/api/squad"))
      .catch(() => {
        // Manual refresh button still available in the header on failure.
      })
  }, [data])

  const handleMateOpen = useCallback((mate: Mate) => {
    setSelectedMate(mate)
    setMateDetailOpen(true)
  }, [])

  const handleMateLaunch = useCallback((mate: Mate) => {
    setLaunchMate(mate)
  }, [])

  const handleArchive = useCallback(async (mateId: string) => {
    await fetch(`/api/mate/${mateId}`, { method: "DELETE" })
    mutate("/api/squad")
    setMateDetailOpen(false)
  }, [])

  const handleCreateComplete = useCallback((mate: Mate) => {
    mutate("/api/squad")
    // Defer opening the MCP setup modal until the create dialog's close
    // animation (~200ms) finishes, otherwise the two dialogs stack briefly
    // and the closing dialog's footer leaks behind the new one.
    setTimeout(() => setMcpSetupMate(mate), 260)
  }, [])

  const handleSeedStarter = useCallback(async () => {
    setSeeding(true)
    try {
      await fetch("/api/mates/seed", { method: "POST" })
      mutate("/api/squad")
    } finally {
      setSeeding(false)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading your mates...</p>
        </div>
      </div>
    )
  }

  const mates = data?.mates || []

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b-2 border-foreground bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 md:max-w-6xl md:px-6">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-base tracking-tight text-foreground">
              μAGENT
            </span>
            {mates.length > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {mates.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              title="Refresh starter pack"
              onClick={handleSeedStarter}
              disabled={seeding}
              className="h-9 w-9"
            >
              <RefreshCw className={`h-4 w-4 ${seeding ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Sign out"
              onClick={async () => {
                await fetch("/api/auth/sign-out", { method: "POST" })
                window.location.href = "/sign-in"
              }}
              className="h-9 w-9"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="rounded-none border-2 border-foreground"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 md:max-w-6xl md:px-6">
        {mates.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-foreground/40 p-6 sm:p-8">
            {!autoSeededRef.current && (
              <div className="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                Setting up the starter pack...
              </div>
            )}
            <h2 className="font-display text-base tracking-tight text-foreground">
              CREATE AN AGENT
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick a starter, or describe your own:
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    setCreateInitial(s.prompt)
                    setCreateOpen(true)
                  }}
                  className="group relative border-2 border-foreground bg-card p-4 text-left transition-transform shadow-[4px_4px_0_0_var(--color-foreground)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--color-foreground)]"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span>{s.emoji}</span>
                    <span>{s.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile: swipable list */}
            <div className="space-y-3 md:hidden">
              {mates.map((mate) => (
                <MateRow
                  key={mate.id}
                  mate={mate}
                  onOpen={() => handleMateOpen(mate)}
                  onLaunch={() => handleMateLaunch(mate)}
                />
              ))}
              <p className="pt-2 text-center text-xs text-muted-foreground/60">
                Tap to open · swipe right to launch
              </p>
            </div>

            {/* Desktop: grid of cards with explicit Launch buttons */}
            <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
              {mates.map((mate) => (
                <MateCard
                  key={mate.id}
                  mate={mate}
                  onOpen={() => handleMateOpen(mate)}
                  onLaunch={() => handleMateLaunch(mate)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <MateDetail
        mate={selectedMate}
        open={mateDetailOpen}
        onOpenChange={setMateDetailOpen}
        onArchive={handleArchive}
      />

      {launchMate && (
        <LaunchModal
          mate={launchMate}
          open={true}
          onOpenChange={(o) => {
            if (!o) setLaunchMate(null)
          }}
        />
      )}

      <CreateAgent
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o)
          if (!o) setCreateInitial("")
        }}
        onComplete={handleCreateComplete}
        initialDescription={createInitial}
      />

      <McpSetupModal
        mate={mcpSetupMate}
        open={!!mcpSetupMate}
        onOpenChange={(o) => {
          if (!o) setMcpSetupMate(null)
        }}
      />
    </main>
  )
}
