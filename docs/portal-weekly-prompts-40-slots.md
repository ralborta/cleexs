# Portal weekly prompts: 40 slots durables

## Causa del tope histórico (5)

No había `CHECK` en Postgres que limitara `brand_portal_saved_prompts.slot`. El tope vivía en:

- `apps/api/src/routes/portal-weekly-prompts.ts` → `MAX_SLOT = 4` (validación PUT/DELETE + `maxSlots` del GET)
- Comentarios de schema Prisma (`0..4` / “hasta 5”)

El portal Agency (`agente-cleexs` / EasyPanel `/prompts`) espera **40** (`CUSTOM_PROMPTS_MAX` / `AGENCY_SLOTS`) y lee `maxSlots` de Cleexs. Si `cleexsLiveSlots < 40`, Agency marca prompts no durables.

## Cambio (este repo)

- Constante compartida: `PORTAL_WEEKLY_PROMPT_SLOT_COUNT = 40` (`apps/api/src/lib/portal-weekly-prompts-slots.ts`)
- Validación API: slots `0..39`; GET reporta `maxSlots: 40`
- Migración no destructiva `20261106190000_portal_weekly_prompts_40_slots`: agrega `CHECK (slot >= 0 AND slot <= 39)`
- Datos existentes (slots 0..4) se preservan; no hay reset ni borrados masivos

## Despliegue recomendado

1. **Merge + deploy API Cleexs** (este PR) con `prisma migrate deploy` (incluye el CHECK).
2. **Después** merge/deploy del portal Agency PR2 (CSV import). Si Agency se publica antes, verá warnings `CRITICAL` hasta que Cleexs exponga `maxSlots=40`.
3. No hace falta migración de datos ni cambio de env vars específicos.

## Rollback

```sql
ALTER TABLE "brand_portal_saved_prompts"
  DROP CONSTRAINT IF EXISTS "brand_portal_saved_prompts_slot_range_check";
```

Y redeploy de la API con el commit anterior (`MAX_SLOT = 4`). Filas en slots 5..39 quedarían huérfanas respecto al tope viejo: borrarlas solo si se decide explícitamente (no automático).

## Fuera de alcance

- No se amplían planes, cuotas ni marketing.
- El portal de crecimiento (`apps/web` …/premium/prompts) aún tiene algunos hardcodes de “5 opciones” / `i <= 4` para “primer slot vacío”; el rail ya lista slots ocupados del API. Follow-up opcional si se quiere la misma UX de 40 ahí.
- No se modifica el repo `agente-cleexs` desde aquí.
