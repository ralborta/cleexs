'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, BarChart3, Triangle, Star } from 'lucide-react';
import { Prompt } from '@/lib/api';
import Link from 'next/link';

interface PromptRankingCardProps {
  prompts: Prompt[];
}

const promptIcons = [Wallet, BarChart3, Triangle, Star];

export function PromptRankingCard({ prompts }: PromptRankingCardProps) {
  // Mock data para porcentajes de aparición (en producción vendría de la API)
  const promptsWithStats = prompts.map((prompt, index) => ({
    ...prompt,
    appearancePercent: Math.floor(Math.random() * 100),
    icon: promptIcons[index % promptIcons.length],
    active: prompt.active,
  }));

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-900">Prompt Ranking</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {promptsWithStats.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No hay prompts disponibles</p>
          ) : (
            promptsWithStats.map((prompt, index) => {
              const Icon = prompt.icon;
              return (
                <div
                  key={prompt.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-blue-700" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {prompt.promptText.length > 50
                          ? `${prompt.promptText.substring(0, 50)}...`
                          : prompt.promptText}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        % Aparición: {prompt.appearancePercent}%
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prompt.active}
                        readOnly
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 pt-4 border-t">
          <Link
            href="/prompts/add"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            + Añadir
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
