'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Lock,
  MoreHorizontal,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { PortalCrecimientoTierNav } from '@/components/portal/portal-crecimiento-tier-nav';
import { PortalFreeTierNav } from '@/components/portal/portal-free-tier-nav';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** En Free: vos + 1 invitado como máximo. */
const FREE_SEAT_LIMIT = 2;
const PREMIUM_SEAT_LIMIT = 10;

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
  account?: { email?: string };
  usage?: { scoreViews?: number };
  limits?: { scoreViews?: number | null };
};

type Role = 'Administrador' | 'Editor';

type TeamMember = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  role: Role;
  joinedAt: string;
  status: 'Activo' | 'Pendiente';
};

const ROLE_COLORS: Record<Role, string> = {
  Administrador: 'bg-violet-100 text-violet-800',
  Editor: 'bg-blue-100 text-blue-800',
};

function isPremiumPlan(planKey?: string) {
  return planKey === 'crecimiento' || planKey === 'enterprise';
}

function isFreePortalPlan(planKey?: string) {
  return planKey === 'free' || planKey === 'anonymous' || !planKey;
}

function nextRenewalLabel() {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return next.toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function displayNameFromEmail(email?: string) {
  if (!email) return 'Tu cuenta';
  const local = email.split('@')[0] ?? '';
  const pretty = local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return pretty || 'Tu cuenta';
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]!;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function InviteModalFree({
  onClose,
  onAdd,
  remaining,
}: {
  onClose: () => void;
  onAdd: (member: Omit<TeamMember, 'id' | 'joinedAt' | 'status'>) => void;
  remaining: number;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [role, setRole] = useState<Role>('Editor');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (remaining <= 0) {
      setError('En plan Free solo podés sumar 1 invitado. Con Premium podés tener hasta 10 miembros.');
      return;
    }
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Ingresá un email válido.');
      return;
    }
    if (!whatsapp.trim()) {
      setError('El número de WhatsApp es obligatorio.');
      return;
    }
    onAdd({ name: name.trim(), email: email.trim(), whatsapp: whatsapp.trim(), role });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
              <UserPlus className="h-5 w-5 text-violet-700" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Invitar miembro</h2>
              <p className="text-xs text-slate-500">
                Plan Free: 1 invitado incluido. Con Premium sumás hasta {PREMIUM_SEAT_LIMIT} miembros en total.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/80 p-3 text-xs text-violet-900">
          <p className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>Premium</strong> permite gestionar equipos de hasta <strong>{PREMIUM_SEAT_LIMIT} personas</strong>{' '}
              con el mismo diseño y flujos avanzados.
            </span>
          </p>
          <Link href="/planes" className="mt-2 inline-block text-[11px] font-semibold text-violet-700 hover:underline">
            Ver planes y ampliar equipo →
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Nombre completo *</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="María Pérez"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Correo electrónico *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@empresa.com"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              WhatsApp * <span className="font-normal text-slate-500">(+54 9 …)</span>
            </label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+54 9 11 2345 6789"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Rol</label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              >
                <option value="Editor">Editor</option>
                <option value="Administrador">Administrador</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={remaining <= 0}
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar invitación
          </button>
        </form>
      </div>
    </div>
  );
}

export type EquipoPortalFreeShell = 'portal-cliente' | 'portal-crecimiento';

