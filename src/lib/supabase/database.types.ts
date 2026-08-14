export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cabang: {
        Row: {
          kode: string
          kota: string
          nama: string
        }
        Insert: {
          kode: string
          kota: string
          nama: string
        }
        Update: {
          kode?: string
          kota?: string
          nama?: string
        }
        Relationships: []
      }
      cases: {
        Row: {
          customer_id: string
          description: string
          id: string
          status: Database["public"]["Enums"]["case_status"]
        }
        Insert: {
          customer_id: string
          description: string
          id?: string
          status: Database["public"]["Enums"]["case_status"]
        }
        Update: {
          customer_id?: string
          description?: string
          id?: string
          status?: Database["public"]["Enums"]["case_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      contracts: {
        Row: {
          business_line: Database["public"]["Enums"]["business_line"]
          cabang: string | null
          contract_end_date: string
          contract_no: string | null
          contract_start_date: string | null
          cost: number
          customer_id: string
          followed_up_at: string | null
          id: string
          latest_contract: string | null
          min_gpm_target: number | null
          pic_email: string | null
          pic_nama: string | null
          pic_telepon: string | null
          previous_end_date: string | null
          remarks: string | null
          service_type: string | null
          source_end_date: string | null
          tarif: number
          updated_at: string
          volume: number | null
        }
        Insert: {
          business_line: Database["public"]["Enums"]["business_line"]
          cabang?: string | null
          contract_end_date: string
          contract_no?: string | null
          contract_start_date?: string | null
          cost: number
          customer_id: string
          followed_up_at?: string | null
          id?: string
          latest_contract?: string | null
          min_gpm_target?: number | null
          pic_email?: string | null
          pic_nama?: string | null
          pic_telepon?: string | null
          previous_end_date?: string | null
          remarks?: string | null
          service_type?: string | null
          source_end_date?: string | null
          tarif: number
          updated_at?: string
          volume?: number | null
        }
        Update: {
          business_line?: Database["public"]["Enums"]["business_line"]
          cabang?: string | null
          contract_end_date?: string
          contract_no?: string | null
          contract_start_date?: string | null
          cost?: number
          customer_id?: string
          followed_up_at?: string | null
          id?: string
          latest_contract?: string | null
          min_gpm_target?: number | null
          pic_email?: string | null
          pic_nama?: string | null
          pic_telepon?: string | null
          previous_end_date?: string | null
          remarks?: string | null
          service_type?: string | null
          source_end_date?: string | null
          tarif?: number
          updated_at?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_cabang_fkey"
            columns: ["cabang"]
            isOneToOne: false
            referencedRelation: "cabang"
            referencedColumns: ["kode"]
          },
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      customers: {
        Row: {
          customer_id: string
          frequency_score: number | null
          monetary_score: number | null
          nama: string
          recency_score: number | null
          rfm_status: Database["public"]["Enums"]["rfm_status"]
        }
        Insert: {
          customer_id: string
          frequency_score?: number | null
          monetary_score?: number | null
          nama: string
          recency_score?: number | null
          rfm_status: Database["public"]["Enums"]["rfm_status"]
        }
        Update: {
          customer_id?: string
          frequency_score?: number | null
          monetary_score?: number | null
          nama?: string
          recency_score?: number | null
          rfm_status?: Database["public"]["Enums"]["rfm_status"]
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          contract_id: string | null
          created_at: string
          emailed_at: string | null
          id: string
          milestone_key: string | null
          read: boolean
          recipient_id: string
          severity: Database["public"]["Enums"]["notification_severity"]
          title: string
        }
        Insert: {
          body: string
          contract_id?: string | null
          created_at?: string
          emailed_at?: string | null
          id?: string
          milestone_key?: string | null
          read?: boolean
          recipient_id: string
          severity: Database["public"]["Enums"]["notification_severity"]
          title: string
        }
        Update: {
          body?: string
          contract_id?: string | null
          created_at?: string
          emailed_at?: string | null
          id?: string
          milestone_key?: string | null
          read?: boolean
          recipient_id?: string
          severity?: Database["public"]["Enums"]["notification_severity"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_line: Database["public"]["Enums"]["business_line"] | null
          cabang: string | null
          created_at: string
          id: string
          nama: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          business_line?: Database["public"]["Enums"]["business_line"] | null
          cabang?: string | null
          created_at?: string
          id: string
          nama: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          business_line?: Database["public"]["Enums"]["business_line"] | null
          cabang?: string | null
          created_at?: string
          id?: string
          nama?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cabang_fkey"
            columns: ["cabang"]
            isOneToOne: false
            referencedRelation: "cabang"
            referencedColumns: ["kode"]
          },
        ]
      }
      scenarios: {
        Row: {
          author_id: string
          contract_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          gpm: number | null
          id: string
          nama: string
          proposed_cost: number
          proposed_tarif: number
          rejection_reason: string | null
          status: Database["public"]["Enums"]["scenario_status"]
        }
        Insert: {
          author_id: string
          contract_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          gpm?: number | null
          id?: string
          nama: string
          proposed_cost: number
          proposed_tarif: number
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["scenario_status"]
        }
        Update: {
          author_id?: string
          contract_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          gpm?: number | null
          id?: string
          nama?: string
          proposed_cost?: number
          proposed_tarif?: number
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["scenario_status"]
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenarios_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenarios_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_syncs: {
        Row: {
          error: string | null
          finished_at: string
          id: string
          rows_written: number
          started_at: string
          status: Database["public"]["Enums"]["sheet_sync_status"]
          trigger: Database["public"]["Enums"]["sheet_sync_trigger"]
        }
        Insert: {
          error?: string | null
          finished_at?: string
          id?: string
          rows_written?: number
          started_at?: string
          status: Database["public"]["Enums"]["sheet_sync_status"]
          trigger: Database["public"]["Enums"]["sheet_sync_trigger"]
        }
        Update: {
          error?: string | null
          finished_at?: string
          id?: string
          rows_written?: number
          started_at?: string
          status?: Database["public"]["Enums"]["sheet_sync_status"]
          trigger?: Database["public"]["Enums"]["sheet_sync_trigger"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      caller_business_line: {
        Args: never
        Returns: Database["public"]["Enums"]["business_line"]
      }
      caller_cabang: { Args: never; Returns: string }
      caller_is_vp: { Args: never; Returns: boolean }
      caller_may_write: { Args: never; Returns: boolean }
      caller_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      caller_sees_all_lines: { Args: never; Returns: boolean }
      caller_sees_all_scopes: { Args: never; Returns: boolean }
      in_caller_scope: {
        Args: { bl: Database["public"]["Enums"]["business_line"]; cb: string }
        Returns: boolean
      }
      invoke_reminder_email: { Args: never; Returns: undefined }
      invoke_sheets_sync: { Args: never; Returns: undefined }
      mark_notification_emailed: {
        Args: { notification_id: string }
        Returns: undefined
      }
      send_expiry_reminders: {
        Args: { target_contract_id?: string }
        Returns: Database["public"]["CompositeTypes"]["reminder_outcome"][]
        SetofOptions: {
          from: "*"
          to: "reminder_outcome"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      business_line: "Ground Handling" | "Cargo Handling" | "Ancillary Business"
      case_status: "OPEN" | "CLOSED"
      notification_severity: "critical" | "warning" | "info"
      rfm_status: "HIGH" | "MEDIUM" | "LOW"
      scenario_status: "draft" | "pending" | "approved" | "rejected"
      sheet_sync_status: "ok" | "failed"
      sheet_sync_trigger: "schedule" | "manual"
      user_role: "vp" | "commercial" | "cabang"
    }
    CompositeTypes: {
      reminder_outcome: {
        contract_id: string | null
        customer_nama: string | null
        days_remaining: number | null
        milestone: number | null
        recipient_id: string | null
        notification_id: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      business_line: [
        "Ground Handling",
        "Cargo Handling",
        "Ancillary Business",
      ],
      case_status: ["OPEN", "CLOSED"],
      notification_severity: ["critical", "warning", "info"],
      rfm_status: ["HIGH", "MEDIUM", "LOW"],
      scenario_status: ["draft", "pending", "approved", "rejected"],
      sheet_sync_status: ["ok", "failed"],
      sheet_sync_trigger: ["schedule", "manual"],
      user_role: ["vp", "commercial", "cabang"],
    },
  },
} as const

