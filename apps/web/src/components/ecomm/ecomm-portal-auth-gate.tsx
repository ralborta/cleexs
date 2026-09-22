'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Lock, Loader2 } from 'lucide-react';

const PORTAL_TITLE = 'Admin Ecomm';

type Props = {
  children: ReactNode;
};

export function EcommPortalAuthGate({ children }: Props) {
  const [booting, setBooting] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState('Demo');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/ecomm/portal-auth/me', { cache: 'no-store' });
        if (!cancelled) setAuthed(res.ok);
      } catch {
        if (!cancelled) setAuthed(false);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ecomm/portal-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setAuthed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    try {
      await fetch('/api/ecomm/portal-auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthed(false);
    setPassword('');
  }

  if (booting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- asset estático en /public */}
            <img src="/CleexsLogo.png" alt="Cleexs" className="h-12 w-auto object-contain" />
            <Lock className="mt-3 h-5 w-5 text-slate-400" aria-hidden />
          </div>
          <h1 className="mt-4 text-center text-lg font-semibold text-slate-900">{PORTAL_TITLE}</h1>
          <p className="mt-1 text-center text-xs text-slate-500">Portal Empliados · acceso demo</p>
          {error ? (
            <p className="mt-4 rounded-md bg-red-50 p-2 text-center text-sm text-red-700">{error}</p>
          ) : null}
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Usuario</span>
              <input
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(ev) => setUsername(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-50 sm:right-6 sm:top-4">
        <button
          type="button"
          onClick={() => void onLogout()}
          className="rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur hover:bg-white"
        >
          Salir
        </button>
      </div>
      {children}
    </div>
  );
}
