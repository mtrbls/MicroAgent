"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MateAvatar } from "./avatar"
import { Loader2, ExternalLink, Check, Link2, RefreshCw } from "lucide-react"
import type { Mate } from "@/lib/types"

interface McpSetupModalProps {
  mate: Mate | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ConnectionState = { connected: boolean; authUrl?: string }

export function McpSetupModal({ mate, open, onOpenChange }: McpSetupModalProps) {
  const [authStatus, setAuthStatus] = useState<Record<string, ConnectionState>>({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!mate) return
    setLoading(true)
    try {
      const res = await fetch(`/api/mate/${mate.id}/auth`)
      const d = await res.json()
      setAuthStatus(d.connections || {})
    } finally {
      setLoading(false)
    }
  }, [mate])

  useEffect(() => {
    if (open && mate) refresh()
  }, [open, mate, refresh])

  if (!mate) return null

  const connections = Object.entries(authStatus)
  const allConnected =
    connections.length > 0 && connections.every(([, s]) => s.connected)
  const noToolkit = !loading && connections.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 top-0 left-0 translate-x-0 translate-y-0 h-dvh w-screen max-w-none rounded-none border-0 sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:h-[85dvh] sm:w-[680px] sm:max-w-[92vw] sm:rounded-lg sm:border">
        <DialogHeader className="shrink-0 border-b border-border/30 px-6 pb-4 pt-6">
          <div className="flex items-start gap-4 text-left">
            <MateAvatar name={mate.name} color={mate.color} size="lg" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Connect apps for {mate.name}
              </DialogTitle>
              <p className="mt-1.5 text-sm text-foreground/80">
                {mate.tagline}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
          {loading && connections.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking connection status...
            </div>
          ) : noToolkit ? (
            <p className="text-sm text-muted-foreground">
              This action doesn't need any external apps.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {mate.name} needs access to the following to run.
              </p>
              {connections.map(([app, s]) => (
                <div
                  key={app}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <Link2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium capitalize">{app.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.connected ? "Connected" : "Not connected"}
                      </p>
                    </div>
                  </div>
                  {s.connected ? (
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      Active
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        if (s.authUrl) window.open(s.authUrl, "_blank")
                      }}
                    >
                      Connect
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/30 bg-background/80 px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={loading || noToolkit}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            {allConnected || noToolkit ? "Done" : "Skip for now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
