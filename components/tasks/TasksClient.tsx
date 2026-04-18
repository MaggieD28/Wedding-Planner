"use client"

import { useState, useMemo, useTransition, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle2, Circle, ChevronDown, Plus, X, Filter, Search } from "lucide-react"
import type { Task } from "@/types/database"

const STATUS_COLORS: Record<string, string> = {
  "Done":        "var(--color-sage)",
  "In progress": "var(--color-pink)",
  "Blocked":     "var(--color-warm-red)",
  "Not started": "var(--color-sage-light)",
}

const PRIORITY_COLORS: Record<string, string> = {
  "High":   "var(--color-warm-red)",
  "Medium": "var(--color-pink)",
  "Low":    "var(--color-sage-light)",
}

const ALL_STATUSES  = ["Not started", "In progress", "Blocked", "Done"]
const ALL_PRIORITIES = ["High", "Medium", "Low"]
const ALL_ASSIGNEES  = ["Maggie", "Bobby", "Both"]

interface Props {
  initialTasks: Task[]
  currentUserEmail: string
  maggieEmail: string
  bobbyEmail: string
  initialFilter?: string
}

export default function TasksClient({ initialTasks, currentUserEmail, maggieEmail, bobbyEmail, initialFilter }: Props) {
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [, startTransition] = useTransition()

  // Filters
  const [search, setSearch]       = useState("")
  const [filterStatus, setFilterStatus]     = useState<string>("all")
  const [filterPriority, setFilterPriority] = useState<string>("all")
  const [filterAssignee, setFilterAssignee] = useState<string>("all")
  const [filterView, setFilterView]         = useState<string>(initialFilter ?? "all")

  // Editing
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editDraft, setEditDraft]   = useState<Partial<Task>>({})
  const [addingNew, setAddingNew]   = useState(false)
  const [newTask, setNewTask]       = useState<Partial<Task>>({
    category: "", name: "", assigned_to: "Both", status: "Not started", priority: "Medium"
  })

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setTasks(prev => [...prev, payload.new as Task])
        } else if (payload.eventType === "UPDATE") {
          setTasks(prev => prev.map(t => t.id === (payload.new as Task).id ? payload.new as Task : t))
        } else if (payload.eventType === "DELETE") {
          setTasks(prev => prev.filter(t => t.id !== (payload.old as Task).id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const today = new Date().toISOString().split("T")[0]
  const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  const isMaggie = currentUserEmail.toLowerCase() === maggieEmail.toLowerCase()

  const filtered = useMemo(() => {
    let list = [...tasks]

    // View filter
    if (filterView === "mine") {
      const name = isMaggie ? "Maggie" : "Bobby"
      list = list.filter(t => t.assigned_to === name || t.assigned_to === "Both")
    } else if (filterView === "overdue") {
      list = list.filter(t => t.status !== "Done" && t.due_date && t.due_date < today)
    } else if (filterView === "next30") {
      list = list.filter(t => t.status !== "Done" && t.due_date && t.due_date >= today && t.due_date <= thirtyDaysOut)
    }

    // Sidebar filters
    if (filterStatus !== "all")   list = list.filter(t => t.status === filterStatus)
    if (filterPriority !== "all") list = list.filter(t => t.priority === filterPriority)
    if (filterAssignee !== "all") list = list.filter(t => t.assigned_to === filterAssignee)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    }

    return list
  }, [tasks, filterView, filterStatus, filterPriority, filterAssignee, search, today, thirtyDaysOut, isMaggie])

  // Group by category
  const grouped = useMemo(() => {
    return filtered.reduce((acc, task) => {
      const cat = task.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(task)
      return acc
    }, {} as Record<string, Task[]>)
  }, [filtered])

  async function toggleDone(task: Task) {
    const newStatus = task.status === "Done" ? "Not started" : "Done"
    const { data } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", task.id)
      .select()
      .single()
    if (data) setTasks(prev => prev.map(t => t.id === task.id ? data as Task : t))
  }

  async function saveEdit(taskId: string) {
    const { data } = await supabase
      .from("tasks")
      .update(editDraft)
      .eq("id", taskId)
      .select()
      .single()
    if (data) {
      setTasks(prev => prev.map(t => t.id === taskId ? data as Task : t))
      setEditingId(null)
    }
  }

  async function saveNew() {
    if (!newTask.name || !newTask.category) return
    // Generate a task_id
    const maxId = tasks.reduce((max, t) => {
      const n = parseInt(t.task_id.replace("T", ""), 10)
      return isNaN(n) ? max : Math.max(max, n)
    }, 0)
    const task_id = `T${String(maxId + 1).padStart(3, "0")}`

    const { data } = await supabase
      .from("tasks")
      .insert({ ...newTask, task_id })
      .select()
      .single()
    if (data) {
      setTasks(prev => [...prev, data as Task])
      setAddingNew(false)
      setNewTask({ category: "", name: "", assigned_to: "Both", status: "Not started", priority: "Medium" })
    }
  }

  const viewTabs = [
    { key: "all",    label: "All tasks" },
    { key: "mine",   label: "My tasks" },
    { key: "overdue",label: "Overdue" },
    { key: "next30", label: "Next 30 days" },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="text-5xl font-light mb-1"
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--color-charcoal)" }}
          >
            Tasks
          </h1>
          <p className="text-sm" style={{ color: "var(--color-subtle)" }}>
            {tasks.filter(t => t.status === "Done").length} of {tasks.length} complete
          </p>
        </div>
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity"
          style={{ backgroundColor: "var(--color-sage)", color: "var(--color-charcoal)" }}
        >
          <Plus size={15} />
          Add task
        </button>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ backgroundColor: "rgba(74,87,89,0.08)" }}>
        {viewTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterView(tab.key)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: filterView === tab.key ? "var(--color-pink)" : "transparent",
              color: filterView === tab.key ? "var(--color-charcoal)" : "var(--color-subtle)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-subtle)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="pl-8 pr-3 py-2 rounded-lg text-sm border"
            style={{
              backgroundColor: "var(--color-blush)",
              borderColor: "var(--color-sage-light)",
              color: "var(--color-charcoal)",
              width: "200px",
            }}
          />
        </div>
        <Select label="Status"   value={filterStatus}   onChange={setFilterStatus}   options={ALL_STATUSES} />
        <Select label="Priority" value={filterPriority} onChange={setFilterPriority} options={ALL_PRIORITIES} />
        <Select label="Assigned" value={filterAssignee} onChange={setFilterAssignee} options={ALL_ASSIGNEES} />
        {(filterStatus !== "all" || filterPriority !== "all" || filterAssignee !== "all" || search) && (
          <button
            onClick={() => { setFilterStatus("all"); setFilterPriority("all"); setFilterAssignee("all"); setSearch("") }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs"
            style={{ color: "var(--color-warm-red)", backgroundColor: "rgba(192,115,106,0.1)" }}
          >
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {/* Add new task form */}
      {addingNew && (
        <div className="rounded-2xl p-4 mb-5 flex flex-wrap gap-3 items-end" style={{ backgroundColor: "var(--color-blush)", border: "1px solid var(--color-sage-light)" }}>
          <Input label="Category" value={newTask.category ?? ""} onChange={v => setNewTask(p => ({ ...p, category: v }))} width="150px" />
          <Input label="Task name" value={newTask.name ?? ""} onChange={v => setNewTask(p => ({ ...p, name: v }))} width="260px" />
          <SelectInline label="Assigned" value={newTask.assigned_to ?? "Both"} onChange={v => setNewTask(p => ({ ...p, assigned_to: v as Task["assigned_to"] }))} options={ALL_ASSIGNEES} />
          <SelectInline label="Priority" value={newTask.priority ?? "Medium"} onChange={v => setNewTask(p => ({ ...p, priority: v as Task["priority"] }))} options={ALL_PRIORITIES} />
          <Input label="Due date" value={newTask.due_date ?? ""} onChange={v => setNewTask(p => ({ ...p, due_date: v || null }))} type="date" width="150px" />
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setAddingNew(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--color-subtle)" }}>Cancel</button>
            <button onClick={saveNew} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: "var(--color-sage)", color: "var(--color-charcoal)" }}>Save</button>
          </div>
        </div>
      )}

      {/* Task groups */}
      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm mt-8" style={{ color: "var(--color-subtle)" }}>No tasks match this filter.</p>
      ) : (
        Object.entries(grouped).map(([category, catTasks]) => (
          <CategoryGroup
            key={category}
            category={category}
            tasks={catTasks}
            today={today}
            editingId={editingId}
            editDraft={editDraft}
            onToggleDone={toggleDone}
            onStartEdit={(task) => { setEditingId(task.id); setEditDraft({ status: task.status, due_date: task.due_date, assigned_to: task.assigned_to, priority: task.priority, notes: task.notes }) }}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditingId(null)}
            onEditDraftChange={(field, value) => setEditDraft(p => ({ ...p, [field]: value }))}
          />
        ))
      )}
    </div>
  )
}

