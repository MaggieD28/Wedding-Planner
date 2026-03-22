# Seating Plan UX Improvements — Implementation Brief for Claude Code

Implement the five changes below in order. After every change, confirm the app still compiles (`npm run build`) before moving on. All work is in `components/seating/` and `lib/`.

Reference wireframes are in `seating-ux-wireframes.html` — open in a browser to see the intended result for each scene.

---

## Architecture overview (read before starting)

The **current** structure has three tabs:
- `"seating"` — guest sidebar (left) + table cards grid (right). This is where guests are drag-and-dropped onto seats.
- `"room"` — the `RoomCanvas` SVG where tables are repositioned visually.
- `"tables"` — add / rename / delete tables, configure room presets.

The **new** structure has no tabs at all:
- The **table cards grid** is always visible (it was the `"seating"` tab — preserve it exactly).
- The **room canvas** becomes a collapsible panel toggled by a `⊞` button in the header. It slides in above the table cards.
- **Room config + table management** (previously `"room"` and `"tables"` tabs) move into a `⚙ Setup` modal.

---

## Change 1 — Remove the tab bar; make the table cards the permanent main view

**File:** `components/seating/SeatingClient.tsx`

**Goal:** The page should open straight to the table cards view. There is no longer a tab bar.

**What to do:**

1. Remove the `Tab` type (`type Tab = "seating" | "room" | "tables"`) and the `tab` state entirely.

2. Remove the tab bar JSX (`<div className="flex gap-1 mb-4 border-b"...>`).

3. The content that was conditionally rendered under `tab === "seating"` (the `DndContext` wrapper containing the sidebar + table cards grid) should now render unconditionally — it is always visible.

4. Keep the `DndContext`, `onDragStart`, `onDragEnd`, and `DragOverlay` exactly as they are. Do not touch the drag-and-drop logic.

5. The content that was under `tab === "room"` (the `RoomCanvas`) will be repurposed in **Change 3** below — do not delete it yet, just stop rendering it for now.

6. The content that was under `tab === "tables"` (the room config form + add/edit/delete table UI) will be repurposed in **Change 2** below — do not delete it yet, just stop rendering it for now.

**Expected result:** The app opens directly to the table cards. No tab bar is visible.

---

## Change 2 — Move room config + table management into a ⚙ Setup modal

**File:** `components/seating/SeatingClient.tsx`

**Goal:** All the "set it and forget it" room setup is behind a single gear button, not in the main navigation.

**What to do:**

1. Add state: `const [showRoomSetup, setShowRoomSetup] = useState(false)`

2. Add a `⚙` button to the existing header actions row (alongside "Auto Assign", "Constraints", "Print"):
   ```tsx
   <button
     onClick={() => setShowRoomSetup(true)}
     className="border rounded-lg px-3 py-2 text-sm transition-colors hover:bg-stone-100"
     style={{ borderColor: "var(--color-stone)", color: "var(--color-subtle)" }}
     title="Room Setup"
   >
     ⚙
   </button>
   ```

3. Create a modal overlay (use the same visual pattern as the existing `ConstraintManager` — a fixed overlay with backdrop, a centered white panel, a `×` close button). The modal should be `max-w-lg`, `overflow-y-auto`, `max-h-[85vh]`.

4. Inside the modal, render two clearly separated sections:

   **Section 1 — "Venue & Room Configuration"**
   Move in the JSX that was under `tab === "room"` for room config: the room preset selector, aspect ratio input, table shape selector (CIRCLE / OVAL / RECTANGLE), seats-per-table input, and the "Save room config" button. Keep all the associated handlers (`handleSaveRoomConfig`, etc.) unchanged.

   **Section 2 — "Manage Tables"**
   Move in the JSX that was under `tab === "tables"`: the existing table list (with rename/delete per table), the "Add table" form (name, capacity, shape, head-table checkbox), and the "Name all tables" / `NameTablesModal` trigger. Keep all the associated handlers (`handleAddTable`, `handleDeleteTable`, `handleRenameTable`, etc.) unchanged.

5. Close the modal when the `×` button is clicked (`setShowRoomSetup(false)`). Also close it after a successful "Save room config" action.

6. Do not change any of the save/update logic — only move the JSX.

**Expected result:** Clicking ⚙ opens a scrollable modal with all room and table management. The main screen is uncluttered.

---

## Change 3 — Canvas as a collapsible panel above the table cards (⊞ toggle)

**File:** `components/seating/SeatingClient.tsx`

**Goal:** The room canvas is available whenever needed but doesn't compete with the table cards for space. A `⊞` button in the header slides it in above the table cards.

**What to do:**

1. Add state: `const [showCanvas, setShowCanvas] = useState(false)`

