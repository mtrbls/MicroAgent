"use client"

import { cn } from "@/lib/utils"

interface MateAvatarProps {
  name: string
  color: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
}

export function MateAvatar({ name, color, size = "md", className = "" }: MateAvatarProps) {
  const initial = name?.charAt(0)?.toUpperCase() || "?"

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-semibold text-white shadow-sm",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: color }}
    >
      {initial}
    </div>
  )
}
