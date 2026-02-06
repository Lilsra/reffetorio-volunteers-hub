import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "volunteer";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isLoading: boolean;
  isAdmin: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    isLoading: true,
    isAdmin: false,
  });

  const fetchRole = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching role:", error);
      return null;
    }
    return (data?.role as AppRole) ?? null;
  }, []);

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null;
        let role: AppRole | null = null;

        if (user) {
          // Use setTimeout to avoid Supabase client deadlock
          setTimeout(async () => {
            role = await fetchRole(user.id);
            setState({
              user,
              session,
              role,
              isLoading: false,
              isAdmin: role === "admin",
            });
          }, 0);
        } else {
          setState({
            user: null,
            session: null,
            role: null,
            isLoading: false,
            isAdmin: false,
          });
        }
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null;
      let role: AppRole | null = null;
      if (user) {
        role = await fetchRole(user.id);
      }
      setState({
        user,
        session,
        role,
        isLoading: false,
        isAdmin: role === "admin",
      });
    });

    return () => subscription.unsubscribe();
  }, [fetchRole]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { ...state, signOut };
}
