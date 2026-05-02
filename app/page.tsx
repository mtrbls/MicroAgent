"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import useSWR, { mutate } from "swr"
import type { Mate } from "@/lib/types"
import { MateRow } from "@/components/mate-row"
import { MateCard } from "@/components/mate-card"
import { MateDetail } from "@/components/mate-detail"
import { ForgeFlow } from "@/components/forge-flow"
import { LaunchModal } from "@/components/launch-modal"
import { McpSetupModal } from "@/components/mcp-setup-modal"
import { Button } from "@/components/ui/button"
import { Plus, RefreshCw, LogOut } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface SquadData {
  mates: Mate[]
}

export default function HomePage() {
  const { data, isLoading } = useSWR<SquadData>("/api/squad", fetcher, {
    refreshInterval: 5000,
  })

  const [selectedMate, setSelectedMate] = useState<Mate | null>(null)
  const [mateDetailOpen, setMateDetailOpen] = useState(false)
  const [launchMate, setLaunchMate] = useState<Mate | null>(null)
  const [forgeOpen, setForgeOpen] = useState(false)
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

  const handleForgeComplete = useCallback((mate: Mate) => {
    mutate("/api/squad")
    // Defer opening the second modal until ForgeFlow's close animation
    // (~200ms) finishes, otherwise the two dialogs stack briefly and the
    // closing dialog's footer leaks behind the new one.
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
              onClick={() => setForgeOpen(true)}
              className="rounded-none border-2 border-foreground"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 md:max-w-6xl md:px-6">
        {mates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Setting up your starter pack...</p>
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

      <ForgeFlow
        open={forgeOpen}
        onOpenChange={setForgeOpen}
        onComplete={handleForgeComplete}
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
