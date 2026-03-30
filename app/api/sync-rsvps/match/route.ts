import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normalizeDietary } from "@/lib/rsvp-utils"
import type { RsvpEntry } from "../route"

export async function POST(req: Request) {
  const { guestIds, rsvp }: { guestIds: string[]; rsvp: RsvpEntry } = await req.json()
  const supabase = await createClient()
  const rsvpDate = rsvp.created_at ? rsvp.created_at.split("T")[0] : null

  // Parse names from RSVP
  const primaryParts = rsvp.name.trim().split(" ")
  const primaryFirstName = primaryParts[0]
  const primaryLastName = primaryParts.slice(1).join(" ") || null

  const plusParts = rsvp.plus_one_name ? rsvp.plus_one_name.trim().split(" ") : []
  const plusFirstName = plusParts[0] ?? null
  const plusLastName = plusParts.slice(1).join(" ") || null

  for (let i = 0; i < guestIds.length; i++) {
    const guestId = guestIds[i]

    // Smart name assignment: 1st guest gets primary name, 2nd gets plus-one name
    const firstName = i === 0 ? primaryFirstName : (i === 1 && plusFirstName ? plusFirstName : primaryFirstName)
    const lastName = i === 0 ? primaryLastName : (i === 1 && plusFirstName ? plusLastName : primaryLastName)

    // Smart dietary split:
    // - 1st selected guest gets the primary RSVP dietary requirement
    // - 2nd selected guest gets the plus-one dietary (if present), else primary
    // - Any further guests fall back to primary dietary
    const dietary =
      i === 0
        ? normalizeDietary(rsvp.dietary_requirements)
        : i === 1 && rsvp.plus_one_dietary
          ? normalizeDietary(rsvp.plus_one_dietary)
          : normalizeDietary(rsvp.dietary_requirements)

    // Children info only applies to the primary (first) guest
    const childrenCount = i === 0 ? (rsvp.children?.length ?? 0) : 0
    const childrenDietary =
      i === 0
        ? (rsvp.children ?? []).map(c => c.dietary).filter(Boolean).join(", ") || null
        : null

    const { error } = await supabase.from("guests").update({
      first_name: firstName,
      last_name: lastName,
      rsvp_status: rsvp.attending ? "Accepted" : "Declined",
      dietary_requirement: dietary,
      children_count: childrenCount,
      children_dietary: childrenDietary,
      rsvp_date: rsvpDate,
      rsvp_synced: true,
    }).eq("id", guestId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
