"use client"

import type { AvatarShape } from "@/lib/types"

interface MateAvatarProps {
  shape: AvatarShape
  color: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 64,
}

export function MateAvatar({ shape, color, size = "md", className = "" }: MateAvatarProps) {
  const s = sizeMap[size]
  const half = s / 2
  const padding = s * 0.1

  const getPath = () => {
    const inner = s - padding * 2
    const innerHalf = inner / 2

    switch (shape) {
      case "circle":
        return `M ${half} ${padding} A ${innerHalf} ${innerHalf} 0 1 1 ${half} ${s - padding} A ${innerHalf} ${innerHalf} 0 1 1 ${half} ${padding}`
      case "hexagon": {
        const r = innerHalf
        const cx = half
        const cy = half
        const points = []
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2
          points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
        }
        return `M ${points.join(" L ")} Z`
      }
      case "triangle": {
        const h = inner * 0.866
        const top = `${half},${padding}`
        const bottomLeft = `${padding},${padding + h}`
        const bottomRight = `${s - padding},${padding + h}`
        return `M ${top} L ${bottomRight} L ${bottomLeft} Z`
      }
      case "square":
        return `M ${padding} ${padding} L ${s - padding} ${padding} L ${s - padding} ${s - padding} L ${padding} ${s - padding} Z`
      case "diamond": {
        return `M ${half} ${padding} L ${s - padding} ${half} L ${half} ${s - padding} L ${padding} ${half} Z`
      }
      case "oval":
        return `M ${half} ${padding} A ${innerHalf * 0.7} ${innerHalf} 0 1 1 ${half} ${s - padding} A ${innerHalf * 0.7} ${innerHalf} 0 1 1 ${half} ${padding}`
      default:
        return `M ${half} ${padding} A ${innerHalf} ${innerHalf} 0 1 1 ${half} ${s - padding} A ${innerHalf} ${innerHalf} 0 1 1 ${half} ${padding}`
    }
  }

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      className={className}
    >
      <path
        d={getPath()}
        fill={color}
        stroke={color}
        strokeWidth={1.5}
        opacity={0.9}
      />
      <path
        d={getPath()}
        fill="none"
        stroke="white"
        strokeWidth={1}
        opacity={0.2}
      />
    </svg>
  )
}