export function EquipoPortalFreePage({ shell }: { shell: EquipoPortalFreeShell }) {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        let token: string | null = null;
        try {
          token = sessionStorage.getItem(TOKEN_KEY);
        } catch {
          token = null;
        }
        if (!token) {
          setLoadError(
            shell === 'portal-cliente'
              ? 'No hay sesión. Entrá desde /portal-cliente e iniciá sesión.'
              : 'No hay sesión. Entrá desde /portal-crecimiento e iniciá sesión.',
          );
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_URL}/api/me/usage`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setLoadError('Sesión vencida. Volvé al portal e iniciá sesión.');
          setLoading(false);
          return;
        }
        const data = res.ok ? ((await res.json()) as UsageResponse) : {};
        if (isPremiumPlan(data.planKey)) {
          if (!cancelled) router.replace(`/portal-crecimiento/reporte/${runId}/premium/equipo`);
          return;
        }
        if (!cancelled) {
          setUsage(data);
          const email = data.account?.email ?? 'cuenta@ejemplo.com';
          const admin: TeamMember = {
            id: 'admin-self',
            name: displayNameFromEmail(email),
            email,
            whatsapp: '—',
            role: 'Administrador',
            joinedAt: new Date().toISOString().slice(0, 10),
            status: 'Activo',
          };
          setMembers([admin]);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, router, shell]);

  const analysesUsed = usage?.usage?.scoreViews ?? 0;
  const analysesLimitRaw = usage?.limits?.scoreViews;
  const analysesLimitForNav = analysesLimitRaw ?? 2;

  const base =
    shell === 'portal-cliente'
      ? `/portal-cliente/reporte/${runId}`
      : `/portal-crecimiento/reporte/${runId}/cliente`;

  const used = members.length;
  const remaining = Math.max(0, FREE_SEAT_LIMIT - used);
  const pct = Math.min(100, Math.round((used / FREE_SEAT_LIMIT) * 100));

  function handleAdd(member: Omit<TeamMember, 'id' | 'joinedAt' | 'status'>) {
    if (members.length >= FREE_SEAT_LIMIT) return;
    setMembers((prev) => [
      ...prev,
      {
        ...member,
        id: String(Date.now()),
        joinedAt: new Date().toISOString().slice(0, 10),
        status: 'Pendiente',
      },
    ]);
  }

  function handleRemove(id: string) {
    if (id === 'admin-self') return;
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setMenuOpen(null);
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md space-y-4 rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-rose-800">{loadError}</p>
          <Link
            href={shell === 'portal-cliente' ? '/portal-cliente' : '/portal-crecimiento'}
            className="inline-block text-sm font-semibold text-violet-700 hover:underline"
          >
            ← Volver al portal
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">Cargando…</p>
      </main>
    );
  }

  if (!isFreePortalPlan(usage?.planKey)) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">Redirigiendo…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        {shell === 'portal-cliente' ? (
          <PortalFreeTierNav
            basePath={base}
            analysesUsed={analysesUsed}
            analysesLimit={analysesLimitForNav}
            renewalLabel={nextRenewalLabel()}
          />
        ) : (
          <PortalCrecimientoTierNav
            basePath={base}
            runId={runId}
            planLabel={usage?.planDisplay || usage?.planKey || 'Free'}
            analysesUsed={analysesUsed}
            analysesLimit={analysesLimitForNav}
            renewalLabel={nextRenewalLabel()}
          />
        )}

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-6">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              <Users className="h-3.5 w-3.5" />
              Equipo
            </div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Gestioná el acceso de tu equipo</h1>
            <p className="mt-2 text-xs text-slate-600 sm:text-sm">
              En plan <strong>Free</strong> podés sumar <strong>1 invitado</strong> además de tu cuenta.{' '}
              <strong>Premium</strong> incluye hasta <strong>{PREMIUM_SEAT_LIMIT} miembros</strong> del equipo y analítica
              ampliada.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <Users className="h-5 w-5 text-violet-700" />
              </span>
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-medium text-slate-500 sm:text-xs">Límite incluido en plan Free</p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                  <p className="text-2xl font-bold text-slate-900">{FREE_SEAT_LIMIT}</p>
                  <p className="text-sm font-medium text-slate-700">miembros</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-700">
                    Vos + 1 invitado
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  Con <Link href="/planes" className="font-semibold text-violet-700 hover:underline">Premium</Link>: hasta{' '}
                  {PREMIUM_SEAT_LIMIT} personas.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="relative h-[4.5rem] w-[4.5rem]">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth="3"
                    strokeDasharray={`${pct} ${100 - pct}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-base font-bold leading-none text-slate-900">
                    {used}/{FREE_SEAT_LIMIT}
                  </p>
                  <p className="text-[9px] text-slate-500">usados</p>
                </div>
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-600">
                {remaining > 0 ? (
                  <>
                    Podés invitar a <strong>1</strong> persona más
                  </>
                ) : (
                  'Cupos Free completos'
                )}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-4 shadow-sm sm:p-5">
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">Plan Premium</p>
                <p className="mt-1 text-sm font-bold text-slate-900">Hasta {PREMIUM_SEAT_LIMIT} miembros</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-600">
                  Mismos controles de equipo y permisos, con cupo ampliado y funciones de Crecimiento.
                </p>
                <Link
                  href="/planes"
                  className="mt-2 inline-flex text-[11px] font-semibold text-violet-700 hover:underline"
                >
                  Comparar planes →
                </Link>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <Sparkles className="h-5 w-5 text-violet-700" />
              </span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                <p className="text-sm font-semibold text-slate-900">
                  Miembros del equipo{' '}
                  <span className="font-normal text-slate-500">
                    ({used} de {FREE_SEAT_LIMIT})
                  </span>
                </p>
                <button
                  type="button"
                  disabled={remaining <= 0}
                  onClick={() => setInviteOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invitar miembro
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 sm:px-5">Miembro</th>
                      <th className="px-3 py-3">Rol</th>
                      <th className="px-3 py-3">WhatsApp</th>
                      <th className="px-3 py-3">Fecha de alta</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 sm:px-5">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(m.name)}`}
                            >
                              {initials(m.name)}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-900">
                                {m.name}
                                {m.id === 'admin-self' ? (
                                  <span className="ml-1 font-normal text-violet-600">(Tú)</span>
                                ) : null}
                              </p>
                              <p className="text-[11px] text-slate-500">{m.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${ROLE_COLORS[m.role]}`}
                          >
                            {m.role}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{m.whatsapp}</td>
                        <td className="px-3 py-3 text-slate-600">{formatDate(m.joinedAt)}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                              m.status === 'Activo'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {m.id !== 'admin-self' ? (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {menuOpen === m.id && (
                                <div className="absolute right-0 top-7 z-20 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                  <button
                                    type="button"
                                    onClick={() => handleRemove(m.id)}
                                    className="w-full px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50"
                                  >
                                    Quitar invitado
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-start gap-2 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-600 sm:px-5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100">
                  <Check className="h-3 w-3 text-violet-700" />
                </span>
                <span>
                  <strong>Plan Free:</strong> 1 invitado como máximo.{' '}
                  <strong>Premium</strong> permite hasta {PREMIUM_SEAT_LIMIT} miembros y más herramientas de crecimiento.
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
                    <UserPlus className="h-4 w-4 text-violet-700" />
                  </span>
                  <p className="text-sm font-semibold text-slate-900">¿Necesitás más de 1 invitado?</p>
                </div>
                <p className="text-xs text-slate-600">
                  Con <strong>Premium</strong> invitá hasta <strong>{PREMIUM_SEAT_LIMIT} personas</strong> y accedé a
                  interpretación ampliada, prompts e historial.
                </p>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Límite de equipo en Premium
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{PREMIUM_SEAT_LIMIT} miembros</p>
                  <ul className="mt-2 space-y-1 text-[11px] text-slate-700">
                    {['Mismo tipo de roles y permisos', 'Invitaciones sin techo Free', 'Cancelá o cambiá de plan cuando quieras'].map(
                      (f) => (
                        <li key={f} className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          {f}
                        </li>
                      ),
                    )}
                  </ul>
                </div>

                <Link
                  href="/planes"
                  className="mt-3 flex w-full items-center justify-center rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Pasar a Premium
                </Link>

                <div className="mt-2 flex items-start gap-1.5 text-[10px] text-slate-500">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                  El cobro y la facturación siguen las condiciones del plan que elijas en /planes.
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-slate-400">
            <Link href={base} className="text-violet-600 hover:underline">
              ← Volver al resumen
            </Link>
          </p>
        </div>
      </div>

      {inviteOpen && (
        <InviteModalFree onClose={() => setInviteOpen(false)} onAdd={handleAdd} remaining={remaining} />
      )}
    </main>
  );
}
