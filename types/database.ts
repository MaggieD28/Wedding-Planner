export type TaskStatus = "Not started" | "In progress" | "Blocked" | "Done"
export type TaskPriority = "High" | "Medium" | "Low"
export type AssignedTo = "Maggie" | "Bobby" | "Both"
export type RsvpStatus = "Invited" | "Accepted" | "Declined" | "Pending"
export type GuestSide = "Bride" | "Groom"

export interface Task {
  id: string
  task_id: string
  category: string
  name: string
  assigned_to: AssignedTo | null
  due_date: string | null
  status: TaskStatus | null
  priority: TaskPriority | null
  notes: string | null
  vendor_id: string | null
  created_at: string
  updated_at: string
}

export interface Guest {
  id: string
  guest_id: string
  head_guest_id: string | null
  first_name: string
  last_name: string | null
  side: GuestSide
  email: string | null
  phone: string | null
  save_the_date_sent: boolean
  invite_sent: boolean
  invite_date: string | null
  rsvp_status: RsvpStatus
  rsvp_date: string | null
  dietary_requirement: string | null
  allergies_notes: string | null
  children_count: number
  children_dietary: string | null
  children_allergies: string | null
  follow_up_notes: string | null
  table_number: number | null
  is_head_table: boolean
  created_at: string
  updated_at: string
}

export interface BudgetItem {
  id: string
  budget_item_id: string
  category: string
  description: string
  vendor_id: string | null
  units: number
  price_per_unit_eur: number
  actual_invoiced_eur: number
  actual_paid_eur: number
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Vendor {
  id: string
  vendor_id: string
  vendor_name: string
  category: string
  contact_name: string | null
  email: string | null
  phone: string | null
  contract_signed: boolean
  contract_value_eur: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  invoice_id: string
  vendor_id: string | null
  budget_item_id: string | null
  description: string
  amount_eur: number
  invoice_date: string | null
  due_date: string | null
  paid: boolean
  paid_date: string | null
  paid_by: AssignedTo | null
  payment_method: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Decision {
  id: string
  decision_id: string
  date: string | null
  what_was_decided: string
  options_considered: string | null
  rationale: string | null
  owner: AssignedTo | null
  locked: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AppSetting {
  id: string
  key: string
  value: string
  label: string | null
  updated_at: string
}

export interface SeatingTable {
  id: string
  name: string
  capacity: number
  x: number | null
  y: number | null
  shape: "CIRCLE" | "OVAL" | "RECTANGLE"
  is_head_table: boolean
  created_at: string
  seats?: Seat[]
}

export interface Seat {
  id: string
  table_id: string
  guest_id: string | null
  guest?: Guest | null
}

export interface SeatingConstraint {
  id: string
  guest_a_id: string
  guest_b_id: string
  type: "AVOID" | "PREFER"
  created_at: string
  guest_a?: Guest
  guest_b?: Guest
}

export interface RoomConfig {
  id: string
  room_shape: "RECTANGLE" | "SQUARE"
  aspect_ratio: number
  table_shape: "CIRCLE" | "OVAL" | "RECTANGLE"
  seats_per_table: number
  updated_at: string
}
