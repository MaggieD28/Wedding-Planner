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

  const { data: settings } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["wedding_date", "maggie_email", "bobby_email"])

  const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))
  const weddingDate = settingsMap["wedding_date"]
    ? new Date(settingsMap["wedding_date"]).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : undefined

  return (
    <div className="flex min-h-screen">
      <Sidebar
        weddingDate={weddingDate}
        userEmail={user.email}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
