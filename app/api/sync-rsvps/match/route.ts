import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normalizeDietary } from "@/lib/rsvp-utils"
import type { RsvpEntry } from "../route"

export async function POST(req: Request) {
  const { guestId, rsvp }: { guestId: string; rsvp: RsvpEntry } = await req.json()
  const supabase = await createClient()
  const { error } = await supabase.from("guests").update({
    rsvp_status: rsvp.attending ? "Accepted" : "Declined",
    dietary_requirement: normalizeDietary(rsvp.dietary_requirements),
    children_count: rsvp.children?.length ?? 0,
    children_dietary: (rsvp.children ?? []).map(c => c.dietary).filter(Boolean).join(", ") || null,
    rsvp_date: rsvp.created_at ? rsvp.created_at.split("T")[0] : null,
    rsvp_synced: true,
  }).eq("id", guestId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
