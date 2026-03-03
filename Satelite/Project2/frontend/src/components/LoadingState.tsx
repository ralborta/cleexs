export default function LoadingState() {
  return (
    <section className="flex flex-col items-center justify-center px-4 pt-32 pb-16">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full border-4 border-[var(--primary)]/20" />
        <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-[var(--primary)] animate-spin-slow" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-[var(--primary)]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-3">Analizando tu sitio...</h2>
      <p className="text-[var(--text-muted)] text-center max-w-md mb-8">
        Leyendo robots.txt, verificando acceso de bots de IA y analizando tu
        sitemap.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {[
          "Descargando robots.txt",
          "Verificando bots de IA",
          "Buscando sitemap.xml",
          "Analizando URLs del sitemap",
          "Generando recomendaciones",
        ].map((step, i) => (
          <div
            key={step}
            className="flex items-center gap-3 animate-fade-in-up"
            style={{ animationDelay: `${i * 0.3}s`, opacity: 0 }}
          >
            <div className="w-2 h-2 bg-[var(--primary)] rounded-full animate-pulse" />
            <span className="text-sm text-[var(--text-muted)]">{step}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
