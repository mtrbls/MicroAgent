export type AvatarShape = "circle" | "hexagon" | "triangle" | "square" | "diamond" | "oval"

export type Archetype = "correspondence" | "scheduler" | "research" | "money" | "health" | "memory" | "code" | "deals" | "custom"

export type MateStatus = "idle" | "working" | "awaiting_user" | "off_duty"

export type ToolBinding = {
  mcp_server: string
  mcp_url: string
  scope: string[]
}

export type VoiceSpec = {
  register: "formal" | "casual" | "terse" | "warm"
  signature_phrases: string[]
  forbidden_phrases: string[]
}

export type ScheduleCadence = "manual" | "daily" | "weekdays" | "weekly"

export type Schedule = {
  cadence: ScheduleCadence
  /** Local time in HH:MM 24h, when cadence != "manual". */
  time?: string
  /** 0=Sun..6=Sat, when cadence == "weekly". */
  day?: number
}

export type Mate = {
  id: string
  user_id: string
  name: string
  archetype: Archetype
  avatar_shape: AvatarShape
  color: string
  tagline: string
  voice: VoiceSpec
  system_prompt_template: string
  tools: ToolBinding[]
  confidence_threshold: number
  level: number
  experience: number
  episode_count: number
  status: MateStatus
  last_active: string
  on_active_squad: boolean
  is_recruited: boolean
  created_at: string
  schedule?: Schedule | null
}

export type Episode = {
  id: string
  mate_id: string
  timestamp: string
  user_input: string | null
  action_taken: string
  outcome: "completed_autonomously" | "completed_with_edits" | "queued_for_approval" | "rejected" | "failed"
  user_edited: boolean
  edit_distance: number | null
  confidence: number
  duration_ms: number
}

export type MemoryFact = {
  id: string
  mate_id: string
  fact: string
  source_episode_id: string | null
  confidence: number
  created_at: string
  last_referenced: string
}

export type Exemplar = {
  id: string
  mate_id: string
  context: string
  output: string
  user_accepted: boolean
  episode_id: string
  created_at: string
}

export type TrainerMessage = {
  id: string
  user_id: string
  timestamp: string
  author: "user" | "trainer" | string
  content: string
}
