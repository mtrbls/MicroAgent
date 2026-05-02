"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? "Sign up failed")
      }
      // Sign-up auto-signs-in via session cookie; land on the home page.
      router.push("/")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto mt-24 max-w-md px-4">
      <h1 className="mb-1 font-display text-lg tracking-tight">μAGENT</h1>
      <p className="mb-6 text-sm text-foreground/70">
        Create an account. You'll be signed in automatically after.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border-2 border-foreground bg-card px-3 py-2 text-sm focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Password (8+ chars)
          </span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border-2 border-foreground bg-card px-3 py-2 text-sm focus:outline-none"
          />
        </label>

        {error && (
          <div className="border-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full border-2 border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background shadow-[4px_4px_0_0_var(--color-foreground)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--color-foreground)] disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>
    </main>
  )
}
