'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DiagnosticAnalysisSingle, DiagnosticAnalysisJson } from '@/lib/api';
import { isDiagnosticAnalysisGold } from '@/lib/api';
import { Sparkles } from 'lucide-react';

export function BlockAnalisisUnico(props: { a: DiagnosticAnalysisSingle; title?: string }) {
  const { a, title } = props;
  return (
    <div className="space-y-4">
      {title ? (
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary-600" />
          {title}
        </h3>
      ) : null}
      {a.resumenEjecutivo ? (
        <div>
          <p className="text-sm font-medium text-primary-700 mb-1">Resumen ejecutivo</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{a.resumenEjecutivo}</p>
        </div>
      ) : null}
      {a.contextoCompetitivo ? (
        <div>
          <p className="text-sm font-medium text-primary-700 mb-1">Contexto competitivo</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{a.contextoCompetitivo}</p>
        </div>
      ) : null}
      {a.comentariosPorIntencion?.length ? (
        <div>
          <p className="text-sm font-medium text-primary-700 mb-2">Por intención</p>
          <div className="space-y-2">
            {a.comentariosPorIntencion.map((c, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="font-medium text-foreground text-sm">{c.intencion} — Score: {c.score}</p>
                <p className="text-sm text-muted-foreground mt-1">{c.comentario}</p>
                {c.interpretacion ? (
                  <p className="text-xs text-muted-foreground mt-1 italic">{c.interpretacion}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {a.aspectosAdicionales ? (
        <div>
          <p className="text-sm font-medium text-primary-700 mb-1">Otros aspectos</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{a.aspectosAdicionales}</p>
        </div>
      ) : null}
      {a.fortalezas?.length ? (
        <div>
          <p className="text-sm font-medium text-green-700 mb-1">Fortalezas</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
            {a.fortalezas.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {a.debilidades?.length ? (
        <div>
          <p className="text-sm font-medium text-amber-700 mb-1">Debilidades</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
            {a.debilidades.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {a.sugerencias?.length ? (
        <div>
          <p className="text-sm font-medium text-primary-700 mb-1">Sugerencias</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
            {a.sugerencias.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {a.proximosPasos?.length ? (
        <div>
          <p className="text-sm font-medium text-primary-700 mb-1">Próximos pasos</p>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-0.5">
            {a.proximosPasos.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export function AnalisisIA(props: { analysisJson: DiagnosticAnalysisJson }) {
  const { analysisJson } = props;
  if (isDiagnosticAnalysisGold(analysisJson)) {
    const g = analysisJson;
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary-600" />
          Análisis con IA
        </h2>
        <Card className="border-transparent bg-white shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Así te ven en OpenAI (ChatGPT)</CardTitle>
          </CardHeader>
          <CardContent>
            <BlockAnalisisUnico a={g.analisisOpenAI} />
          </CardContent>
        </Card>
        <Card className="border-transparent bg-white shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Así te ven en Gemini</CardTitle>
          </CardHeader>
          <CardContent>
            <BlockAnalisisUnico a={g.analisisGemini} />
          </CardContent>
        </Card>
        <Card className="border-transparent bg-white shadow-md border-primary-200 bg-primary-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Así te ven en ambos</CardTitle>
            <CardDescription>Perspectiva combinada de ambas IAs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{g.perspectivaAmbos}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  const isGoldFallback = analysisJson && (analysisJson as { goldFallback?: true }).goldFallback === true;
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-primary-600" />
        Análisis con IA
      </h2>
      {isGoldFallback && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
          <p className="font-medium">Diagnóstico Gold: solo OpenAI disponible</p>
          <p className="mt-1">
            Gemini no estaba configurado o falló. Configurá <strong>GOOGLE_AI_API_KEY</strong> en la API (Railway) y volvé a hacer un diagnóstico Gold para ver OpenAI + Gemini + perspectiva combinada.
          </p>
        </div>
      )}
      <Card className="border-transparent bg-white shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Así te ven en OpenAI (ChatGPT)</CardTitle>
          {isGoldFallback ? (
            <CardDescription>
              Gemini no disponible en este run. Revisá la variable GOOGLE_AI_API_KEY en la API.
            </CardDescription>
          ) : (
            <CardDescription>
              Este diagnóstico usó solo un modelo. Para ver también Gemini y la perspectiva combinada, hacé un{' '}
              <Link href="/diagnostico?tier=gold" className="text-primary-600 underline hover:no-underline">
                diagnóstico Gold
              </Link>{' '}
              desde Planes.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <BlockAnalisisUnico a={analysisJson} />
        </CardContent>
      </Card>
    </div>
  );
}
