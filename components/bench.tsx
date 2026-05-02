"use client"

import type { Mate } from "@/lib/types"
import { MateCard } from "./mate-card"

interface BenchProps {
  mates: Mate[]
  roster: Mate[]
  onMateClick?: (mate: Mate) => void
  onRecruit?: (mate: Mate) => void
}

export function Bench({ mates, roster, onMateClick, onRecruit }: BenchProps) {
  return (
    <div className="space-y-6">
      {mates.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Bench ({mates.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mates.map((mate) => (
              <MateCard
                key={mate.id}
                mate={mate}
                variant="full"
                onClick={() => onMateClick?.(mate)}
              />
            ))}
          </div>
        </div>
      )}

      {roster.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Available to Recruit ({roster.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((mate) => (
              <div key={mate.id} className="relative">
                <MateCard
                  mate={mate}
                  variant="full"
                  onClick={() => onRecruit?.(mate)}
                  className="opacity-70 hover:opacity-100"
                />
                <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Recruit
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mates.length === 0 && roster.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-muted-foreground">No mates on the bench</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Recruit new mates or forge custom ones
          </p>
        </div>
      )}
    </div>
  )
}
