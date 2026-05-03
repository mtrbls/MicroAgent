#!/usr/bin/env -S npx tsx
/**
 * μAgent TUI — same backend API, terminal frontend.
 *
 * Run with: `pnpm tui` (or `pnpm tui --url http://localhost:3000` for a
 * local instance). Stores the session cookie in memory only; quit and
 * you're signed out.
 */

import React, { useEffect, useMemo, useState } from "react"
import { render, Box, Text, useApp, useInput } from "ink"
import TextInput from "ink-text-input"
import SelectInput from "ink-select-input"
import Spinner from "ink-spinner"

const argUrl = process.argv.find((a) => a.startsWith("--url="))?.split("=")[1]
const BASE_URL =
  argUrl ?? process.env.MICROAGENT_URL ?? "https://v0-microagents.vercel.app"

let cookieJar = ""

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (cookieJar) headers.set("Cookie", cookieJar)
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json")
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  const setCookie = res.headers.get("set-cookie")
  if (setCookie) cookieJar = setCookie.split(";")[0]
  return res
}

interface Mate {
  id: string
  name: string
  archetype: string
  tagline: string
  level: number
  experience?: number
  episode_count: number
}

type View =
  | { kind: "auth-email" }
  | { kind: "auth-password"; email: string }
  | { kind: "auth-error"; message: string }
  | { kind: "loading" }
  | { kind: "list"; mates: Mate[] }
  | { kind: "running"; mate: Mate; output: string; lastAssistantId?: string }
  | { kind: "feedback"; mate: Mate; lastAssistantId?: string }
  | { kind: "thanks" }

