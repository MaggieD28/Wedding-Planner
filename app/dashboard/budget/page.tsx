import { createClient } from "@/lib/supabase/server"
import BudgetClient from "@/components/budget/BudgetClient"
import type { BudgetItem, Vendor } from "@/types/database"

export default async function BudgetPage() {
  const supabase = await createClient()
  const [{ data: items }, { data: vendors }, { data: settings }] = await Promise.all([
    supabase.from("budget_items").select("*").order("budget_item_id"),
    supabase.from("vendors").select("*").order("vendor_name"),
    supabase.from("settings").select("key, value"),
  ])

  const fxRate = parseFloat(settings?.find(s => s.key === "fx_rate_eur_gbp")?.value ?? "0.87")

  return (
    <BudgetClient
      initialItems={(items ?? []) as BudgetItem[]}
      vendors={(vendors ?? []) as Vendor[]}
      fxRate={fxRate}
    />
  )
}