2. Add a `⊞` button to the header actions row (to the right of the `⚙` button):
   ```tsx
   <button
     onClick={() => setShowCanvas((v) => !v)}
     className="border rounded-lg px-3 py-2 text-sm transition-colors hover:bg-stone-100"
     style={{
       borderColor: showCanvas ? "var(--color-charcoal)" : "var(--color-stone)",
       background: showCanvas ? "var(--color-charcoal)" : "white",
       color: showCanvas ? "white" : "var(--color-subtle)",
     }}
     title={showCanvas ? "Hide room canvas" : "Show room canvas"}
   >
     ⊞
   </button>
   ```

3. Above the table cards grid (but still inside the `DndContext`), render the canvas panel conditionally:
   ```tsx
   {showCanvas && (
     <div
       className="border-b mb-4"
       style={{
         height: "340px",
         borderColor: "var(--color-stone)",
         transition: "height 0.25s ease",
       }}
     >
       <RoomCanvas
         tables={tables}
         roomConfig={roomConfig}
         overlappingIds={overlappingTableIds}
         onTableMove={handleTableMove}
         allTables={tables.map(t => ({ id: t.id, x: t.x, y: t.y, capacity: t.capacity, shape: t.shape }))}
         venueCapacity={venueCapacity}
       />
     </div>
   )}
   ```

4. The `RoomCanvas` component will gain new props in **Change 4** and **Change 5** — for now just pass through what it currently accepts plus the new `allTables` and `venueCapacity` props (added in Change 4).

**Expected result:** Clicking `⊞` slides the room canvas in above the table cards. Clicking it again collapses it. The table cards remain fully interactive at all times.

---

## Change 4 — Collision prevention in the canvas

**File:** `components/seating/RoomCanvas.tsx`

**Goal:** When a table is dragged and dropped onto another table, it automatically snaps to the nearest free position instead of overlapping.

**What to do:**

1. Add two new props to the `Props` type:
   ```ts
   allTables: { id: string; x: number | null; y: number | null; capacity: number; shape: string | null }[]
   venueCapacity: number
   ```

2. Import `detectOverlaps` from `@/lib/roomLayout` (check — it may already be imported; if not, add it alongside the existing imports from that module).

3. Write a helper function inside the component (or as a module-level util):
   ```ts
   function findFreePosition(
     tableId: string,
     proposed: { x: number; y: number },
     allTables: Props["allTables"],
     aspectRatio: number,
     venueCapacity: number,
     tableShape: string
   ): { x: number; y: number } {
     // Build a temp snapshot with the dragged table at the proposed position
     // Call detectOverlaps — if tableId is NOT in the result, return proposed immediately
     // Otherwise, spiral outward: try offsets of [±5, ±10, ±15, ±20, ±25]% in x and y
     // Return the first clear candidate, or proposed if none found after ~24 attempts
   }
   ```

4. In `handlePointerUp` (the pointer-up event handler that calls `onTableMove`), replace the direct call with:
   ```ts
   const aspectRatio = roomConfig?.aspect_ratio ?? 1.5
   const tableShape = roomConfig?.table_shape ?? "CIRCLE"
   const resolvedPos = findFreePosition(draggingId, pos, allTables, aspectRatio, venueCapacity, tableShape)
   onTableMove(draggingId, resolvedPos.x, resolvedPos.y)
   ```

5. Pass `allTables` and `venueCapacity` from `SeatingClient` into `RoomCanvas` as shown in Change 3 above.

**Expected result:** Dropping a table on top of another causes it to snap to the nearest clear spot. No overlaps are possible.

---

## Change 5 — Show guest names as seat dots around each table in the canvas

**Files:** `components/seating/RoomCanvas.tsx` (primarily), `components/seating/SeatingClient.tsx` (to pass the data down)

**Goal:** The room canvas shows who is sitting at each table — first names on coloured dots radiating around each table circle, so you can see the full room picture at a glance.

### 5a — Pass table-with-seats data to RoomCanvas

In `SeatingClient.tsx`, add a new prop to the `RoomCanvas` call (in the canvas panel from Change 3):
```tsx
displayTables={displayTables}
```

`displayTables` is already computed in `SeatingClient` via `buildDisplayTables(tables, guests)` — it contains each table's seats with the assigned guest data.

### 5b — Update RoomCanvas Props type

In `RoomCanvas.tsx`, add to the `Props` type:
```ts
displayTables?: DisplayTable[]   // import DisplayTable from "./TableCard"
```

### 5c — Render seat dots with names

In the SVG/HTML rendering for each round table node (the element that currently shows the table name + circle), add seat pins around it.

**For round tables (CIRCLE / OVAL shape):**

After rendering the table circle, map over the table's seats and render one seat pin per seat. Position each pin radially:

```ts
const n = seats.length  // total seat count
const tableRadiusPx = /* the rendered radius of this table's circle */
const orbitRadiusPx = tableRadiusPx + 18  // seat pins orbit just outside the circle

seats.forEach((seat, i) => {
  const angle = (2 * Math.PI * i / n) - Math.PI / 2  // start at top
  const dx = orbitRadiusPx * Math.cos(angle)
  const dy = orbitRadiusPx * Math.sin(angle)
  // Render a small coloured dot (7×7px circle) at (cx + dx, cy + dy)
  // Render the guest's first name as a tiny label (6.5px) next to the dot
  // Position the label: if dy < 0 (top half), label above dot; if dy ≥ 0 (bottom half), label below dot
})
```