// ─── CategoryGroup ────────────────────────────────────────────
function CategoryGroup({
  category, tasks, today, editingId, editDraft,
  onToggleDone, onStartEdit, onSaveEdit, onCancelEdit, onEditDraftChange
}: {
  category: string
  tasks: Task[]
  today: string
  editingId: string | null
  editDraft: Partial<Task>
  onToggleDone: (t: Task) => void
  onStartEdit: (t: Task) => void
  onSaveEdit: (id: string) => void
  onCancelEdit: () => void
  onEditDraftChange: (field: string, value: string | null) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const doneCount = tasks.filter(t => t.status === "Done").length

  return (
    <div className="mb-3">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 w-full text-left px-2 py-2 rounded-lg mb-1 transition-colors"
        style={{ color: "var(--color-charcoal)" }}
      >
        <ChevronDown
          size={15}
          className="transition-transform shrink-0"
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
        />
        <span className="font-medium text-sm">{category}</span>
        <span className="text-xs ml-1" style={{ color: "var(--color-subtle)" }}>
          {doneCount}/{tasks.length}
        </span>
      </button>

      {!collapsed && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--color-blush)" }}>
          {tasks.map((task, idx) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              isEditing={editingId === task.id}
              editDraft={editDraft}
              isLast={idx === tasks.length - 1}
              onToggleDone={() => onToggleDone(task)}
              onStartEdit={() => onStartEdit(task)}
              onSaveEdit={() => onSaveEdit(task.id)}
              onCancelEdit={onCancelEdit}
              onEditDraftChange={onEditDraftChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TaskRow ─────────────────────────────────────────────────
function TaskRow({
  task, today, isEditing, editDraft, isLast,
  onToggleDone, onStartEdit, onSaveEdit, onCancelEdit, onEditDraftChange
}: {
  task: Task
  today: string
  isEditing: boolean
  editDraft: Partial<Task>
  isLast: boolean
  onToggleDone: () => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onEditDraftChange: (field: string, value: string | null) => void
}) {
  const isDone    = task.status === "Done"
  const isOverdue = !isDone && task.due_date && task.due_date < today

  return (
    <div
      className="px-4 py-3"
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--color-sage-light)",
        opacity: isDone ? 0.6 : 1,
      }}
    >
      {isEditing ? (
        <div className="flex flex-wrap gap-3 items-center">
          <SelectInline label="Status"   value={editDraft.status ?? ""} onChange={v => onEditDraftChange("status", v)}  options={["Not started","In progress","Blocked","Done"]} />
          <SelectInline label="Priority" value={editDraft.priority ?? ""} onChange={v => onEditDraftChange("priority", v || null)} options={["High","Medium","Low"]} />
          <SelectInline label="Assigned" value={editDraft.assigned_to ?? ""} onChange={v => onEditDraftChange("assigned_to", v || null)} options={["Maggie","Bobby","Both"]} />
          <Input label="Due date" value={editDraft.due_date ?? ""} onChange={v => onEditDraftChange("due_date", v || null)} type="date" width="150px" />
          <Input label="Notes" value={editDraft.notes ?? ""} onChange={v => onEditDraftChange("notes", v || null)} width="200px" />
          <div className="flex gap-2 ml-auto">
            <button onClick={onCancelEdit} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: "var(--color-subtle)" }}>Cancel</button>
            <button onClick={onSaveEdit} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: "var(--color-sage)", color: "var(--color-charcoal)" }}>Save</button>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-3 group cursor-pointer"
          onClick={onStartEdit}
        >
          {/* Done toggle */}
          <button
            onClick={e => { e.stopPropagation(); onToggleDone() }}
            className="shrink-0 transition-colors"
          >
            {isDone
              ? <CheckCircle2 size={18} style={{ color: "var(--color-sage)" }} />
              : <Circle size={18} style={{ color: "var(--color-sage-light)" }} />
            }
          </button>

          {/* Task name */}
          <span
            className="flex-1 text-sm"
            style={{
              color: "var(--color-charcoal)",
              textDecoration: isDone ? "line-through" : "none",
            }}
          >
            {task.name}
          </span>

          {/* Badges */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {task.priority && (
              <Badge color={PRIORITY_COLORS[task.priority] ?? "var(--color-sage-light)"}>
                {task.priority}
              </Badge>
            )}
            {task.assigned_to && (
              <Badge color="var(--color-sage-light)">{task.assigned_to}</Badge>
            )}
            {task.status && task.status !== "Done" && (
              <Badge color={STATUS_COLORS[task.status] ?? "var(--color-sage-light)"}>
                {task.status}
              </Badge>
            )}
            {task.due_date && (
              <span
                className="text-xs"
                style={{ color: isOverdue ? "var(--color-warm-red)" : "var(--color-subtle)" }}
              >
                {task.due_date}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────
function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs"
      style={{ backgroundColor: color, color: "var(--color-charcoal)", opacity: 0.9 }}
    >
      {children}
    </span>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-2 rounded-lg text-sm border appearance-none"
      style={{
        backgroundColor: "var(--color-blush)",
        borderColor: "var(--color-sage-light)",
        color: value === "all" ? "var(--color-subtle)" : "var(--color-charcoal)",
      }}
    >
      <option value="all">All {label}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function SelectInline({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs" style={{ color: "var(--color-subtle)" }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-1.5 rounded-lg text-sm border appearance-none"
        style={{
          backgroundColor: "white",
          borderColor: "var(--color-sage-light)",
          color: "var(--color-charcoal)",
        }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function Input({ label, value, onChange, type = "text", width }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; width?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs" style={{ color: "var(--color-subtle)" }}>{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-1.5 rounded-lg text-sm border"
        style={{
          backgroundColor: "white",
          borderColor: "var(--color-sage-light)",
          color: "var(--color-charcoal)",
          width: width ?? "180px",
        }}
      />
    </div>
  )
}
