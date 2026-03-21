import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { theme, tables, excludeIds = [] } = await req.json() as {
    theme: string
    tables: { id: string; name: string }[]
    excludeIds: string[]
  }

  const eligible = tables.filter((t) => !excludeIds.includes(t.id))
  if (eligible.length === 0) {
    return NextResponse.json({ suggestions: [] })
  }

  const n = eligible.length
  const prompt = `Generate ${n} unique, creative table names with the theme "${theme}". Return ONLY a JSON array of exactly ${n} strings, no other text. Example: ["Name 1", "Name 2"]`

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    })

    const text = message.content[0].type === "text" ? message.content[0].text : "[]"
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const names: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    const suggestions = eligible.map((t, i) => ({
      id: t.id,
      current: t.name,
      suggested: names[i] ?? t.name,
    }))

    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error("name-tables error:", err)
    return NextResponse.json({ error: "Failed to generate names" }, { status: 500 })
  }
}
