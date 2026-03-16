import { createClient } from "@/lib/supabase/server"
import DecisionsClient from "@/components/decisions/DecisionsClient"
import type { Decision } from "@/types/database"

export default async function DecisionsPage() {
  const supabase = await createClient()
  const { data: decisions } = await supabase
    .from("decisions")
    .select("*")
    .order("date", { ascending: false })

  return <DecisionsClient initialDecisions={(decisions ?? []) as Decision[]} />
}
