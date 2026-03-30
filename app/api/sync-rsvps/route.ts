import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normalizeDietary } from "@/lib/rsvp-utils"

export interface RsvpEntry {
  id: string
  name: string
  email: string | null
  attending: boolean
  guest_count: number
  plus_one: boolean
  plus_one_name: string | null
  plus_one_dietary: string | null
  dietary_requirements: string | null
  song_request: string | null
  children: { name: string; dietary: string | null }[]
  created_at: string
}

export async function POST() {
  const apiKey = process.env.RSVP_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "RSVP_API_KEY not set" }, { status: 500 })
  }

  // Fetch RSVPs from wedding website
  let rsvps: RsvpEntry[]
  try {
    const res = await fetch(
      "https://wpeipsapgfifubbqxgix.supabase.co/functions/v1/get-rsvps",
      { headers: { "x-api-key": apiKey } }
    )
    if (!res.ok) throw new Error(`Website API returned ${res.status}`)
    const body = await res.json()
    rsvps = body.rsvps ?? body
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }

  const supabase = await createClient()

  // Load all existing guests
  const { data: existingGuests, error: guestsError } = await supabase
    .from("guests")
    .select("id, guest_id, first_name, last_name, email, side, head_guest_id")

  if (guestsError || !existingGuests) {
    return NextResponse.json({ error: "Failed to load guests" }, { status: 500 })
  }

  let synced = 0
  let added = 0
  const unmatched: RsvpEntry[] = []

  for (const rsvp of rsvps) {
    // Match by email first, then by name
    let matched = rsvp.email
      ? existingGuests.find(g => g.email?.toLowerCase() === rsvp.email!.toLowerCase())
      : null

    if (!matched && rsvp.name) {
      const parts = rsvp.name.trim().split(" ")
      const firstName = parts[0]
      const lastName = parts.slice(1).join(" ")
      matched = existingGuests.find(
        g =>
          g.first_name.toLowerCase() === firstName.toLowerCase() &&
          (g.last_name ?? "").toLowerCase() === lastName.toLowerCase()
      )
    }

    if (!matched) {
      unmatched.push(rsvp)
      continue
    }

    // Build children_dietary string from children array
    const childrenDietary = (rsvp.children ?? [])
      .map(c => c.dietary)
      .filter(Boolean)
      .join(", ") || null

    // Update main guest
    await supabase
      .from("guests")
      .update({
        rsvp_status: rsvp.attending ? "Accepted" : "Declined",
        dietary_requirement: normalizeDietary(rsvp.dietary_requirements),
        children_count: rsvp.children?.length ?? 0,
        children_dietary: childrenDietary,
        rsvp_date: rsvp.created_at ? rsvp.created_at.split("T")[0] : null,
        rsvp_synced: true,
      })
      .eq("id", matched.id)

    synced++

    // Handle plus-one
    if (rsvp.plus_one && rsvp.plus_one_name) {
      const plusParts = rsvp.plus_one_name.trim().split(" ")
      const plusFirst = plusParts[0]
      const plusLast = plusParts.slice(1).join(" ")

      const existingPlusOne = existingGuests.find(
        g =>
          g.head_guest_id === matched!.id ||
          (g.first_name.toLowerCase() === plusFirst.toLowerCase() &&
            (g.last_name ?? "").toLowerCase() === plusLast.toLowerCase())
      )

      if (existingPlusOne) {
        await supabase
          .from("guests")
          .update({
            rsvp_status: "Accepted",
            dietary_requirement: normalizeDietary(rsvp.plus_one_dietary),
            rsvp_date: rsvp.created_at ? rsvp.created_at.split("T")[0] : null,
            rsvp_synced: true,
          })
          .eq("id", existingPlusOne.id)
        synced++
      } else {
        // Generate next guest_id
        const maxNum = existingGuests.reduce((max, g) => {
          const n = parseInt(g.guest_id.replace("G", ""), 10)
          return isNaN(n) ? max : Math.max(max, n)
        }, 0)
        const newGuestId = `G${String(maxNum + 1).padStart(3, "0")}`

        const { data: newGuest } = await supabase
          .from("guests")
          .insert({
            guest_id: newGuestId,
            first_name: plusFirst,
            last_name: plusLast || null,
            side: matched.side,
            head_guest_id: matched.id,
            rsvp_status: "Accepted",
            dietary_requirement: normalizeDietary(rsvp.plus_one_dietary),
            rsvp_date: rsvp.created_at ? rsvp.created_at.split("T")[0] : null,
            save_the_date_sent: false,
            invite_sent: false,
            children_count: 0,
            rsvp_synced: true,
          })
          .select("id, guest_id, first_name, last_name, email, side, head_guest_id")
          .single()

        if (newGuest) {
          existingGuests.push(newGuest)
          added++
        }
      }
    }
  }

  return NextResponse.json({ synced, added, unmatched, total: rsvps.length })
}
