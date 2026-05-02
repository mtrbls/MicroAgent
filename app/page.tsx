"use client"

import { useState, useCallback } from "react"
import useSWR, { mutate } from "swr"
import type { Mate } from "@/lib/types"
import { ActiveSquad } from "@/components/active-squad"
import { Bench } from "@/components/bench"
import { TrainerChat } from "@/components/trainer-chat"
import { MateDetail } from "@/components/mate-detail"
import { ForgeFlow } from "@/components/forge-flow"
import { Button } from "@/components/ui/button"
import { MessageSquare, Sparkles } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface SquadData {
  activeSquad: Mate[]
  bench: Mate[]
  roster: Mate[]
}

export default function HomePage() {
  const { data, isLoading } = useSWR<SquadData>("/api/squad", fetcher, {
    refreshInterval: 5000,
  })

  const [selectedMate, setSelectedMate] = useState<Mate | null>(null)
  const [mateDetailOpen, setMateDetailOpen] = useState(false)
  const [trainerOpen, setTrainerOpen] = useState(false)
  const [forgeOpen, setForgeOpen] = useState(false)
  const [forgeDescription, setForgeDescription] = useState("")

  const handleMateClick = useCallback((mate: Mate) => {
    setSelectedMate(mate)
    setMateDetailOpen(true)
  }, [])

  const handleRecruit = useCallback(async (mate: Mate) => {
    await fetch("/api/squad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recruit", mateId: mate.id }),
    })
    mutate("/api/squad")
  }, [])

  const handlePromote = useCallback(async (mateId: string) => {
    await fetch("/api/squad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "promote", mateId }),
    })
    mutate("/api/squad")
    setMateDetailOpen(false)
  }, [])

  const handleDemote = useCallback(async (mateId: string) => {
    await fetch("/api/squad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "demote", mateId }),
    })
    mutate("/api/squad")
    setMateDetailOpen(false)
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading your mates...</p>
        </div>
      </div>
    )
  }

  const activeSquad = data?.activeSquad || []
  const bench = data?.bench || []
  const roster = data?.roster || []

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-foreground">Mon</span>
            <span className="text-sm text-muted-foreground">AI Mates</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForgeOpen(true)}
            >
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

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Active Squad */}
          <ActiveSquad
            mates={activeSquad}
            onMateClick={handleMateClick}
            onEmptySlotClick={() => setTrainerOpen(true)}
          />

          {/* Bench & Roster */}
          <Bench
            mates={bench}
            roster={roster}
            onMateClick={handleMateClick}
            onRecruit={handleRecruit}
          />
        </div>
      </div>

      {/* Slide-overs and Modals */}
      <TrainerChat
        open={trainerOpen}
        onOpenChange={setTrainerOpen}
        onForgeRequested={handleForgeRequested}
      />

      <MateDetail
        mate={selectedMate}
        open={mateDetailOpen}
        onOpenChange={setMateDetailOpen}
        onPromote={handlePromote}
        onDemote={handleDemote}
        onArchive={handleArchive}
      />

      <ForgeFlow
        open={forgeOpen}
        onOpenChange={setForgeOpen}
        initialDescription={forgeDescription}
        onComplete={handleForgeComplete}
      />
    </main>
  )
}
