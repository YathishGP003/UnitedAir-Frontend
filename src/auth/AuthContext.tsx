import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, clearSession, storeSession, storedToken, storedUser } from "../api/client";
import type { RegisterInput, RoleName, UserProfile } from "../types";

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<UserProfile>;
  register: (input: RegisterInput) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  /** Landing route for a role, used after sign-in and by the root redirect. */
  homeFor: (role: RoleName) => string;
}

const AuthContext = createContext<AuthState | null>(null);

const HOME_BY_ROLE: Record<RoleName, string> = {
  PASSENGER: "/passenger",
  AIRLINE_STAFF: "/staff",
  ADMIN: "/governance",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restore from localStorage so a refresh does not sign the user out.
  const [user, setUser] = useState<UserProfile | null>(() =>
    storedToken() ? storedUser<UserProfile>() : null,
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const login = await api.login(email, password);
    storeSession(login);
    setUser(login.user);
    return login.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clearSession();
      setUser(null);
    }
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const login = await api.register(input);
    storeSession(login);
    setUser(login.user);
    return login.user;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      signIn,
      register,
      signOut,
      homeFor: (role) => HOME_BY_ROLE[role] ?? "/passenger",
    }),
    [user, signIn, register, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
