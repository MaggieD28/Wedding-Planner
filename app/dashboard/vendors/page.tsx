import { createClient } from "@/lib/supabase/server"
import VendorsClient from "@/components/vendors/VendorsClient"
import type { Vendor, Invoice } from "@/types/database"

export default async function VendorsPage() {
  const supabase = await createClient()
  const [{ data: vendors }, { data: invoices }, { data: settings }] = await Promise.all([
    supabase.from("vendors").select("*").order("vendor_name"),
    supabase.from("invoices").select("*").order("invoice_id"),
    supabase.from("settings").select("key, value"),
  ])

  const fxRate = parseFloat(settings?.find(s => s.key === "fx_rate_eur_gbp")?.value ?? "0.87")

  return (
    <VendorsClient
      initialVendors={(vendors ?? []) as Vendor[]}
      initialInvoices={(invoices ?? []) as Invoice[]}
      fxRate={fxRate}
    />
  )
}
