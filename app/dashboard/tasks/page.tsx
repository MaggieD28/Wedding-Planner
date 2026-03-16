import { createClient } from "@/lib/supabase/server"
import TasksClient from "@/components/tasks/TasksClient"
import type { Task } from "@/types/database"

interface Props {
  searchParams: Promise<{ filter?: string }>
}

export default async function TasksPage({ searchParams }: Props) {
  const { filter } = await searchParams
  const supabase = await createClient()

  const [{ data: tasks }, { data: { user } }] = await Promise.all([
    supabase.from("tasks").select("*").order("task_id"),
    supabase.auth.getUser(),
  ])

  return (
    <TasksClient
      initialTasks={(tasks ?? []) as Task[]}
      currentUserEmail={user?.email ?? ""}
      initialFilter={filter}
    />
  )
}
