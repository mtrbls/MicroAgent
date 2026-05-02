"use client"

import { cn } from "@/lib/utils"

interface MateAvatarProps {
  name: string
  color: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
}

export function MateAvatar({ name, color, size = "md", className = "" }: MateAvatarProps) {
  const seed = encodeURIComponent(name || "agent")
  const bg = (color || "#cccccc").replace("#", "")
  const src = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}&backgroundColor=${bg}`

  return (
    <img
      src={src}
      alt={name}
      className={cn(
        "shrink-0 rounded-md border-2 border-foreground",
        sizeClasses[size],
        className
      )}
      loading="lazy"
    />
  )
}
