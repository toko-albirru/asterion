export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      email_otps: {
        Row: {
          user_id: string
          email: string
          code_hash: string
          expires_at: string
          attempts: number
          send_count: number
          window_start: string
          verified_at: string | null
        }
        Insert: {
          user_id: string
          email: string
          code_hash: string
          expires_at: string
          attempts?: number
          send_count?: number
          window_start?: string
          verified_at?: string | null
        }
        Update: {
          user_id?: string
          email?: string
          code_hash?: string
          expires_at?: string
          attempts?: number
          send_count?: number
          window_start?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          kind: string
          title: string
          body: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          kind: string
          title: string
          body: string
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kind?: string
          title?: string
          body?: string
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      student_domain_rules: {
        Row: {
          domain: string
          kind: string
          note: string | null
          created_at: string
        }
        Insert: {
          domain: string
          kind: string
          note?: string | null
          created_at?: string
        }
        Update: {
          domain?: string
          kind?: string
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      student_verifications: {
        Row: {
          user_id: string
          status: string
          full_name: string | null
          nim: string | null
          nim_hash: string | null
          nim_last4: string | null
          university: string | null
          faculty: string | null
          study_program: string | null
          entry_year: number | null
          campus_email: string | null
          email_verified_at: string | null
          ktm_path: string | null
          support_kind: string | null
          support_path: string | null
          ocr_text: string | null
          ocr_fields: Json | null
          quality: Json | null
          score: number | null
          flags: string[]
          decision_source: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          reject_reason: string | null
          submitted_at: string
          verified_at: string | null
          expires_at: string | null
          docs_purge_after: string | null
          docs_purged_at: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          status?: string
          full_name?: string | null
          nim?: string | null
          nim_hash?: string | null
          nim_last4?: string | null
          university?: string | null
          faculty?: string | null
          study_program?: string | null
          entry_year?: number | null
          campus_email?: string | null
          email_verified_at?: string | null
          ktm_path?: string | null
          support_kind?: string | null
          support_path?: string | null
          ocr_text?: string | null
          ocr_fields?: Json | null
          quality?: Json | null
          score?: number | null
          flags?: string[]
          decision_source?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          reject_reason?: string | null
          submitted_at?: string
          verified_at?: string | null
          expires_at?: string | null
          docs_purge_after?: string | null
          docs_purged_at?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          status?: string
          full_name?: string | null
          nim?: string | null
          nim_hash?: string | null
          nim_last4?: string | null
          university?: string | null
          faculty?: string | null
          study_program?: string | null
          entry_year?: number | null
          campus_email?: string | null
          email_verified_at?: string | null
          ktm_path?: string | null
          support_kind?: string | null
          support_path?: string | null
          ocr_text?: string | null
          ocr_fields?: Json | null
          quality?: Json | null
          score?: number | null
          flags?: string[]
          decision_source?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          reject_reason?: string | null
          submitted_at?: string
          verified_at?: string | null
          expires_at?: string | null
          docs_purge_after?: string | null
          docs_purged_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      institution_coupons: {
        Row: {
          email_domains: string[]
          amount_idr: number
          code: string
          created_at: string
          days: number
          discount_pct: number
          email_domain: string | null
          exhausted_at: string | null
          id: string
          institution_name: string
          owner_id: string
          paid_at: string | null
          seats: number
          status: string
          valid_until: string
        }
        Insert: {
          email_domains?: string[]
          amount_idr: number
          code: string
          created_at?: string
          days: number
          discount_pct: number
          email_domain?: string | null
          exhausted_at?: string | null
          id?: string
          institution_name: string
          owner_id: string
          paid_at?: string | null
          seats: number
          status?: string
          valid_until: string
        }
        Update: {
          email_domains?: string[]
          amount_idr?: number
          code?: string
          created_at?: string
          days?: number
          discount_pct?: number
          email_domain?: string | null
          exhausted_at?: string | null
          id?: string
          institution_name?: string
          owner_id?: string
          paid_at?: string | null
          seats?: number
          status?: string
          valid_until?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          license_id: string | null
          order_id: string
          redeemed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          license_id?: string | null
          order_id: string
          redeemed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          license_id?: string | null
          order_id?: string
          redeemed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      licenses: {
        Row: {
          source: string
          coupon_id: string | null
          cancelled_at: string | null
          activated_at: string | null
          created_at: string
          device_id: string | null
          device_label: string | null
          expires_at: string
          id: string
          last_seen_at: string | null
          payment_status: string
          plan: string
          price_idr: number
          starts_at: string
          token: string
          user_id: string
        }
        Insert: {
          source?: string
          coupon_id?: string | null
          cancelled_at?: string | null
          activated_at?: string | null
          created_at?: string
          device_id?: string | null
          device_label?: string | null
          expires_at: string
          id?: string
          last_seen_at?: string | null
          payment_status?: string
          plan?: string
          price_idr?: number
          starts_at?: string
          token: string
          user_id: string
        }
        Update: {
          source?: string
          coupon_id?: string | null
          cancelled_at?: string | null
          activated_at?: string | null
          created_at?: string
          device_id?: string | null
          device_label?: string | null
          expires_at?: string
          id?: string
          last_seen_at?: string | null
          payment_status?: string
          plan?: string
          price_idr?: number
          starts_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          plan: string | null
          months: number | null
          base_amount_idr: number | null
          unique_code: number | null
          label: string | null
          claimed_at: string | null
          confirmed_by: string | null
          confirmed_at: string | null
          reject_reason: string | null
          settled_at: string | null
          amount_idr: number
          cancel_note: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          coupon_id: string | null
          created_at: string
          days: number | null
          discount_idr: number
          expires_at: string | null
          id: string
          kind: string
          license_id: string | null
          order_id: string
          paid_at: string | null
          provider: string
          qr_string: string | null
          qr_url: string | null
          snap_token: string | null
          snap_redirect_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          plan?: string | null
          months?: number | null
          base_amount_idr?: number | null
          unique_code?: number | null
          label?: string | null
          claimed_at?: string | null
          confirmed_by?: string | null
          confirmed_at?: string | null
          reject_reason?: string | null
          settled_at?: string | null
          amount_idr: number
          cancel_note?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          coupon_id?: string | null
          created_at?: string
          days?: number | null
          discount_idr?: number
          expires_at?: string | null
          id?: string
          kind?: string
          license_id?: string | null
          order_id: string
          paid_at?: string | null
          provider: string
          qr_string?: string | null
          qr_url?: string | null
          snap_token?: string | null
          snap_redirect_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          plan?: string | null
          months?: number | null
          base_amount_idr?: number | null
          unique_code?: number | null
          label?: string | null
          claimed_at?: string | null
          confirmed_by?: string | null
          confirmed_at?: string | null
          reject_reason?: string | null
          settled_at?: string | null
          amount_idr?: number
          cancel_note?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          coupon_id?: string | null
          created_at?: string
          days?: number | null
          discount_idr?: number
          expires_at?: string | null
          id?: string
          kind?: string
          license_id?: string | null
          order_id?: string
          paid_at?: string | null
          provider?: string
          qr_string?: string | null
          qr_url?: string | null
          snap_token?: string | null
          snap_redirect_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_institution_coupon: {
        Args: { p_user: string; p_email: string; p_code: string; p_token: string }
        Returns: { out_license_id: string; out_expires_at: string; out_institution: string }[]
      }
      expire_stale_qris: { Args: Record<PropertyKey, never>; Returns: number }
      expire_student_verifications: { Args: Record<PropertyKey, never>; Returns: number }
      next_qris_code: { Args: { p_base: number }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
