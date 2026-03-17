import { createClient } from "@/lib/supabase/server"
import SeatingClient from "@/components/seating/SeatingClient"

export default async function SeatingPage() {
  const supabase = await createClient()

  const [{ data: guests }, { data: tables }, { data: constraints }, { data: roomConfigs }] =
    await Promise.all([
      supabase
        .from("guests")
        .select("id, guest_id, first_name, last_name, side, head_guest_id, is_head_table, rsvp_status")
        .neq("rsvp_status", "Declined")
        .order("first_name"),
      supabase
        .from("seating_tables")
        .select(`
          *,
          seats (
            *,
            guest:guests (
              id, first_name, last_name, side, head_guest_id, is_head_table
            )
          )
        `)
        .order("name"),
      supabase
        .from("seating_constraints")
        .select(`
          *,
          guest_a:guests!seating_constraints_guest_a_id_fkey (
            id, first_name, last_name, side, head_guest_id, is_head_table
          ),
          guest_b:guests!seating_constraints_guest_b_id_fkey (
            id, first_name, last_name, side, head_guest_id, is_head_table
          )
        `),
      supabase.from("room_config").select("*").limit(1),
    ])

  return (
    <SeatingClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialGuests={(guests ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialTables={(tables ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialConstraints={(constraints ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialRoomConfig={(roomConfigs?.[0] ?? null) as any}
    />
  )
}
