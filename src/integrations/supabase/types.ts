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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          admin_email: string
          created_at: string
          id: string
          max_volunteers_per_day: number
          notification_hours_before: number
          service_start_time: string
          updated_at: string
        }
        Insert: {
          admin_email: string
          created_at?: string
          id?: string
          max_volunteers_per_day?: number
          notification_hours_before?: number
          service_start_time?: string
          updated_at?: string
        }
        Update: {
          admin_email?: string
          created_at?: string
          id?: string
          max_volunteers_per_day?: number
          notification_hours_before?: number
          service_start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string
          email_to: string
          email_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          related_id: string | null
          resend_message_id: string | null
          retry_count: number
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          email_to: string
          email_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          related_id?: string | null
          resend_message_id?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          email_to?: string
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          related_id?: string | null
          resend_message_id?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          confirmed_at: string | null
          created_at: string
          id: string
          reservation_date: string
          status: string
          volunteer_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          reservation_date: string
          status?: string
          volunteer_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          reservation_date?: string
          status?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      volunteers: {
        Row: {
          address: string
          age: number
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          status: string
        }
        Insert: {
          address: string
          age: number
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          status?: string
        }
        Update: {
          address?: string
          age?: number
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_duplicate_email: {
        Args: {
          p_email_to: string
          p_email_type: string
          p_related_id: string
          p_time_window_minutes?: number
        }
        Returns: boolean
      }
      get_available_slots: { Args: { target_date: string }; Returns: number }
      get_reservations_count: { Args: { target_date: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "volunteer"
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
  public: {
    Enums: {
      app_role: ["admin", "volunteer"],
    },
  },
} as const
