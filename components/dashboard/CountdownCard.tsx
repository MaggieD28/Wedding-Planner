"use client"

import { useEffect, useState } from "react"

interface Props {
  weddingDate: string
}

export default function CountdownCard({ weddingDate }: Props) {
  const [days, setDays] = useState<number | null>(null)

  useEffect(() => {
    const target = new Date(weddingDate)
    const now = new Date()
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    setDays(diff)
  }, [weddingDate])

  return (
    <div
      className="rounded-2xl p-6 flex flex-col justify-between"
      style={{ backgroundColor: "var(--color-charcoal)", color: "white", minHeight: "140px" }}
    >
      <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
        The big day
      </p>
      <div>
        {days !== null ? (
          <>
            <p
              className="text-6xl font-light leading-none"
              style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}
            >
              {days}
            </p>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
              days to go
            </p>
          </>
        ) : (
          <p className="text-4xl font-light">—</p>
        )}
      </div>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
        15 August 2026
      </p>
    </div>
  )
}
