import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import CountdownCard from "@/components/dashboard/CountdownCard"
import RsvpChart from "@/components/dashboard/RsvpChart"
import BudgetChart from "@/components/dashboard/BudgetChart"
import { CheckCircle2, Clock, AlertTriangle, Users, PiggyBank, CalendarDays } from "lucide-react"

function fmt(n: number) {
  return n.toLocaleString("en-GB", { maximumFractionDigits: 0 })
}

function fmtCurrency(n: number, symbol = "€") {
  return `${symbol}${fmt(n)}`
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: settings },
    { data: tasks },
    { data: guests },
    { data: budgetItems },
  ] = await Promise.all([
    supabase.from("settings").select("key, value"),
    supabase.from("tasks").select("status, due_date, assigned_to, category, name, task_id"),
    supabase.from("guests").select("rsvp_status, side"),
    supabase.from("budget_items").select("category, price_per_unit_eur, units, actual_paid_eur, active"),
  ])

  // Settings
  const getSetting = (key: string) => settings?.find(s => s.key === key)?.value ?? ""
  const weddingDate = getSetting("wedding_date") || "2026-08-15"
  const fxRate = parseFloat(getSetting("fx_rate_eur_gbp") || "0.87")

  // Task stats
  const today = new Date().toISOString().split("T")[0]
  const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const allTasks = tasks ?? []
  const tasksDone = allTasks.filter(t => t.status === "Done").length
  const tasksOpen = allTasks.filter(t => t.status !== "Done").length
  const tasksOverdue = allTasks.filter(t =>
    t.status !== "Done" && t.due_date && t.due_date < today
  )
  const tasksNext30 = allTasks.filter(t =>
    t.status !== "Done" && t.due_date && t.due_date >= today && t.due_date <= thirtyDaysOut
  )

  // Guest stats
  const allGuests = guests ?? []
  const guestAccepted = allGuests.filter(g => g.rsvp_status === "Accepted").length
  const guestDeclined = allGuests.filter(g => g.rsvp_status === "Declined").length
  const guestPending  = allGuests.filter(g => g.rsvp_status === "Pending" || g.rsvp_status === "Invited").length

  // Budget stats
  const activeItems = (budgetItems ?? []).filter(b => b.active)
  const totalBudgetEur = activeItems.reduce((sum, b) => sum + (b.price_per_unit_eur * b.units), 0)
  const totalPaidEur   = activeItems.reduce((sum, b) => sum + b.actual_paid_eur, 0)
  const remainingEur   = totalBudgetEur - totalPaidEur

  // Budget by category for chart
  const budgetByCategory = Object.values(
    activeItems.reduce((acc, item) => {
      const cat = item.category
      if (!acc[cat]) acc[cat] = { category: cat, budgeted: 0, paid: 0 }
      acc[cat].budgeted += item.price_per_unit_eur * item.units
      acc[cat].paid     += item.actual_paid_eur
      return acc
    }, {} as Record<string, { category: string; budgeted: number; paid: number }>)
  ).sort((a, b) => b.budgeted - a.budgeted)

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-5xl font-light mb-1"
          style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}
        >
          Dashboard
        </h1>
        <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
          Welcome back — here&apos;s where things stand.
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <CountdownCard weddingDate={weddingDate} />

        {/* Budget summary */}
        <div className="rounded-2xl p-6 flex flex-col justify-between" style={{ backgroundColor: "var(--color-blush)" }}>
          <div className="flex items-center gap-2 mb-3">
            <PiggyBank size={16} strokeWidth={1.75} style={{ color: "var(--color-subtle)" }} />
            <p className="text-xs tracking-widest uppercase" style={{ color: "var(--color-subtle)" }}>Budget</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-subtle)" }}>Total</span>
              <span className="font-medium" style={{ color: "var(--color-charcoal)" }}>{fmtCurrency(totalBudgetEur)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-subtle)" }}>Paid</span>
              <span className="font-medium" style={{ color: "var(--color-sage)" }}>{fmtCurrency(totalPaidEur)}</span>
            </div>
            <div className="h-px my-1" style={{ backgroundColor: "var(--color-sage-light)" }} />
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-subtle)" }}>Remaining</span>
              <span className="font-medium" style={{ color: "var(--color-warm-red)" }}>{fmtCurrency(remainingEur)}</span>
            </div>
            <p className="text-xs pt-1" style={{ color: "var(--color-subtle)" }}>
              £{fmt(totalBudgetEur * fxRate)} total · £{fmt(totalPaidEur * fxRate)} paid
            </p>
          </div>
        </div>

        {/* Guest summary */}
        <div className="rounded-2xl p-6 flex flex-col justify-between" style={{ backgroundColor: "var(--color-blush)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} strokeWidth={1.75} style={{ color: "var(--color-subtle)" }} />
            <p className="text-xs tracking-widest uppercase" style={{ color: "var(--color-subtle)" }}>Guests</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-subtle)" }}>Total</span>
              <span className="font-medium" style={{ color: "var(--color-charcoal)" }}>{allGuests.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-subtle)" }}>Accepted</span>
              <span className="font-medium" style={{ color: "var(--color-sage)" }}>{guestAccepted}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-subtle)" }}>Declined</span>
              <span className="font-medium" style={{ color: "var(--color-warm-red)" }}>{guestDeclined}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-subtle)" }}>Pending</span>
              <span className="font-medium" style={{ color: "var(--color-charcoal)" }}>{guestPending}</span>
            </div>
          </div>
        </div>

        {/* Task summary */}
        <div className="rounded-2xl p-6 flex flex-col justify-between" style={{ backgroundColor: "var(--color-blush)" }}>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={16} strokeWidth={1.75} style={{ color: "var(--color-subtle)" }} />
            <p className="text-xs tracking-widest uppercase" style={{ color: "var(--color-subtle)" }}>Tasks</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-subtle)" }}>Total</span>
              <span className="font-medium" style={{ color: "var(--color-charcoal)" }}>{allTasks.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-subtle)" }}>Done</span>
              <span className="font-medium" style={{ color: "var(--color-sage)" }}>{tasksDone}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-subtle)" }}>Open</span>
              <span className="font-medium" style={{ color: "var(--color-charcoal)" }}>{tasksOpen}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--color-subtle)" }}>Overdue</span>
              <span className="font-medium" style={{ color: tasksOverdue.length > 0 ? "var(--color-warm-red)" : "var(--color-sage)" }}>
                {tasksOverdue.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--color-blush)" }}>
          <h2
            className="text-xl font-medium mb-4"
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}
          >
            RSVP Breakdown
          </h2>
          <RsvpChart accepted={guestAccepted} declined={guestDeclined} pending={guestPending} />
        </div>

        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--color-blush)" }}>
          <h2
            className="text-xl font-medium mb-4"
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}
          >
            Budget by Category
          </h2>
          <BudgetChart data={budgetByCategory} />
          <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: "var(--color-subtle)" }}>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "#BFCABA" }} />
              Budgeted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "#B0C4B1" }} />
              Paid
            </span>
          </div>
        </div>
      </div>

      {/* Quick action lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue tasks */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--color-blush)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xl font-medium flex items-center gap-2"
              style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}
            >
              <AlertTriangle size={18} style={{ color: "var(--color-warm-red)" }} />
              Overdue
              {tasksOverdue.length > 0 && (
                <span
                  className="text-sm font-normal px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--color-warm-red)", color: "white" }}
                >
                  {tasksOverdue.length}
                </span>
              )}
            </h2>
            <Link href="/dashboard/tasks?filter=overdue" className="text-xs" style={{ color: "var(--color-subtle)" }}>
              View all →
            </Link>
          </div>
          {tasksOverdue.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-subtle)" }}>No overdue tasks — you&apos;re on track!</p>
          ) : (
            <ul className="space-y-2">
              {tasksOverdue.slice(0, 5).map(t => (
                <li key={t.task_id} className="flex items-start gap-2 text-sm">
                  <Clock size={13} className="mt-0.5 shrink-0" style={{ color: "var(--color-warm-red)" }} />
                  <div>
                    <span style={{ color: "var(--color-charcoal)" }}>{t.name}</span>
                    <span className="ml-2 text-xs" style={{ color: "var(--color-subtle)" }}>
                      · {t.due_date} · {t.assigned_to ?? "Unassigned"}
                    </span>
                  </div>
                </li>
              ))}
              {tasksOverdue.length > 5 && (
                <li className="text-xs" style={{ color: "var(--color-subtle)" }}>
                  + {tasksOverdue.length - 5} more
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Next 30 days */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--color-blush)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xl font-medium flex items-center gap-2"
              style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}
            >
              <CheckCircle2 size={18} style={{ color: "var(--color-sage)" }} />
              Next 30 Days
              {tasksNext30.length > 0 && (
                <span
                  className="text-sm font-normal px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--color-sage)", color: "var(--color-charcoal)" }}
                >
                  {tasksNext30.length}
                </span>
              )}
            </h2>
            <Link href="/dashboard/tasks?filter=next30" className="text-xs" style={{ color: "var(--color-subtle)" }}>
              View all →
            </Link>
          </div>
          {tasksNext30.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-subtle)" }}>Nothing due in the next 30 days.</p>
          ) : (
            <ul className="space-y-2">
              {tasksNext30.slice(0, 5).map(t => (
                <li key={t.task_id} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color: "var(--color-sage)" }} />
                  <div>
                    <span style={{ color: "var(--color-charcoal)" }}>{t.name}</span>
                    <span className="ml-2 text-xs" style={{ color: "var(--color-subtle)" }}>
                      · {t.due_date} · {t.assigned_to ?? "Unassigned"}
                    </span>
                  </div>
                </li>
              ))}
              {tasksNext30.length > 5 && (
                <li className="text-xs" style={{ color: "var(--color-subtle)" }}>
                  + {tasksNext30.length - 5} more
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
