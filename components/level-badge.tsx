import { cn } from "@/lib/utils"

interface LevelBadgeProps {
  level: number
  className?: string
}

export function LevelBadge({ level, className }: LevelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      <span className="text-[10px]">LV</span>
      <span className="text-foreground">{level}</span>
    </span>
  )
}
