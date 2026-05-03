'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Info,
  MoreHorizontal,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { PlanPaymentModal } from '@/components/planes/plan-payment-modal';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PLAN_LIMIT = 10;
const EXTRA_USER_PRICE = 3;

type UsageResponse = { planKey?: string; planDisplay?: string };

type Role = 'Administrador' | 'Editor' | 'Analista' | 'Viewer';

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
  Analista: 'bg-amber-100 text-amber-800',
  Viewer: 'bg-slate-100 text-slate-700',
};

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
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
];
function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx]!;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ──────────────────────────────────────────────────────────────────────────────
// Modal de invitar miembro
// ──────────────────────────────────────────────────────────────────────────────
function InviteModal({
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
  const [role, setRole] = useState<Role>('Viewer');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Ingresá un email válido.'); return; }
    if (!whatsapp.trim()) { setError('El número de WhatsApp es obligatorio.'); return; }
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
                {remaining > 0 ? `Te quedan ${remaining} lugares incluidos en tu plan.` : 'Superaste el límite incluido. Se cobrará $3 USD/mes por este usuario.'}
              </p>
            </div>
          </div>
        </div>

        {remaining <= 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>Este usuario adicional tendrá un costo de <strong>$3 USD/mes</strong>. Se aplicará en tu próximo ciclo de facturación.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Nombre completo *</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Sánchez"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Correo electrónico *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@empresa.com"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              WhatsApp *
              <span className="ml-1 font-normal text-slate-500">(con código de país, ej: +54 9 11 2345 6789)</span>
            </label>
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">
              <span className="flex items-center gap-1 border-r border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span>💬</span>
              </span>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+54 9 11 2345 6789"
                className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Rol</label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              >
                <option>Administrador</option>
                <option>Editor</option>
                <option>Analista</option>
                <option>Viewer</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Enviar invitación
          </button>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Página principal
// ──────────────────────────────────────────────────────────────────────────────
export default function EquipoPage() {
  const params = useParams();
  const runId = params.runId as string;
  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  const [members, setMembers] = useState<TeamMember[]>([
    { id: '1', name: 'Juan Sánchez', email: 'juan.sanchez@empresa.com', whatsapp: '+54 9 11 1234 5678', role: 'Administrador', joinedAt: '2024-04-12', status: 'Activo' },
    { id: '2', name: 'María Rodríguez', email: 'maria.rodriguez@empresa.com', whatsapp: '+54 9 11 2345 6789', role: 'Editor', joinedAt: '2024-04-12', status: 'Activo' },
    { id: '3', name: 'Lucas Crespo', email: 'lucas.crespo@empresa.com', whatsapp: '+54 9 11 3456 7890', role: 'Editor', joinedAt: '2024-04-15', status: 'Activo' },
  ]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [pagoOpen, setPagoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let token: string | null = null;
        try { token = sessionStorage.getItem(TOKEN_KEY); } catch { token = null; }
        if (!token) { setLoadingUsage(false); return; }
        const res = await fetch(`${API_URL}/api/me/usage`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.ok ? (await res.json() as UsageResponse) : {};
        if (!cancelled) { setUsage(data); setLoadingUsage(false); }
      } catch { if (!cancelled) setLoadingUsage(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  function handleAdd(member: Omit<TeamMember, 'id' | 'joinedAt' | 'status'>) {
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
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setMenuOpen(null);
  }

  const used = members.length;
  const remaining = Math.max(0, PLAN_LIMIT - used);
  const extraUsers = Math.max(0, used - PLAN_LIMIT);
  const pct = Math.min(100, Math.round((used / PLAN_LIMIT) * 100));

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[220px_1fr]">

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CleexsMark className="h-6 w-6" />
            <p className="font-bold text-slate-900">Cleexs</p>
          </div>
          <nav className="space-y-1 text-sm">
            <Link href={`${basePath}#portal-cliente`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Portal cliente</Link>
            <Link href={`${basePath}/comparacion`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Comparación</Link>
            <Link href={`${basePath}/prompts`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Prompts</Link>
            <Link href={`${basePath}/competidores`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Competidores</Link>
            <Link href={`${basePath}/historial`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Historial</Link>
            <Link href={`${basePath}#reportes`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Reportes</Link>
            <Link href={`${basePath}/suscripcion`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Suscripción</Link>
            <Link href={`${basePath}/equipo`} className="block rounded-lg bg-violet-50 px-3 py-2 font-semibold text-violet-900">Equipo</Link>
            <Link href={`${basePath}/herramientas`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Herramientas</Link>
          </nav>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Plan actual</p>
            <p className="font-semibold text-slate-900">
              {loadingUsage ? '…' : (usage?.planDisplay || usage?.planKey || 'Premium')}
            </p>
          </div>
        </aside>

        {/* ── Contenido ────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Header */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              <Users className="h-3.5 w-3.5" />
              Equipo
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Gestioná el acceso de tu equipo</h1>
            <p className="mt-2 text-sm text-slate-600">
              Invitá hasta {PLAN_LIMIT} personas de tu equipo para acceder a Cleexs
              <br />y colaborar en el crecimiento de tu marca.
            </p>
          </div>

          {/* Stats row */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Límite */}
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <Users className="h-6 w-6 text-violet-700" />
              </span>
              <div>
                <p className="text-xs text-slate-500">Límite de usuarios incluido en tu plan</p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900">{PLAN_LIMIT}</p>
                  <p className="text-base font-medium text-slate-700">usuarios</p>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Incluidos</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">Podés invitar hasta {PLAN_LIMIT} personas sin costo adicional.</p>
              </div>
            </div>

            {/* Circular progress */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="relative h-20 w-20">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke="#7c3aed"
                    strokeWidth="3"
                    strokeDasharray={`${pct} ${100 - pct}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-lg font-bold leading-none text-slate-900">{used}/{PLAN_LIMIT}</p>
                  <p className="text-[10px] text-slate-500">usados</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {remaining > 0 ? `${remaining} lugares disponibles` : 'Límite alcanzado'}
              </p>
            </div>

            {/* Usuarios adicionales */}
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-xs text-slate-500">Usuarios adicionales</p>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <p className="text-3xl font-bold text-slate-900">${EXTRA_USER_PRICE}</p>
                  <p className="text-sm text-slate-500">/usuario mensual</p>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">Sumá más usuarios a tu equipo cuando lo necesites.</p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <UserPlus className="h-6 w-6 text-violet-700" />
              </span>
            </div>
          </div>

          {/* Members table + right panel */}
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">

            {/* Table */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <p className="font-semibold text-slate-900">
                  Miembros del equipo{' '}
                  <span className="font-normal text-slate-500">({used} de {PLAN_LIMIT})</span>
                </p>
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invitar miembro
                </button>
              </div>

              {members.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  Todavía no hay miembros. Invitá al primero.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Miembro</th>
                        <th className="px-4 py-3">Rol</th>
                        <th className="px-4 py-3">WhatsApp</th>
                        <th className="px-4 py-3">Fecha de alta</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(m.name)}`}>
                                {initials(m.name)}
                              </span>
                              <div>
                                <p className="font-semibold text-slate-900">{m.name}</p>
                                <p className="text-[11px] text-slate-500">{m.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${ROLE_COLORS[m.role]}`}>
                              {m.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{m.whatsapp}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(m.joinedAt)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                              m.status === 'Activo'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
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
                                    Eliminar miembro
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100">
                  <Check className="h-3 w-3 text-violet-700" />
                </span>
                <span><strong>Todos los miembros acceden a las mismas funcionalidades.</strong> Los permisos son iguales para todos los usuarios de tu equipo.</span>
              </div>
            </div>

            {/* Right panel */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                    <UserPlus className="h-5 w-5 text-violet-700" />
                  </span>
                  <p className="font-semibold text-slate-900">¿Necesitás sumar más usuarios?</p>
                </div>
                <p className="text-xs text-slate-600">
                  Agregá usuarios adicionales a tu equipo por solo <strong>${EXTRA_USER_PRICE} USD</strong> por usuario/mes.
                </p>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Precio por usuario adicional</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <p className="text-3xl font-bold text-slate-900">${EXTRA_USER_PRICE}</p>
                    <p className="text-sm text-slate-500">USD / mes</p>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs text-slate-700">
                    {['Mismo acceso y permisos', 'Cancelá cuando quieras', 'Se cobra mes a mes'].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => setPagoOpen(true)}
                  className="mt-4 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Agregar usuarios adicionales
                </button>

                <div className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  La facturación adicional se aplicará en tu próximo ciclo de facturación.
                </div>
              </div>

              {extraUsers > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                  <p className="font-semibold">Usuarios adicionales activos: {extraUsers}</p>
                  <p className="mt-1">Costo extra: <strong>${extraUsers * EXTRA_USER_PRICE} USD/mes</strong></p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onAdd={handleAdd}
          remaining={remaining}
        />
      )}

      <PlanPaymentModal
        open={pagoOpen}
        onOpenChange={setPagoOpen}
        planId="crecimiento"
        billingMode="monthly"
        onConfirm={() => setPagoOpen(false)}
      />
    </main>
  );
}
