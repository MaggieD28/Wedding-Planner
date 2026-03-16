import { createClient } from "@/lib/supabase/server"
import SettingsClient from "@/components/SettingsClient"
import type { AppSetting } from "@/types/database"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: settings } = await supabase.from("settings").select("*")

  return <SettingsClient initialSettings={(settings ?? []) as AppSetting[]} />
}
