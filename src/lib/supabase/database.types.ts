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
      activity_log: {
        Row: {
          aksi: string
          aktor: string | null
          detail: Json
          id: string
          pada: string
        }
        Insert: {
          aksi: string
          aktor?: string | null
          detail?: Json
          id?: string
          pada?: string
        }
        Update: {
          aksi?: string
          aktor?: string | null
          detail?: Json
          id?: string
          pada?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_aktor_fkey"
            columns: ["aktor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_aktor_fkey"
            columns: ["aktor"]
            isOneToOne: false
            referencedRelation: "profiles_ringkas"
            referencedColumns: ["id"]
          },
        ]
      }
      ancillary_revenues: {
        Row: {
          cab: string
          customer: string
          group_1_gl: string | null
          group_2_gl: string | null
          group_3_gl: string | null
          id: string
          periode: string
          plan_actual: string
          production: number
          synced_at: string
          tahun: number
          text_pl: string | null
          total: number
        }
        Insert: {
          cab: string
          customer: string
          group_1_gl?: string | null
          group_2_gl?: string | null
          group_3_gl?: string | null
          id?: string
          periode: string
          plan_actual: string
          production?: number
          synced_at?: string
          tahun: number
          text_pl?: string | null
          total?: number
        }
        Update: {
          cab?: string
          customer?: string
          group_1_gl?: string | null
          group_2_gl?: string | null
          group_3_gl?: string | null
          id?: string
          periode?: string
          plan_actual?: string
          production?: number
          synced_at?: string
          tahun?: number
          text_pl?: string | null
          total?: number
        }
        Relationships: []
      }
      cabang: {
        Row: {
          hub: string | null
          kode: string
          kota: string
          nama: string
        }
        Insert: {
          hub?: string | null
          kode: string
          kota: string
          nama: string
        }
        Update: {
          hub?: string | null
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
      contract_decisions: {
        Row: {
          alasan: string
          contract_id: string
          id: string
          keputusan: string
          oleh: string
          pada: string
          skenario_id: string | null
        }
        Insert: {
          alasan: string
          contract_id: string
          id?: string
          keputusan: string
          oleh: string
          pada?: string
          skenario_id?: string | null
        }
        Update: {
          alasan?: string
          contract_id?: string
          id?: string
          keputusan?: string
          oleh?: string
          pada?: string
          skenario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_decisions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_decisions_oleh_fkey"
            columns: ["oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_decisions_oleh_fkey"
            columns: ["oleh"]
            isOneToOne: false
            referencedRelation: "profiles_ringkas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_decisions_skenario_id_fkey"
            columns: ["skenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
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
          tipe: Database["public"]["Enums"]["customer_type"] | null
        }
        Insert: {
          customer_id: string
          frequency_score?: number | null
          monetary_score?: number | null
          nama: string
          recency_score?: number | null
          rfm_status: Database["public"]["Enums"]["rfm_status"]
          tipe?: Database["public"]["Enums"]["customer_type"] | null
        }
        Update: {
          customer_id?: string
          frequency_score?: number | null
          monetary_score?: number | null
          nama?: string
          recency_score?: number | null
          rfm_status?: Database["public"]["Enums"]["rfm_status"]
          tipe?: Database["public"]["Enums"]["customer_type"] | null
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
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles_ringkas"
            referencedColumns: ["id"]
          },
        ]
      }
      penalties: {
        Row: {
          cabang_asal: string | null
          customer_id: string
          deskripsi: string
          dilaporkan_pada: string | null
          id: string
          nilai: number | null
          synced_at: string
          tahap: string
          validated_at: string | null
        }
        Insert: {
          cabang_asal?: string | null
          customer_id: string
          deskripsi: string
          dilaporkan_pada?: string | null
          id?: string
          nilai?: number | null
          synced_at?: string
          tahap?: string
          validated_at?: string | null
        }
        Update: {
          cabang_asal?: string | null
          customer_id?: string
          deskripsi?: string
          dilaporkan_pada?: string | null
          id?: string
          nilai?: number | null
          synced_at?: string
          tahap?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "penalties_cabang_asal_fkey"
            columns: ["cabang_asal"]
            isOneToOne: false
            referencedRelation: "cabang"
            referencedColumns: ["kode"]
          },
          {
            foreignKeyName: "penalties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      profiles: {
        Row: {
          berlaku_sampai: string | null
          business_line: Database["public"]["Enums"]["business_line"] | null
          cabang: string | null
          created_at: string
          hub: string | null
          id: string
          nama: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          berlaku_sampai?: string | null
          business_line?: Database["public"]["Enums"]["business_line"] | null
          cabang?: string | null
          created_at?: string
          hub?: string | null
          id: string
          nama: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          berlaku_sampai?: string | null
          business_line?: Database["public"]["Enums"]["business_line"] | null
          cabang?: string | null
          created_at?: string
          hub?: string | null
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
          {
            foreignKeyName: "profiles_hub_fkey"
            columns: ["hub"]
            isOneToOne: false
            referencedRelation: "cabang"
            referencedColumns: ["hub"]
          },
        ]
      }
      receivables: {
        Row: {
          customer_id: string
          d0_30: number
          d121_150: number
          d151_180: number
          d181_360: number
          d31_60: number
          d360_plus: number
          d61_90: number
          d91_120: number
          status: string
          synced_at: string
          total: number
        }
        Insert: {
          customer_id: string
          d0_30?: number
          d121_150?: number
          d151_180?: number
          d181_360?: number
          d31_60?: number
          d360_plus?: number
          d61_90?: number
          d91_120?: number
          status: string
          synced_at?: string
          total?: number
        }
        Update: {
          customer_id?: string
          d0_30?: number
          d121_150?: number
          d151_180?: number
          d181_360?: number
          d31_60?: number
          d360_plus?: number
          d61_90?: number
          d91_120?: number
          status?: string
          synced_at?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "receivables_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      report_links: {
        Row: {
          aktif: boolean
          judul: string
          modul: Database["public"]["Enums"]["app_module"]
          url: string
        }
        Insert: {
          aktif?: boolean
          judul: string
          modul: Database["public"]["Enums"]["app_module"]
          url: string
        }
        Update: {
          aktif?: boolean
          judul?: string
          modul?: Database["public"]["Enums"]["app_module"]
          url?: string
        }
        Relationships: []
      }
      role_delegations: {
        Row: {
          dari: string
          id: string
          ke: string
          mulai: string
          sampai: string | null
        }
        Insert: {
          dari: string
          id?: string
          ke: string
          mulai?: string
          sampai?: string | null
        }
        Update: {
          dari?: string
          id?: string
          ke?: string
          mulai?: string
          sampai?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_delegations_dari_fkey"
            columns: ["dari"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_delegations_dari_fkey"
            columns: ["dari"]
            isOneToOne: false
            referencedRelation: "profiles_ringkas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_delegations_ke_fkey"
            columns: ["ke"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_delegations_ke_fkey"
            columns: ["ke"]
            isOneToOne: false
            referencedRelation: "profiles_ringkas"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_grants: {
        Row: {
          aksi: Database["public"]["Enums"]["grant_action"]
          modul: Database["public"]["Enums"]["app_module"]
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          aksi: Database["public"]["Enums"]["grant_action"]
          modul: Database["public"]["Enums"]["app_module"]
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          aksi?: Database["public"]["Enums"]["grant_action"]
          modul?: Database["public"]["Enums"]["app_module"]
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
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
            foreignKeyName: "scenarios_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_ringkas"
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
          {
            foreignKeyName: "scenarios_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles_ringkas"
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
          tab: string | null
          trigger: Database["public"]["Enums"]["sheet_sync_trigger"]
        }
        Insert: {
          error?: string | null
          finished_at?: string
          id?: string
          rows_written?: number
          started_at?: string
          status: Database["public"]["Enums"]["sheet_sync_status"]
          tab?: string | null
          trigger: Database["public"]["Enums"]["sheet_sync_trigger"]
        }
        Update: {
          error?: string | null
          finished_at?: string
          id?: string
          rows_written?: number
          started_at?: string
          status?: Database["public"]["Enums"]["sheet_sync_status"]
          tab?: string | null
          trigger?: Database["public"]["Enums"]["sheet_sync_trigger"]
        }
        Relationships: []
      }
    }
    Views: {
      profiles_ringkas: {
        Row: {
          id: string | null
          nama: string | null
        }
        Insert: {
          id?: string | null
          nama?: string | null
        }
        Update: {
          id?: string | null
          nama?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      caller_business_line: {
        Args: never
        Returns: Database["public"]["Enums"]["business_line"]
      }
      caller_cabang: { Args: never; Returns: string }
      caller_hub: { Args: never; Returns: string }
      caller_may: {
        Args: {
          a: Database["public"]["Enums"]["grant_action"]
          m: Database["public"]["Enums"]["app_module"]
        }
        Returns: boolean
      }
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
      invoke_sheets_pull: { Args: never; Returns: undefined }
      log_activity: {
        Args: { aksi: string; detail?: Json }
        Returns: undefined
      }
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
      app_module:
        | "kontrak"
        | "crm"
        | "simulator"
        | "piutang"
        | "penalty"
        | "irregularities"
        | "pendapatan"
        | "notifikasi"
        | "report_links"
        | "pengguna"
        | "keputusan"
        | "audit"
      business_line: "Ground Handling" | "Cargo Handling" | "Ancillary Business"
      case_status: "OPEN" | "CLOSED"
      customer_type: "agent" | "non_agent"
      grant_action: "view" | "input" | "approve" | "manage" | "export"
      notification_severity: "critical" | "warning" | "info"
      rfm_status: "HIGH" | "MEDIUM" | "LOW"
      scenario_status: "draft" | "pending" | "approved" | "rejected"
      sheet_sync_status: "ok" | "failed"
      sheet_sync_trigger: "schedule" | "manual"
      user_role:
        | "vp"
        | "commercial_kps"
        | "cabang"
        | "direktur_utama"
        | "finance_kps"
        | "op_kps"
        | "os_kps"
        | "ocs_kps"
        | "super_admin"
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
      app_module: [
        "kontrak",
        "crm",
        "simulator",
        "piutang",
        "penalty",
        "irregularities",
        "pendapatan",
        "notifikasi",
        "report_links",
        "pengguna",
        "keputusan",
        "audit",
      ],
      business_line: [
        "Ground Handling",
        "Cargo Handling",
        "Ancillary Business",
      ],
      case_status: ["OPEN", "CLOSED"],
      customer_type: ["agent", "non_agent"],
      grant_action: ["view", "input", "approve", "manage", "export"],
      notification_severity: ["critical", "warning", "info"],
      rfm_status: ["HIGH", "MEDIUM", "LOW"],
      scenario_status: ["draft", "pending", "approved", "rejected"],
      sheet_sync_status: ["ok", "failed"],
      sheet_sync_trigger: ["schedule", "manual"],
      user_role: [
        "vp",
        "commercial_kps",
        "cabang",
        "direktur_utama",
        "finance_kps",
        "op_kps",
        "os_kps",
        "ocs_kps",
        "super_admin",
      ],
    },
  },
} as const

