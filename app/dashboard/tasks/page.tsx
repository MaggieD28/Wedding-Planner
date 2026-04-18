import { createClient } from "@/lib/supabase/server"
import TasksClient from "@/components/tasks/TasksClient"
import type { Task } from "@/types/database"

interface Props {
  searchParams: Promise<{ filter?: string }>
}

export default async function TasksPage({ searchParams }: Props) {
  const { filter } = await searchParams
  const supabase = await createClient()

  const [{ data: tasks }, { data: { user } }, { data: settings }] = await Promise.all([
    supabase.from("tasks").select("*").order("task_id"),
    supabase.auth.getUser(),
    supabase.from("settings").select("key, value").in("key", ["maggie_email", "bobby_email"]),
  ])

  const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))

  return (
    <TasksClient
      initialTasks={(tasks ?? []) as Task[]}
      currentUserEmail={user?.email ?? ""}
      maggieEmail={settingsMap["maggie_email"] ?? ""}
      bobbyEmail={settingsMap["bobby_email"] ?? ""}
      initialFilter={filter}
    />
  )
}
