"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  PiggyBank,
  BookOpen,
  FileText,
  Notebook,
  LayoutGrid,
  Settings,
  LogOut,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/guests", label: "Guests", icon: Users },
  { href: "/dashboard/budget", label: "Budget", icon: PiggyBank },
  { href: "/dashboard/vendors", label: "Vendors", icon: BookOpen },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/dashboard/decisions", label: "Decisions Log", icon: Notebook },
  { href: "/dashboard/seating", label: "Seating", icon: LayoutGrid },
]

interface SidebarProps {
  weddingDate?: string
  userEmail?: string
}

export default function Sidebar({ weddingDate, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside
      className="flex flex-col w-60 min-h-screen shrink-0"
      style={{ backgroundColor: "var(--color-charcoal)" }}
    >
      {/* Logo / title */}
      <div className="px-6 pt-8 pb-6 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <p className="text-xs tracking-widest uppercase mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>
          {weddingDate ?? "15 August 2026"}
        </p>
        <h1
          className="text-2xl text-white font-light leading-tight"
          style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}
        >
          Maggie<br />& Bobby
        </h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: active ? "var(--color-pink)" : "transparent",
                color: active ? "var(--color-charcoal)" : "rgba(255,255,255,0.75)",
              }}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          )
        })}

      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-6 space-y-0.5 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: pathname.startsWith("/dashboard/settings") ? "var(--color-pink)" : "transparent",
            color: pathname.startsWith("/dashboard/settings") ? "var(--color-charcoal)" : "rgba(255,255,255,0.75)",
          }}
        >
          <Settings size={16} strokeWidth={1.75} />
          Settings
        </Link>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <LogOut size={16} strokeWidth={1.75} />
          Sign out
          {userEmail && (
            <span className="ml-auto text-xs truncate max-w-[80px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              {userEmail.split("@")[0]}
            </span>
          )}
        </button>
      </div>
    </aside>
  )
}
