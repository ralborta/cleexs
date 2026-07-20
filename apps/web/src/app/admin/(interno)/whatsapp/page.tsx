'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Inbox,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  Users,
  XCircle,
} from 'lucide-react';
import { AdminAuthExpiredCard, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';

export const dynamic = 'force-dynamic';

type Conversation = {
  chatId: string;
  phoneDigits: string | null;
  total: number;
  inbound: number;
  outbound: number;
  failed: number;
  lastMessage: string;
  lastDirection: string;
  lastStatus: string;
  lastAt: string;
  firstAt: string;
};

type Kpis = {
  totalMessages: number;
  totalInbound: number;
  totalOutbound: number;
  totalFailed: number;
  last7Days: number;
  uniqueChats: number;
};

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  message: string;
  mediaUrl: string | null;
  status: string;
  source: string | null;
  externalId: string | null;
  errorMessage: string | null;
  diagnosticId: string | null;
  createdAt: string;
};

function formatNumber(n: number) {
  return n.toLocaleString('es-AR');
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string) {
  try {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'recién';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `hace ${days} d`;
    return formatDateTime(iso);
  } catch {
    return '—';
  }
}

function prettyContact(c: Conversation) {
  if (c.phoneDigits && c.phoneDigits.length >= 8) {
    return `+${c.phoneDigits}`;
  }
  return c.chatId;
}

const AUTO_REFRESH_MS = 4_000;

const SOURCE_LABEL: Record<string, string> = {
  flow: 'Flujo URL',
  builderbot_inbound: 'Webhook',
  flow_reply: 'Respuesta automática',
  api_send: 'Envío directo',
  webhook_score: 'Score listo',
  api_error: 'Error',
  bot_reply: 'Respuesta del bot',
};

