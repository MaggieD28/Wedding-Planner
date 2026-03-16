import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Sidebar from "@/components/Sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch seating plan URL from settings
  const { data: settings } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "seating_plan_url")
    .single()

  return (
    <div className="flex min-h-screen">
      <Sidebar
        seatingPlanUrl={settings?.value || undefined}
        userEmail={user.email}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
