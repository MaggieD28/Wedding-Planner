import { createClient } from "@/lib/supabase/server"
import GuestsClient from "@/components/guests/GuestsClient"
import type { Guest } from "@/types/database"

export default async function GuestsPage() {
  const supabase = await createClient()
  const { data: guests } = await supabase
    .from("guests")
    .select("*")
    .order("guest_id")

  return <GuestsClient initialGuests={(guests ?? []) as Guest[]} />
}
