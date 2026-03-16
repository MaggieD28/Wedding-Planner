import { redirect } from "next/navigation"

// Invoices are shown inside the Vendors page (tab switcher)
export default function InvoicesPage() {
  redirect("/dashboard/vendors?tab=invoices")
}
