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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accessibility_checks: {
        Row: {
          background_token_id: string
          checked_at: string
          contrast_ratio: number
          design_system_id: string
          foreground_token_id: string
          id: string
          mode_id: string
          passes_aa_large: boolean
          passes_aa_normal: boolean
          passes_aaa_large: boolean
          passes_aaa_normal: boolean
        }
        Insert: {
          background_token_id: string
          checked_at?: string
          contrast_ratio: number
          design_system_id: string
          foreground_token_id: string
          id?: string
          mode_id: string
          passes_aa_large: boolean
          passes_aa_normal: boolean
          passes_aaa_large: boolean
          passes_aaa_normal: boolean
        }
        Update: {
          background_token_id?: string
          checked_at?: string
          contrast_ratio?: number
          design_system_id?: string
          foreground_token_id?: string
          id?: string
          mode_id?: string
          passes_aa_large?: boolean
          passes_aa_normal?: boolean
          passes_aaa_large?: boolean
          passes_aaa_normal?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "accessibility_checks_background_token_id_fkey"
            columns: ["background_token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessibility_checks_design_system_id_fkey"
            columns: ["design_system_id"]
            isOneToOne: false
            referencedRelation: "design_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessibility_checks_foreground_token_id_fkey"
            columns: ["foreground_token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessibility_checks_mode_id_fkey"
            columns: ["mode_id"]
            isOneToOne: false
            referencedRelation: "modes"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          created_at: string
          design_system_id: string | null
          estimated_cost_usd: number
          feature: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          user_id: string
        }
        Insert: {
          created_at?: string
          design_system_id?: string | null
          estimated_cost_usd: number
          feature: string
          id?: string
          input_tokens: number
          model: string
          output_tokens: number
          user_id: string
        }
        Update: {
          created_at?: string
          design_system_id?: string | null
          estimated_cost_usd?: number
          feature?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_design_system_id_fkey"
            columns: ["design_system_id"]
            isOneToOne: false
            referencedRelation: "design_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      design_systems: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          mcp_token: string
          name: string
          slug: string
          studio_config: Json | null
          target_framework: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          mcp_token?: string
          name: string
          slug: string
          studio_config?: Json | null
          target_framework?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          mcp_token?: string
          name?: string
          slug?: string
          studio_config?: Json | null
          target_framework?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      modes: {
        Row: {
          created_at: string
          design_system_id: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          design_system_id: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          design_system_id?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "modes_design_system_id_fkey"
            columns: ["design_system_id"]
            isOneToOne: false
            referencedRelation: "design_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      token_values: {
        Row: {
          alias_path: string | null
          created_at: string
          id: string
          is_alias: boolean
          mode_id: string
          raw_value: string | null
          token_id: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          alias_path?: string | null
          created_at?: string
          id?: string
          is_alias?: boolean
          mode_id: string
          raw_value?: string | null
          token_id: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          alias_path?: string | null
          created_at?: string
          id?: string
          is_alias?: boolean
          mode_id?: string
          raw_value?: string | null
          token_id?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "token_values_mode_id_fkey"
            columns: ["mode_id"]
            isOneToOne: false
            referencedRelation: "modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_values_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          category: string
          code_syntax: Json | null
          created_at: string
          description: string | null
          design_system_id: string
          id: string
          path: string
          provenance: string
          provenance_meta: Json | null
          rationale: string | null
          sort_order: number
          status: string
          tags: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          category: string
          code_syntax?: Json | null
          created_at?: string
          description?: string | null
          design_system_id: string
          id?: string
          path: string
          provenance: string
          provenance_meta?: Json | null
          rationale?: string | null
          sort_order?: number
          status?: string
          tags?: string[] | null
          type: string
          updated_at?: string
        }
        Update: {
          category?: string
          code_syntax?: Json | null
          created_at?: string
          description?: string | null
          design_system_id?: string
          id?: string
          path?: string
          provenance?: string
          provenance_meta?: Json | null
          rationale?: string | null
          sort_order?: number
          status?: string
          tags?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tokens_design_system_id_fkey"
            columns: ["design_system_id"]
            isOneToOne: false
            referencedRelation: "design_systems"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      design_system_is_public: { Args: { ds_id: string }; Returns: boolean }
      owns_design_system: { Args: { ds_id: string }; Returns: boolean }
      regenerate_mcp_token: {
        Args: { p_design_system_id: string }
        Returns: string
      }
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
    Enums: {},
  },
} as const
