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
      attendance: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          check_in: string
          check_out: string
          created_at: string
          date: string
          edit_requested: boolean
          id: string
          original_punch_in: string
          original_punch_out: string
          punch_in_time: string
          punch_out_time: string
          remarks: string
          status: string
          total_hours: number
          updated_at: string
          user_auth_uid: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          check_in?: string
          check_out?: string
          created_at?: string
          date: string
          edit_requested?: boolean
          id?: string
          original_punch_in?: string
          original_punch_out?: string
          punch_in_time?: string
          punch_out_time?: string
          remarks?: string
          status?: string
          total_hours?: number
          updated_at?: string
          user_auth_uid: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          check_in?: string
          check_out?: string
          created_at?: string
          date?: string
          edit_requested?: boolean
          id?: string
          original_punch_in?: string
          original_punch_out?: string
          punch_in_time?: string
          punch_out_time?: string
          remarks?: string
          status?: string
          total_hours?: number
          updated_at?: string
          user_auth_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["auth_uid"]
          },
          {
            foreignKeyName: "attendance_user_auth_uid_fkey"
            columns: ["user_auth_uid"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["auth_uid"]
          },
        ]
      }
      employees: {
        Row: {
          auth_uid: string | null
          created_at: string
          department: string
          designation: string
          email: string
          employee_id: string
          id: string
          joiningDate: string | null
          name: string
          phone: string
          profileImage: string
          role: Database["public"]["Enums"]["app_role"]
          salary: number
          updated_at: string
        }
        Insert: {
          auth_uid?: string | null
          created_at?: string
          department?: string
          designation?: string
          email: string
          employee_id: string
          id?: string
          joiningDate?: string | null
          name: string
          phone?: string
          profileImage?: string
          role?: Database["public"]["Enums"]["app_role"]
          salary?: number
          updated_at?: string
        }
        Update: {
          auth_uid?: string | null
          created_at?: string
          department?: string
          designation?: string
          email?: string
          employee_id?: string
          id?: string
          joiningDate?: string | null
          name?: string
          phone?: string
          profileImage?: string
          role?: Database["public"]["Enums"]["app_role"]
          salary?: number
          updated_at?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      leaves: {
        Row: {
          admin_comment: string
          created_at: string
          end_date: string
          id: string
          reason: string
          start_date: string
          status: string
          type: string
          updated_at: string
          user_auth_uid: string
        }
        Insert: {
          admin_comment?: string
          created_at?: string
          end_date: string
          id?: string
          reason: string
          start_date: string
          status?: string
          type: string
          updated_at?: string
          user_auth_uid: string
        }
        Update: {
          admin_comment?: string
          created_at?: string
          end_date?: string
          id?: string
          reason?: string
          start_date?: string
          status?: string
          type?: string
          updated_at?: string
          user_auth_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_user_auth_uid_fkey"
            columns: ["user_auth_uid"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["auth_uid"]
          },
        ]
      }
      payroll: {
        Row: {
          absentDays: number
          approvedLeaves: number
          basicSalary: number
          created_at: string
          deductions: number
          holidays: number
          id: string
          month: number
          netSalary: number
          presentDays: number
          status: string
          updated_at: string
          user_auth_uid: string
          workingDays: number
          year: number
        }
        Insert: {
          absentDays?: number
          approvedLeaves?: number
          basicSalary?: number
          created_at?: string
          deductions?: number
          holidays?: number
          id?: string
          month: number
          netSalary?: number
          presentDays?: number
          status?: string
          updated_at?: string
          user_auth_uid: string
          workingDays?: number
          year: number
        }
        Update: {
          absentDays?: number
          approvedLeaves?: number
          basicSalary?: number
          created_at?: string
          deductions?: number
          holidays?: number
          id?: string
          month?: number
          netSalary?: number
          presentDays?: number
          status?: string
          updated_at?: string
          user_auth_uid?: string
          workingDays?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_user_auth_uid_fkey"
            columns: ["user_auth_uid"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["auth_uid"]
          },
        ]
      }
      payslips: {
        Row: {
          created_at: string
          id: string
          payroll_id: string | null
          pdf_path: string
          pdfUrl: string | null
          updated_at: string
          user_auth_uid: string
        }
        Insert: {
          created_at?: string
          id?: string
          payroll_id?: string | null
          pdf_path?: string
          pdfUrl?: string | null
          updated_at?: string
          user_auth_uid: string
        }
        Update: {
          created_at?: string
          id?: string
          payroll_id?: string | null
          pdf_path?: string
          pdfUrl?: string | null
          updated_at?: string
          user_auth_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: true
            referencedRelation: "payroll"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_user_auth_uid_fkey"
            columns: ["user_auth_uid"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["auth_uid"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "Admin" | "Employee"
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
      app_role: ["Admin", "Employee"],
    },
  },
} as const