export default function AdminWhatsAppPage() {
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const loadConversations = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoadingList(true);
      try {
        const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
        const res = await adminUiFetch(`/api/admin-ui/whatsapp/conversations${qs}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((json as { error?: string }).error || 'Error al cargar conversaciones');
        setKpis((json as { kpis: Kpis }).kpis);
        setConversations((json as { conversations: Conversation[] }).conversations || []);
        setLastSync(new Date());
        setError(null);
      } catch (e) {
        if (!opts?.silent) setError(e instanceof Error ? e.message : 'Error');
      } finally {
        if (!opts?.silent) setLoadingList(false);
      }
    },
    [search]
  );

  const loadThread = useCallback(async (chatId: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoadingThread(true);
    try {
      const res = await adminUiFetch(
        `/api/admin-ui/whatsapp/conversations/${encodeURIComponent(chatId)}/messages`
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Error');
      const next = (json as { messages: Message[] }).messages || [];
      setMessages(next);
      if (!opts?.silent) setError(null);
      return next.length;
    } catch (e) {
      if (!opts?.silent) setError(e instanceof Error ? e.message : 'Error');
      return null;
    } finally {
      if (!opts?.silent) setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedChat) return;
    void loadThread(selectedChat);
  }, [selectedChat, loadThread]);

  // Auto-refresco: lista + hilo abierto cada 4s; también al volver a la pestaña.
  useEffect(() => {
    if (!autoRefresh) return;
    const tick = () => {
      void loadConversations({ silent: true });
      if (selectedChat) void loadThread(selectedChat, { silent: true });
    };
    const id = setInterval(tick, AUTO_REFRESH_MS);
    const onFocus = () => tick();
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [autoRefresh, loadConversations, loadThread, selectedChat]);

  const selectedConv = useMemo(
    () => conversations.find((c) => c.chatId === selectedChat) || null,
    [conversations, selectedChat]
  );

  // Deduplica el doble registro de auditoría: cada mensaje se loguea por dos
  // orígenes (inbound: builderbot_inbound + flow; outbound: api_send + bot_reply).
  // Colapsamos filas con misma dirección y mismo texto dentro de una ventana corta.
  const visibleMessages = useMemo(() => {
    const DEDUPE_WINDOW_MS = 15_000;
    const kept: Message[] = [];
    for (const m of messages) {
      const key = m.message.trim();
      const ts = new Date(m.createdAt).getTime();
      const dup = kept.some(
        (k) =>
          k.direction === m.direction &&
          k.message.trim() === key &&
          Math.abs(new Date(k.createdAt).getTime() - ts) <= DEDUPE_WINDOW_MS
      );
      if (!dup) kept.push(m);
    }
    return kept;
  }, [messages]);

  useEffect(() => {
    prevMessageCountRef.current = 0;
  }, [selectedChat]);

  // Scroll al final cuando entran mensajes nuevos en el hilo abierto.
  useEffect(() => {
    const count = visibleMessages.length;
    const prev = prevMessageCountRef.current;
    if (count > prev || (selectedChat && prev === 0 && count > 0)) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: count - prev > 2 ? 'auto' : 'smooth' });
      });
    }
    prevMessageCountRef.current = count;
  }, [visibleMessages.length, selectedChat]);

  if (error && looksLikeAdminAuthError(error)) {
    return <AdminAuthExpiredCard />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Mensajes WhatsApp</h1>
            <p className="text-sm text-slate-600">
              Conversaciones entre los clientes y el bot de Cleexs. Cada mensaje queda registrado acá con su origen y
              estado de envío.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(ev) => setAutoRefresh(ev.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Auto-refresco · cada {AUTO_REFRESH_MS / 1000}s
            {autoRefresh ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              </span>
            ) : null}
            {lastSync ? (
              <span className="text-slate-400">· {lastSync.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            ) : null}
          </label>
          <button
            type="button"
            onClick={() => {
              void loadConversations();
              if (selectedChat) void loadThread(selectedChat);
            }}
            disabled={loadingList}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refrescar
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<MessageSquare className="h-4 w-4 text-emerald-600" />}
          label="Mensajes totales"
          value={formatNumber(kpis?.totalMessages ?? 0)}
          hint={`${formatNumber(kpis?.last7Days ?? 0)} en los últimos 7 días`}
        />
        <KpiCard
          icon={<Users className="h-4 w-4 text-violet-600" />}
          label="Conversaciones únicas"
          value={formatNumber(kpis?.uniqueChats ?? 0)}
          hint="Contactos distintos en la base"
        />
        <KpiCard
          icon={<Inbox className="h-4 w-4 text-sky-600" />}
          label="Recibidos vs enviados"
          value={`${formatNumber(kpis?.totalInbound ?? 0)} / ${formatNumber(kpis?.totalOutbound ?? 0)}`}
          hint="Recibidos del cliente / enviados por Cleexs"
        />
        <KpiCard
          icon={<XCircle className="h-4 w-4 text-rose-600" />}
          label="Envíos fallidos"
          value={formatNumber(kpis?.totalFailed ?? 0)}
          hint="Salientes con error de entrega"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Conversaciones</h2>
            <p className="text-xs text-slate-500">Buscá por teléfono o texto del mensaje.</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(ev) => setSearch(ev.target.value)}
                placeholder="Ej. 549114… o 'cleexs'"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
              />
            </div>
          </header>
          <div className="max-h-[640px] overflow-y-auto">
            {loadingList && conversations.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                Cargando…
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                Sin mensajes registrados todavía. Los próximos mensajes que entren por WhatsApp aparecerán acá.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {conversations.map((c) => {
                  const active = c.chatId === selectedChat;
                  return (
                    <li key={c.chatId}>
                      <button
                        type="button"
                        onClick={() => setSelectedChat(c.chatId)}
                        className={`flex w-full flex-col gap-1 px-5 py-3 text-left transition ${
                          active ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                            <Phone className={`h-3.5 w-3.5 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                            {prettyContact(c)}
                          </span>
                          <span className="text-[10px] text-slate-500">{formatRelative(c.lastAt)}</span>
                        </div>
                        <p className="line-clamp-2 text-xs text-slate-600">{c.lastMessage}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                            {c.total} msg
                          </span>
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700 ring-1 ring-sky-200">
                            {c.inbound} in
                          </span>
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700 ring-1 ring-violet-200">
                            {c.outbound} out
                          </span>
                          {c.failed > 0 ? (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700 ring-1 ring-rose-200">
                              {c.failed} fallo
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selectedChat ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <MessageSquare className="h-7 w-7" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900">Elegí una conversación</p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                Tocá un contacto a la izquierda para ver todos los mensajes intercambiados con ese cliente: lo que
                escribió y lo que Cleexs le respondió.
              </p>
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedChat(null)}
                    className="lg:hidden inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Volver
                  </button>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      {selectedConv ? prettyContact(selectedConv) : selectedChat}
                    </h2>
                    {selectedConv ? (
                      <p className="text-xs text-slate-500">
                        {selectedConv.total} mensajes · Primero {formatRelative(selectedConv.firstAt)} · Último{' '}
                        {formatRelative(selectedConv.lastAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => selectedChat && void loadThread(selectedChat)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  {loadingThread ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Refrescar hilo
                </button>
              </header>

              <div ref={threadScrollRef} className="max-h-[640px] space-y-4 overflow-y-auto bg-[#f4f6f8] p-5">
                {loadingThread && visibleMessages.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                    Cargando hilo…
                  </div>
                ) : visibleMessages.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-slate-500">
                    Sin mensajes en esta conversación.
                  </p>
                ) : (
                  visibleMessages.map((m) => {
                    const isOut = m.direction === 'outbound';
                    return (
                      <div key={m.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[80%] flex-col gap-1 ${isOut ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`flex items-center gap-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400`}
                          >
                            {isOut ? <Send className="h-3 w-3" /> : <Inbox className="h-3 w-3" />}
                            <span className={isOut ? 'text-emerald-700' : 'text-slate-600'}>
                              {isOut ? 'Cleexs' : 'Cliente'}
                            </span>
                            <span>· {formatDateTime(m.createdAt)}</span>
                            {m.source ? (
                              <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[9px] normal-case text-slate-500">
                                {SOURCE_LABEL[m.source] ?? m.source}
                              </span>
                            ) : null}
                          </div>
                          <div
                            className={`px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                              isOut
                                ? 'rounded-2xl rounded-br-md bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200'
                                : 'rounded-2xl rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{m.message}</p>
                            {m.mediaUrl ? (
                              <a
                                href={m.mediaUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={`mt-2 inline-block text-[11px] underline ${
                                  isOut ? 'text-emerald-700' : 'text-emerald-700'
                                }`}
                              >
                                Ver adjunto
                              </a>
                            ) : null}
                            {m.status === 'failed' ? (
                              <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-[10px] text-rose-700">
                                Falló el envío{m.errorMessage ? `: ${m.errorMessage}` : ''}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} aria-hidden className="h-px shrink-0" />
              </div>
            </>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-xs leading-relaxed text-slate-600">
        <p>
          <strong className="font-semibold text-slate-800">¿De dónde sale esto?</strong> Cada vez que un cliente
          escribe al bot de WhatsApp (BuilderBot) y cada vez que Cleexs le contesta, queda registrado en{' '}
          <code className="rounded bg-white px-1 font-mono text-[10px]">whatsapp_messages</code>. La auditoría
          arranca a partir del despliegue de esta pantalla; mensajes anteriores no aparecen porque no se estaban
          guardando.
        </p>
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
