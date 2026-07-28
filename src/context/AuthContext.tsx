import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type EmployeeProfile = {
  id: string;
  auth_uid: string;
  employee_id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  joiningDate: string | null;
  salary: number;
  phone: string;
  role: "Admin" | "Employee" | "CEO";
  profileImage: string;
  gps_enabled?: boolean;
  is_active?: boolean;
  employment_status?: "Active" | "Inactive" | string;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  reactivated_at?: string | null;
};

type AuthState = {
  session: Session | null;
  profile: EmployeeProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("auth_uid", uid)
      .maybeSingle();

    const emp = data as EmployeeProfile | null;
    if (emp && (emp.is_active === false || emp.employment_status === "Inactive")) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      return null;
    }
    setProfile(emp);
    return emp;
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => fetchProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const interval = setInterval(() => {
      fetchProfile(session.user.id);
    }, 10000);
    return () => clearInterval(interval);
  }, [session]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.session?.user) {
      const fetched = await fetchProfile(data.session.user.id);
      if (!fetched || fetched.is_active === false || fetched.employment_status === "Inactive") {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        return { error: "Your account is currently inactive. Please contact your administrator." };
      }
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
