// AUTO-GENERATED — do not edit by hand.
// Regenerate by asking Claude: "regenerate my Supabase types"
// Last generated: 2026-03-21

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      budget_items: {
        Row: {
          active: boolean
          actual_invoiced_eur: number
          actual_paid_eur: number
          budget_item_id: string
          category: string
          created_at: string
          description: string
          id: string
          notes: string | null
          price_per_unit_eur: number
          units: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          active?: boolean
          actual_invoiced_eur?: number
          actual_paid_eur?: number
          budget_item_id: string
          category: string
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          price_per_unit_eur?: number
          units?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          active?: boolean
          actual_invoiced_eur?: number
          actual_paid_eur?: number
          budget_item_id?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          price_per_unit_eur?: number
          units?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: []
      }
      decisions: {
        Row: {
          created_at: string
          date: string | null
          decision_id: string
          id: string
          locked: boolean
          notes: string | null
          options_considered: string | null
          owner: string | null
          rationale: string | null
          updated_at: string
          what_was_decided: string
        }
        Insert: {
          created_at?: string
          date?: string | null
          decision_id: string
          id?: string
          locked?: boolean
          notes?: string | null
          options_considered?: string | null
          owner?: string | null
          rationale?: string | null
          updated_at?: string
          what_was_decided: string
        }
        Update: {
          created_at?: string
          date?: string | null
          decision_id?: string
          id?: string
          locked?: boolean
          notes?: string | null
          options_considered?: string | null
          owner?: string | null
          rationale?: string | null
          updated_at?: string
          what_was_decided?: string
        }
        Relationships: []
      }
      guests: {
        Row: {
          allergies_notes: string | null
          children_allergies: string | null
          children_count: number
          children_dietary: string | null
          created_at: string
          dietary_requirement: string | null
          email: string | null
          first_name: string
          follow_up_notes: string | null
          guest_id: string
          head_guest_id: string | null
          id: string
          invite_date: string | null
          invite_sent: boolean
          is_head_table: boolean | null
          last_name: string | null
          phone: string | null
          rsvp_date: string | null
          rsvp_status: string
          save_the_date_sent: boolean
          side: string
          table_number: number | null
          updated_at: string
        }
        Insert: {
          allergies_notes?: string | null
          children_allergies?: string | null
          children_count?: number
          children_dietary?: string | null
          created_at?: string
          dietary_requirement?: string | null
          email?: string | null
          first_name: string
          follow_up_notes?: string | null
          guest_id: string
          head_guest_id?: string | null
          id?: string
          invite_date?: string | null
          invite_sent?: boolean
          is_head_table?: boolean | null
          last_name?: string | null
          phone?: string | null
          rsvp_date?: string | null
          rsvp_status?: string
          save_the_date_sent?: boolean
          side: string
          table_number?: number | null
          updated_at?: string
        }
        Update: {
          allergies_notes?: string | null
          children_allergies?: string | null
          children_count?: number
          children_dietary?: string | null
          created_at?: string
          dietary_requirement?: string | null
          email?: string | null
          first_name?: string
          follow_up_notes?: string | null
          guest_id?: string
          head_guest_id?: string | null
          id?: string
          invite_date?: string | null
          invite_sent?: boolean
          is_head_table?: boolean | null
          last_name?: string | null
          phone?: string | null
          rsvp_date?: string | null
          rsvp_status?: string
          save_the_date_sent?: boolean
          side?: string
          table_number?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_eur: number
          budget_item_id: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_id: string
          notes: string | null
          paid: boolean
          paid_by: string | null
          paid_date: string | null
          payment_method: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount_eur?: number
          budget_item_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_id: string
          notes?: string | null
          paid?: boolean
          paid_by?: string | null
          paid_date?: string | null
          payment_method?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount_eur?: number
          budget_item_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_id?: string
          notes?: string | null
          paid?: boolean
          paid_by?: string | null
          paid_date?: string | null
          payment_method?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: []
      }
      room_config: {
        Row: {
          aspect_ratio: number | null
          id: string
          room_shape: string | null
          seats_per_table: number | null
          table_shape: string | null
          updated_at: string | null
        }
        Insert: {
          aspect_ratio?: number | null
          id?: string
          room_shape?: string | null
          seats_per_table?: number | null
          table_shape?: string | null
          updated_at?: string | null
        }
        Update: {
          aspect_ratio?: number | null
          id?: string
          room_shape?: string | null
          seats_per_table?: number | null
          table_shape?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      seating_constraints: {
        Row: {
          created_at: string | null
          guest_a_id: string
          guest_b_id: string
          id: string
          type: string
        }
        Insert: {
          created_at?: string | null
          guest_a_id: string
          guest_b_id: string
          id?: string
          type: string
        }
        Update: {
          created_at?: string | null
          guest_a_id?: string
          guest_b_id?: string
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "seating_constraints_guest_a_id_fkey"
            columns: ["guest_a_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seating_constraints_guest_b_id_fkey"
            columns: ["guest_b_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      seating_tables: {
        Row: {
          capacity: number
          created_at: string | null
          id: string
          is_head_table: boolean | null
          name: string
          shape: string | null
          x: number | null
          y: number | null
        }
        Insert: {
          capacity?: number
          created_at?: string | null
          id?: string
          is_head_table?: boolean | null
          name: string
          shape?: string | null
          x?: number | null
          y?: number | null
        }
        Update: {
          capacity?: number
          created_at?: string | null
          id?: string
          is_head_table?: boolean | null
          name?: string
          shape?: string | null
          x?: number | null
          y?: number | null
        }
        Relationships: []
      }
      seats: {
        Row: {
          guest_id: string | null
          id: string
          table_id: string
        }
        Insert: {
          guest_id?: string | null
          id?: string
          table_id: string
        }
        Update: {
          guest_id?: string | null
          id?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seats_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seats_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "seating_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: string
          key: string
          label: string | null
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          label?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          label?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          due_date: string | null
          id: string
          name: string
          notes: string | null
          priority: string | null
          status: string | null
          task_id: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          due_date?: string | null
          id?: string
          name: string
          notes?: string | null
          priority?: string | null
          status?: string | null
          task_id: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          due_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          priority?: string | null
          status?: string | null
          task_id?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          category: string
          contact_name: string | null
          contract_signed: boolean
          contract_value_eur: number
          created_at: string
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
          vendor_id: string
          vendor_name: string
        }
        Insert: {
          category: string
          contact_name?: string | null
          contract_signed?: boolean
          contract_value_eur?: number
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vendor_id: string
          vendor_name: string
        }
        Update: {
          category?: string
          contact_name?: string | null
          contract_signed?: boolean
          contract_value_eur?: number
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vendor_id?: string
          vendor_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