function App() {
  const { exit } = useApp()
  const [view, setView] = useState<View>({ kind: "auth-email" })
  const [emailDraft, setEmailDraft] = useState("")
  const [passwordDraft, setPasswordDraft] = useState("")

  useInput((input, key) => {
    if (key.ctrl && input === "c") exit()
    if (input === "q" && (view.kind === "list" || view.kind === "thanks")) exit()
  })

  const onEmailSubmit = (val: string) => {
    if (!val.trim()) return
    setView({ kind: "auth-password", email: val.trim() })
    setEmailDraft("")
  }

  const onPasswordSubmit = async (val: string) => {
    if (!val) return
    setPasswordDraft("")
    const email = view.kind === "auth-password" ? view.email : ""
    setView({ kind: "loading" })
    try {
      const res = await api("/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ email, password: val }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setView({ kind: "auth-error", message: data.error ?? "Sign-in failed." })
        return
      }
      const squad = await api("/api/squad")
      const j = (await squad.json()) as { mates: Mate[] }
      setView({ kind: "list", mates: j.mates ?? [] })
    } catch (e) {
      setView({
        kind: "auth-error",
        message: e instanceof Error ? e.message : "Network error.",
      })
    }
  }

  const launch = async (mate: Mate) => {
    setView({ kind: "running", mate, output: "" })
    let buffer = ""
    let assembled = ""
    let lastAssistantId: string | undefined
    try {
      const res = await api(`/api/mate/${mate.id}/act`, {
        method: "POST",
        body: JSON.stringify({ task: "Run your action now." }),
      })
      if (!res.body) throw new Error("No response body")
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const raw of lines) {
          const line = raw.trim()
          if (!line) continue
          // AI SDK UI message stream: SSE-style "data: {...}".
          const json = line.startsWith("data:") ? line.slice(5).trim() : line
          if (!json || json === "[DONE]") continue
          try {
            const obj = JSON.parse(json) as Record<string, unknown>
            const type = obj.type as string | undefined
            if (type === "text-delta" || type === "0") {
              const t = (obj.delta ?? obj.textDelta ?? obj.text ?? "") as string
              assembled += t
              setView((v) =>
                v.kind === "running" ? { ...v, output: assembled } : v
              )
            } else if (type === "message-id" || type === "start-message") {
              if (typeof obj.messageId === "string") lastAssistantId = obj.messageId
              else if (typeof obj.id === "string") lastAssistantId = obj.id
            }
          } catch {
            /* skip malformed lines */
          }
        }
      }
      setView({ kind: "feedback", mate, lastAssistantId })
    } catch (e) {
      setView({
        kind: "running",
        mate,
        output: assembled + `\n\n[error] ${e instanceof Error ? e.message : "failed"}`,
      })
    }
  }

  const sendVerdict = async (mate: Mate, outcome: "success" | "failure", refId?: string) => {
    try {
      await api(`/api/mate/${mate.id}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          kind: "verdict",
          outcome,
          reference_id: refId ?? `tui-${Date.now()}`,
        }),
      })
    } catch {
      /* best-effort */
    }
    setView({ kind: "thanks" })
  }

  const skipFeedback = () => setView({ kind: "thanks" })

  return (
    <Box flexDirection="column" padding={1}>
      <Header />

      {view.kind === "auth-email" && (
        <Box flexDirection="column">
          <Text>Sign in</Text>
          <Box>
            <Text color="gray">email › </Text>
            <TextInput
              value={emailDraft}
              onChange={setEmailDraft}
              onSubmit={onEmailSubmit}
            />
          </Box>
        </Box>
      )}

      {view.kind === "auth-password" && (
        <Box flexDirection="column">
          <Text>Sign in as <Text color="cyan">{view.email}</Text></Text>
          <Box>
            <Text color="gray">password › </Text>
            <TextInput
              value={passwordDraft}
              onChange={setPasswordDraft}
              onSubmit={onPasswordSubmit}
              mask="•"
            />
          </Box>
        </Box>
      )}

      {view.kind === "auth-error" && (
        <Box flexDirection="column">
          <Text color="red">✗ {view.message}</Text>
          <Box marginTop={1}>
            <Text color="gray">Press Enter to try again.</Text>
          </Box>
          <RetryHandler onRetry={() => setView({ kind: "auth-email" })} />
        </Box>
      )}

      {view.kind === "loading" && (
        <Box>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          <Text> loading…</Text>
        </Box>
      )}

      {view.kind === "list" && <AgentList mates={view.mates} onLaunch={launch} />}

      {view.kind === "running" && (
        <Box flexDirection="column">
          <Text>
            ▶ <Text bold color="cyan">{view.mate.name}</Text>{" "}
            <Text color="gray">— {view.mate.tagline}</Text>
          </Text>
          <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
            <Text>{view.output || "..."}</Text>
          </Box>
        </Box>
      )}

      {view.kind === "feedback" && (
        <FeedbackPrompt
          mate={view.mate}
          onSubmit={(outcome) => sendVerdict(view.mate, outcome, view.lastAssistantId)}
          onSkip={skipFeedback}
        />
      )}

      {view.kind === "thanks" && (
        <Box flexDirection="column">
          <Text color="green">✓ Captured. </Text>
          <Box marginTop={1}>
            <Text color="gray">Press q to quit, or Enter for the agent list.</Text>
          </Box>
          <BackToList onBack={async () => {
            setView({ kind: "loading" })
            const squad = await api("/api/squad")
            const j = (await squad.json()) as { mates: Mate[] }
            setView({ kind: "list", mates: j.mates ?? [] })
          }} />
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {BASE_URL}
        </Text>
      </Box>
    </Box>
  )
}

function Header() {
  return (
    <Box marginBottom={1}>
      <Text bold color="cyan">μAgent</Text>
      <Text color="gray"> · TUI · ctrl+c to quit</Text>
    </Box>
  )
}

function AgentList({
  mates,
  onLaunch,
}: {
  mates: Mate[]
  onLaunch: (m: Mate) => void
}) {
  const items = useMemo(
    () =>
      mates.map((m) => ({
        label: `${m.name.padEnd(10)} · ${m.tagline}  (lv ${m.level})`,
        value: m.id,
      })),
    [mates]
  )
  if (mates.length === 0)
    return <Text color="yellow">No agents yet — sign in via the web app to seed the starter pack.</Text>

  return (
    <Box flexDirection="column">
      <Text color="gray">↑↓ to choose · Enter to launch · q to quit</Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={(item: { value: string }) => {
            const m = mates.find((x) => x.id === item.value)
            if (m) onLaunch(m)
          }}
        />
      </Box>
    </Box>
  )
}

function FeedbackPrompt({
  mate,
  onSubmit,
  onSkip,
}: {
  mate: Mate
  onSubmit: (outcome: "success" | "failure") => void
  onSkip: () => void
}) {
  useInput((input) => {
    if (input === "y" || input === "Y") onSubmit("success")
    else if (input === "n" || input === "N") onSubmit("failure")
    else if (input === "s" || input === "S") onSkip()
  })
  return (
    <Box flexDirection="column">
      <Text>How did <Text bold color="cyan">{mate.name}</Text> do?</Text>
      <Box marginTop={1}>
        <Text color="gray">
          press <Text color="green">y</Text> for 👍 (+5 xp), <Text color="red">n</Text> for 👎 (+5 xp), <Text color="yellow">s</Text> to skip
        </Text>
      </Box>
    </Box>
  )
}

function RetryHandler({ onRetry }: { onRetry: () => void }) {
  useInput((_input, key) => {
    if (key.return) onRetry()
  })
  return null
}

function BackToList({ onBack }: { onBack: () => void }) {
  useInput((_input, key) => {
    if (key.return) onBack()
  })
  return null
}

render(<App />)
