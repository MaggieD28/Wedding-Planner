"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-stone)" }}
    >
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm tracking-widest uppercase mb-2" style={{ color: "var(--color-subtle)" }}>
            15 August 2026
          </p>
          <h1
            className="text-5xl font-light mb-1"
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}
          >
            Maggie & Bobby
          </h1>
          <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
            Wedding Planner
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-sm"
          style={{ backgroundColor: "var(--color-blush)" }}
        >
          <h2
            className="text-2xl font-medium mb-6 text-center"
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}
          >
            Sign in
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium uppercase tracking-wider mb-1.5"
                style={{ color: "var(--color-subtle)" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg px-4 py-2.5 text-sm border focus:outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: "white",
                  borderColor: "var(--color-sage-light)",
                  color: "var(--color-charcoal)",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium uppercase tracking-wider mb-1.5"
                style={{ color: "var(--color-subtle)" }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg px-4 py-2.5 text-sm border focus:outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: "white",
                  borderColor: "var(--color-sage-light)",
                  color: "var(--color-charcoal)",
                }}
              />
            </div>

            {error && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: "#fde8e6", color: "var(--color-warm-red)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-3 text-sm font-medium transition-opacity disabled:opacity-60 mt-2"
              style={{
                backgroundColor: "var(--color-sage)",
                color: "var(--color-charcoal)",
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "var(--color-subtle)" }}>
          Private — for Maggie & Bobby only
        </p>
      </div>
    </div>
  )
}
