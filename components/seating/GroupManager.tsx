"use client"

import { useState } from "react"
import type { Group } from "@/types/database"
import type { SeatingGuest } from "./GuestCard"

const PRESET_COLOURS = ["#A8B5A2", "#EDAFB8", "#B0C4B1", "#D4A5A5", "#9BB5CE", "#E8D5A3"]

type Props = {
  groups: Group[]
  guests: SeatingGuest[]
  onCreateGroup: (name: string, colour: string) => Promise<void>
  onRenameGroup: (id: string, name: string) => Promise<void>
  onDeleteGroup: (id: string) => Promise<void>
  onAssignGroup: (guestId: string, groupId: string | null) => Promise<void>
}

export default function GroupManager({
  groups,
  guests,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onAssignGroup,
}: Props) {
  const [expanded, setExpanded] = useState(true)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newColour, setNewColour] = useState(PRESET_COLOURS[0])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const guestsByGroup = (groupId: string) =>
    guests.filter((g) => (g as SeatingGuest & { group_id?: string | null }).group_id === groupId)

  async function handleCreate() {
    if (!newName.trim()) return
    await onCreateGroup(newName.trim(), newColour)
    setNewName("")
    setNewColour(PRESET_COLOURS[0])
    setCreating(false)
  }

  async function handleDelete(group: Group) {
    const members = guestsByGroup(group.id)
    const msg =
      members.length > 0
        ? `Delete group "${group.name}"? It has ${members.length} member${members.length !== 1 ? "s" : ""} who will be ungrouped.`
        : `Delete group "${group.name}"?`
    if (!confirm(msg)) return
    await onDeleteGroup(group.id)
  }

  async function handleRename(id: string) {
    if (renameValue.trim()) await onRenameGroup(id, renameValue.trim())
    setRenamingId(null)
  }

  return (
    <div className="border-t pt-3 mt-3" style={{ borderColor: "var(--color-stone)" }}>
      <button
        className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide px-1 mb-2"
        style={{ color: "var(--color-subtle)" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span>Groups</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="space-y-1.5">
          {groups.map((group) => {
            const members = guestsByGroup(group.id)
            const isExpanded = expandedGroup === group.id
            return (
              <div
                key={group.id}
                className="rounded-lg border bg-white"
                style={{ borderColor: "var(--color-stone)" }}
              >
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: group.colour }}
                  />
                  {renamingId === group.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRename(group.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(group.id)
                        if (e.key === "Escape") setRenamingId(null)
                      }}
                      className="flex-1 text-xs border-b focus:outline-none"
                      style={{ borderColor: "var(--color-charcoal)" }}
                    />
                  ) : (
                    <button
                      className="flex-1 text-xs font-medium text-left hover:underline"
                      style={{ color: "var(--color-charcoal)" }}
                      onDoubleClick={() => {
                        setRenamingId(group.id)
                        setRenameValue(group.name)
                      }}
                    >
                      {group.name}
                    </button>
                  )}
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: group.colour + "40", color: "var(--color-charcoal)" }}
                  >
                    {members.length}
                  </span>
                  <button
                    className="text-[10px] px-1 text-gray-400 hover:text-gray-600"
                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                  <button
                    className="text-[10px] px-1 hover:text-red-500 text-gray-400"
                    onClick={() => handleDelete(group)}
                    title="Delete group"
                  >
                    ×
                  </button>
                </div>
                {isExpanded && (
                  <div className="px-2 pb-2 space-y-0.5">
                    {members.length === 0 && (
                      <p className="text-[10px] italic" style={{ color: "var(--color-subtle)" }}>
                        No members — assign via guest cards
                      </p>
                    )}
                    {members.map((g) => (
                      <div key={g.id} className="flex items-center justify-between text-[11px]">
                        <span style={{ color: "var(--color-charcoal)" }}>{g.name}</span>
                        <button
                          className="text-gray-400 hover:text-red-500 ml-2"
                          onClick={() => onAssignGroup(g.id, null)}
                          title="Remove from group"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {creating ? (
            <div className="rounded-lg border bg-white p-2 space-y-1.5" style={{ borderColor: "var(--color-stone)" }}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                  if (e.key === "Escape") setCreating(false)
                }}
                placeholder="Group name…"
                className="w-full text-xs border rounded px-2 py-1 focus:outline-none"
                style={{ borderColor: "var(--color-stone)" }}
              />
              <div className="flex gap-1.5 flex-wrap">
                {PRESET_COLOURS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColour(c)}
                    className="w-5 h-5 rounded-full border-2 transition-all"
                    style={{
                      background: c,
                      borderColor: newColour === c ? "var(--color-charcoal)" : "transparent",
                    }}
                    title={c}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handleCreate}
                  className="text-xs px-2 py-1 rounded text-white"
                  style={{ background: "var(--color-charcoal)" }}
                >
                  Create
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="text-xs px-2 py-1 rounded border"
                  style={{ borderColor: "var(--color-stone)", color: "var(--color-subtle)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full text-xs py-1.5 rounded-lg border border-dashed hover:bg-stone-50 transition-colors"
              style={{ borderColor: "var(--color-stone)", color: "var(--color-subtle)" }}
            >
              + New group
            </button>
          )}
        </div>
      )}
    </div>
  )
}
