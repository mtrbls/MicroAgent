"use client"

import { useRef, useState } from "react"
import { useSwipeable } from "react-swipeable"
import type { Mate } from "@/lib/types"
import { LevelBadge } from "./level-badge"
import { Play, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface MateRowProps {
  mate: Mate
  onOpen: () => void
  onLaunch: () => void
}

const LAUNCH_THRESHOLD = 90

export function MateRow({ mate, onOpen, onLaunch }: MateRowProps) {
  const [delta, setDelta] = useState(0)
  const swipedRef = useRef(false)
  const animatingRef = useRef(false)

  const handlers = useSwipeable({
    onSwipeStart: () => {
      swipedRef.current = false
    },
    onSwiping: (e) => {
      if (e.dir === "Right" && e.deltaX > 0) {
        setDelta(Math.min(e.deltaX, 140))
      }
    },
    onSwipedRight: (e) => {
      if (e.deltaX > LAUNCH_THRESHOLD) {
        swipedRef.current = true
        animatingRef.current = true
        setDelta(420)
        setTimeout(() => {
          setDelta(0)
          animatingRef.current = false
          onLaunch()
        }, 180)
      } else {
        setDelta(0)
      }
    },
    onSwiped: () => {
      if (!animatingRef.current) setDelta(0)
    },
    trackMouse: true,
    delta: 10,
  })

  const handleClick = () => {
    if (!swipedRef.current) onOpen()
  }

  const launchReady = delta > LAUNCH_THRESHOLD

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-foreground bg-white shadow-[4px_4px_0_0_var(--color-foreground)]">
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex items-center gap-2 pl-5 text-white transition-colors",
          launchReady ? "bg-emerald-600" : "bg-emerald-500/85"
        )}
        style={{ width: Math.max(delta, 0) }}
      >
        <Play className="h-5 w-5 flex-shrink-0 fill-current" />
        {delta > 50 && <span className="text-sm font-medium tracking-tight">Launch</span>}
      </div>

      <button
        type="button"
        {...handlers}
        onClick={handleClick}
        className="relative flex w-full items-center gap-4 bg-white p-4 text-left transition-transform"
        style={{
          transform: `translateX(${delta}px)`,
          transition: delta === 0 ? "transform 220ms ease-out" : undefined,
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold tracking-tight text-foreground">
              {mate.name}
            </span>
            <LevelBadge level={mate.level} />
          </div>
          <p className="truncate text-sm text-foreground/70">{mate.tagline}</p>
        </div>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-foreground/50" />
      </button>
    </div>
  )
}