**Dot colour coding:**
- Guest assigned, `side === "BRIDE"`: `var(--color-pink)` (`#EDAFB8`)
- Guest assigned, `side === "GROOM"`: `var(--color-sage)` (`#B0C4B1`)
- Guest assigned and their id is in `avoidViolations` for this table: `var(--color-warm-red)` (`#C0736A`)
- No guest (empty seat): `var(--color-stone)` (`#DEDBD2`), dashed border

**Name label:**
- Show `guest.first_name` only (not last name — space is tight)
- `font-size: 6.5px`, `font-weight: 500`
- White/semi-transparent background pill so it reads over the dotted canvas grid
- If no guest: show `—` in `var(--color-subtle)`

**For the Head Table (RECTANGLE shape):**
- Render seat pins along the top edge and bottom edge of the rectangle, evenly spaced
- Top row: seats 0 to `Math.ceil(n/2) - 1`
- Bottom row: seats `Math.ceil(n/2)` to `n - 1`
- Position pins 14px above / below the rectangle edge

**Pass `avoidViolations` down:**
In `SeatingClient`, also pass `avoidViolations` to `RoomCanvas` so conflict seats can be coloured red:
```tsx
avoidViolations={avoidViolations}  // already a Set<string> of seat IDs
```
Add `avoidViolations?: Set<string>` to `RoomCanvas` Props.

### 5d — Legend

Add a small legend inside the canvas (bottom-left corner, absolutely positioned, semi-transparent white pill):
```
● Bride  ● Groom  ● Empty  ● Conflict
```
using the four colours above at 8px dot size, 9px text.

**Expected result:** Every table in the canvas shows first names on coloured dots radiating around it. The room canvas becomes a true visual seating plan — you can see who is sitting where across the whole venue at a glance.

---

## Change 6 — Collapsible guest sidebar

**File:** `components/seating/SeatingClient.tsx`

**Goal:** The guest list sidebar can be collapsed to a thin strip so the table cards (and canvas) have more horizontal space.

**What to do:**

1. Add state: `const [sidebarOpen, setSidebarOpen] = useState(true)`

2. Wrap the existing `w-64 flex-shrink-0` sidebar div so that:
   - When open: renders normally at `w-64`
   - When closed: renders as a `w-10 flex-shrink-0` strip containing only a single `›` toggle button

3. Add a `‹` button at the top of the sidebar (inside, visible when open) that sets `sidebarOpen(false)`.

4. Use Tailwind `transition-all duration-200` on the sidebar wrapper for a smooth slide.

5. When the sidebar collapses, the flex container naturally expands the main content area to fill the space — no extra work needed.

**Expected result:** A `‹` / `›` toggle lets the sidebar be hidden to maximise canvas/card space, and restored when needed for drag-and-drop.

---

## Change 7 — Remove the cards / diagrams toggle

**File:** `components/seating/SeatingClient.tsx`

**Goal:** The "cards / diagrams" toggle is no longer needed — the table cards are always shown and the diagrams view is replaced by the canvas panel.

**What to do:**

1. Remove `seatingView` state (`useState<"cards" | "diagrams">`).
2. Remove the toggle button row (`<div className="flex justify-end mb-3">...`).
3. Remove the `seatingView === "diagrams"` conditional branch — always render the cards grid.
4. Keep `TableDiagram` imported (do not delete it) in case it is used elsewhere.

**Expected result:** The toggle disappears. Table cards always show.

---

## Summary

| # | Change | Files |
|---|--------|-------|
| 1 | Remove tab bar; table cards always visible | `SeatingClient.tsx` |
| 2 | Room config + table management → ⚙ modal | `SeatingClient.tsx` |
| 3 | Canvas → collapsible ⊞ panel above table cards | `SeatingClient.tsx` |
| 4 | Collision prevention on table drag | `RoomCanvas.tsx`, `SeatingClient.tsx` |
| 5 | Guest names as seat dots around tables in canvas | `RoomCanvas.tsx`, `SeatingClient.tsx` |
| 6 | Collapsible guest sidebar | `SeatingClient.tsx` |
| 7 | Remove cards/diagrams toggle | `SeatingClient.tsx` |

---

## Do NOT change

- Database queries, Supabase logic, or real-time subscriptions
- Drag-and-drop guest assignment (`DndContext`, `handleDragEnd`, `SeatSlot`)
- `ConstraintManager` modal or `GroupManager` component
- Colour tokens (`var(--color-charcoal)`, `var(--color-blush)`, etc.)
- Print layout (`print:hidden` classes)
- Undo stack logic

---

## Definition of done

Run `npm run build` from the project root. The build must complete with zero TypeScript errors before the work is considered finished.
