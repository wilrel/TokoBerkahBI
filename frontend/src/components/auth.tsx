'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMe, getStoredWorkspaceId, getToken, logout as clearSession, setWorkspaceId } from '@/lib/api';
import type { Me, Membership } from '@/lib/types';
import type { Role } from '@/lib/roles';

type AuthState = {
  status: 'loading' | 'anonymous' | 'ready';
  user: Me | null;
  membership: Membership | null;
  role: Role | null;
  switchStore: (workspaceId: number) => void;
  refresh: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<Me | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setStatus('anonymous');
      return;
    }
    try {
      const me = await getMe();
      const stored = getStoredWorkspaceId();
      const chosen = me.memberships.find((m) => m.workspace_id === stored) ?? me.memberships[0] ?? null;
      // Pasang toko aktif di klien API sebelum halaman mana pun memanggil API.
      setWorkspaceId(chosen?.workspace_id ?? null);
      setActiveId(chosen?.workspace_id ?? null);
      setUser(me);
      setStatus('ready');
    } catch {
      clearSession();
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- membaca sesi tersimpan saat aplikasi dibuka
    refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(() => {
    const membership = user?.memberships.find((m) => m.workspace_id === activeId) ?? null;
    return {
      status,
      user,
      membership,
      role: membership?.role ?? null,
      switchStore: (id) => {
        setWorkspaceId(id);
        setActiveId(id);
      },
      refresh,
      logout: () => {
        clearSession();
        setUser(null);
        setActiveId(null);
        setStatus('anonymous');
      },
    };
  }, [status, user, activeId, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const initials = (name: string | null | undefined, email: string) =>
  (name?.trim() || email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
