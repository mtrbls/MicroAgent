"use client"

import { useState, useCallback } from "react"
import useSWR, { mutate } from "swr"
import type { Mate } from "@/lib/types"
import { MateRow } from "@/components/mate-row"
import { TrainerChat } from "@/components/trainer-chat"
import { MateDetail } from "@/components/mate-detail"
import { ForgeFlow } from "@/components/forge-flow"
import { LaunchModal } from "@/components/launch-modal"
import { Button } from "@/components/ui/button"
import { MessageSquare, Sparkles, RefreshCw } from "lucide-react"

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
  const [trainerOpen, setTrainerOpen] = useState(false)
  const [forgeOpen, setForgeOpen] = useState(false)
  const [forgeDescription, setForgeDescription] = useState("")
  const [seeding, setSeeding] = useState(false)

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

  const handleForgeComplete = useCallback(() => {
    mutate("/api/squad")
    setForgeDescription("")
  }, [])

  const handleForgeRequested = useCallback((description: string) => {
    setForgeDescription(description)
    setForgeOpen(true)
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
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <span className="text-xl font-bold text-foreground">Mates</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              title="Refresh starter pack"
              onClick={handleSeedStarter}
              disabled={seeding}
            >
              <RefreshCw className={`h-4 w-4 ${seeding ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setForgeOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Forge
            </Button>
            <Button size="sm" onClick={() => setTrainerOpen(true)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Trainer
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {mates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-muted-foreground">No mates yet</p>
            <p className="mt-1 mb-5 text-sm text-muted-foreground/70">
              Add the starter pack, or forge your own.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={handleSeedStarter} disabled={seeding}>
                {seeding ? "Adding..." : "Add starter pack"}
              </Button>
              <Button variant="outline" onClick={() => setForgeOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Forge
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
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
        )}
      </div>

      <TrainerChat
        open={trainerOpen}
        onOpenChange={setTrainerOpen}
        onForgeRequested={handleForgeRequested}
      />

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
        initialDescription={forgeDescription}
        onComplete={handleForgeComplete}
      />
    </main>
  )
}
