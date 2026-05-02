"use client"

import { useRef, useState } from "react"
import { useSwipeable } from "react-swipeable"
import type { Mate } from "@/lib/types"
import { MateAvatar } from "./avatar"
import { LevelBadge } from "./level-badge"
import { Play } from "lucide-react"
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

  const statusColors: Record<string, string> = {
    idle: "bg-green-500",
    working: "bg-amber-500 animate-pulse",
    awaiting_user: "bg-blue-500",
    off_duty: "bg-muted-foreground",
  }

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
        setDelta(360)
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
    <div className="relative overflow-hidden rounded-lg border border-border">
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex items-center gap-2 pl-4 text-white transition-colors",
          launchReady ? "bg-emerald-600" : "bg-emerald-500/80"
        )}
        style={{ width: Math.max(delta, 0) }}
      >
        <Play className="h-5 w-5 flex-shrink-0" />
        {delta > 40 && <span className="text-sm font-medium">Launch</span>}
      </div>

      <button
        type="button"
        {...handlers}
        onClick={handleClick}
        className="relative flex w-full items-center gap-3 bg-card p-3 text-left transition-transform"
        style={{
          transform: `translateX(${delta}px)`,
          transition: delta === 0 ? "transform 200ms ease-out" : undefined,
        }}
      >
        <div className="relative flex-shrink-0">
          <MateAvatar name={mate.name} color={mate.color} size="md" />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
              statusColors[mate.status]
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{mate.name}</span>
            <LevelBadge level={mate.level} />
          </div>
          <p className="truncate text-xs text-muted-foreground">{mate.tagline}</p>
        </div>
        <span className="hidden text-xs text-muted-foreground/70 sm:inline">
          swipe → to launch
        </span>
      </button>
    </div>
  )
}
