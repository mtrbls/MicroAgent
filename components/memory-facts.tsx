"use client"

import type { MemoryFact } from "@/lib/types"
import { Brain } from "lucide-react"

interface MemoryFactsProps {
  facts: MemoryFact[]
}

export function MemoryFacts({ facts }: MemoryFactsProps) {
  if (facts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Brain className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-muted-foreground">No memories stored</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          This mate will learn preferences over time
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {facts.map((fact) => (
        <div
          key={fact.id}
          className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3"
        >
          <Brain className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">{fact.fact}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Confidence: {Math.round(fact.confidence * 100)}%
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
