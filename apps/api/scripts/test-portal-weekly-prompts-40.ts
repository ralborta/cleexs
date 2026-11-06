/**
 * Prueba integrada contra Postgres local: persistencia durable de 40 slots,
 * auth/aislamiento, rechazo fuera de rango, y planning CSV del portal Agency (PR2)
 * sin modificar ese repo. Limpia SOLO registros sintéticos con el marcador propio.
 *
 * Uso:
 *   DATABASE_URL=... PORTAL_JWT_SECRET=... npx tsx apps/api/scripts/test-portal-weekly-prompts-40.ts
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import portalWeeklyPromptsRoutes from '../src/routes/portal-weekly-prompts';
import { signPortalToken } from '../src/lib/portal-jwt';
import {
  PORTAL_WEEKLY_PROMPT_MAX_SLOT,
  PORTAL_WEEKLY_PROMPT_SLOT_COUNT,
} from '../src/lib/portal-weekly-prompts-slots';

const MARKER = '[SYN-40SLOTS-AEE1]';
const ARTIFACTS = '/opt/cursor/artifacts';
const AGENCY_CSV = '/tmp/agency-pr2/agency/src/lib/csv-prompts.ts';

type Step = { name: string; ok: boolean; detail?: string };

async function main() {
  if (!process.env.PORTAL_JWT_SECRET?.trim()) {
    process.env.PORTAL_JWT_SECRET = 'test-portal-jwt-secret-40slots-aee1-not-prod';
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL requerido');
  }

  mkdirSync(ARTIFACTS, { recursive: true });
  const steps: Step[] = [];
  const prisma = new PrismaClient();
  const createdPromptIds: string[] = [];
  const createdBrandIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdTenantIds: string[] = [];
  const createdPlanIds: string[] = [];

  const app = Fastify({ logger: false });
  await app.register(portalWeeklyPromptsRoutes, { prefix: '/api/portal' });
  await app.ready();

  const planId = randomUUID();
  createdPlanIds.push(planId);
  await prisma.plan.create({
    data: {
      id: planId,
      name: `${MARKER} Plan`,
      runsPerMonth: 100,
      promptsActiveLimit: 100,
      brandsLimit: 10,
      competitorsLimit: 10,
    },
  });

  async function makeTenant(code: string) {
    const tenant = await prisma.tenant.create({
      data: {
        tenantCode: code,
        tenantPath: code,
        tenantType: 'DIRECT_CLIENT',
        planId,
        status: 'active',
      },
    });
    createdTenantIds.push(tenant.id);

    const user = await prisma.user.create({
      data: {
        email: `${code.toLowerCase()}@syn-40slots-aee1.test`,
        name: `${MARKER} User ${code}`,
        tenantId: tenant.id,
        role: 'owner',
      },
    });
    createdUserIds.push(user.id);

    const brand = await prisma.brand.create({
      data: {
        name: `${MARKER} Brand ${code}`,
        domain: `${code.toLowerCase()}.syn-40slots-aee1.test`,
        tenantId: tenant.id,
      },
    });
    createdBrandIds.push(brand.id);

    await prisma.promptCategory.create({
      data: { tenantId: tenant.id, name: `${MARKER} Cat` },
    });
    await prisma.promptVersion.create({
      data: {
        tenantId: tenant.id,
        name: `${MARKER} PV`,
        active: true,
      },
    });

    const token = signPortalToken(user.id);
    return { tenant, user, brand, token };
  }

  const a = await makeTenant(`T40A${Date.now().toString(36).slice(-6)}`);
  const b = await makeTenant(`T40B${Date.now().toString(36).slice(-6)}`);

  const authA = { authorization: `Bearer ${a.token}` };
  const authB = { authorization: `Bearer ${b.token}` };

  try {
    // 1) GET vacío → maxSlots 40
    {
      const res = await app.inject({
        method: 'GET',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts`,
        headers: authA,
      });
      assert.equal(res.statusCode, 200, res.body);
      const body = res.json();
      assert.equal(body.maxSlots, PORTAL_WEEKLY_PROMPT_SLOT_COUNT);
      assert.equal(body.slots.length, PORTAL_WEEKLY_PROMPT_SLOT_COUNT);
      assert.equal(body.slots[0].slot, 0);
      assert.equal(body.slots[39].slot, 39);
      steps.push({ name: 'GET vacio maxSlots=40 slots 0..39', ok: true });
    }

    // 2) Sin auth → 401
    {
      const res = await app.inject({
        method: 'GET',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts`,
      });
      assert.equal(res.statusCode, 401);
      steps.push({ name: 'GET sin auth → 401', ok: true });
    }

    // 3) Slot fuera de rango
    {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts/40`,
        headers: authA,
        payload: { promptText: `${MARKER} fuera` },
      });
      assert.equal(res.statusCode, 400);
      assert.match(res.json().error, /0 y 39/);
      const resNeg = await app.inject({
        method: 'PUT',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts/-1`,
        headers: authA,
        payload: { promptText: `${MARKER} fuera` },
      });
      assert.equal(resNeg.statusCode, 400);
      steps.push({ name: 'PUT slot 40 y -1 rechazados', ok: true });
    }

    // 4) Seed 3 existentes (no sobrescribir en import)
    const preexistingTexts: string[] = [];
    for (const slot of [0, 1, 2]) {
      const text = `${MARKER} preexistente slot ${slot} — marca A`;
      preexistingTexts.push(text);
      const res = await app.inject({
        method: 'PUT',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts/${slot}`,
        headers: authA,
        payload: { promptText: text },
      });
      assert.equal(res.statusCode, 200, res.body);
      createdPromptIds.push(res.json().id);
    }
    steps.push({ name: 'Seed 3 prompts preexistentes slots 0..2', ok: true });

    // 5) Importar 40 sintéticos vía planning Agency + PUT solo slots libres
    const csvLib = await import(AGENCY_CSV);
    const csvLines = ['prompt,name'];
    for (let i = 0; i < 45; i++) {
      csvLines.push(
        `"${MARKER} csv import #${i} mejor herramienta AEO sintetica ${i}?","syn-${i}"`,
      );
    }
    // duplicado CSV (mismas 2 columnas), vacío, y texto ya existente
    csvLines.push(`"${MARKER} csv import #0 mejor herramienta AEO sintetica 0?","dup"`);
    csvLines.push(`"","empty-name"`);
    csvLines.push(`"${preexistingTexts[0].replace(/"/g, '""')}","pre"`);

    const parsed = csvLib.parsePromptCsv(csvLines.join('\n'));
    const current = await app.inject({
      method: 'GET',
      url: `/api/portal/brands/${a.brand.id}/weekly-prompts`,
      headers: authA,
    });
    const currentBody = current.json();
    const existing = currentBody.slots
      .filter((s: { promptText: string }) => s.promptText.trim())
      .map((s: { slot: number; promptText: string }) => ({ slot: s.slot, text: s.promptText }));

    const plan = csvLib.planCsvImport({
      rows: parsed.rows,
      parseIssues: parsed.issues,
      existing,
      max: 40,
      liveMax: currentBody.maxSlots,
    });

    assert.equal(plan.liveMax, 40);
    assert.equal(plan.freeDurableSlotsBefore, 37);
    assert.equal(plan.toAdd.length, 37, `expected 37 free durable, got ${plan.toAdd.length}`);
    const skipReasons = new Set(plan.skipped.map((s: { reason: string }) => s.reason));
    assert.ok(skipReasons.has('duplicate_csv'), `skipped=${[...skipReasons]}`);
    assert.ok(skipReasons.has('duplicate_existing'), `skipped=${[...skipReasons]}`);
    assert.ok(skipReasons.has('overflow'), `skipped=${[...skipReasons]}`);
    assert.ok(skipReasons.has('empty'), `skipped=${[...skipReasons]}`);
    steps.push({
      name: 'Planning CSV Agency (PR2) con liveMax=40: 37 free, skips dup/overflow/empty',
      ok: true,
      detail: `toAdd=${plan.toAdd.length} skipped=${plan.skipped.length} reasons=${[...skipReasons].join(',')}`,
    });

    for (const item of plan.toAdd) {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts/${item.slot}`,
        headers: authA,
        payload: { promptText: item.text },
      });
      assert.equal(res.statusCode, 200, `slot ${item.slot}: ${res.body}`);
      const body = res.json();
      assert.equal(body.ok, true);
      assert.equal(body.slot, item.slot);
      assert.ok(body.id);
      assert.equal(body.maxSlots, 40);
      createdPromptIds.push(body.id);
    }

    // Verificar que preexistentes no se pisaron
    for (const slot of [0, 1, 2]) {
      const row = await prisma.brandPortalSavedPrompt.findUnique({
        where: { brandId_slot: { brandId: a.brand.id, slot } },
      });
      assert.equal(row?.promptText, preexistingTexts[slot]);
    }
    steps.push({ name: 'PUT import solo slots libres; preexistentes intactos', ok: true });

    // 6) Completar a 40 totales (ya hay 40: 3 + 37)
    {
      const get1 = await app.inject({
        method: 'GET',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts`,
        headers: authA,
      });
      const g1 = get1.json();
      const filled = g1.slots.filter((s: { promptText: string }) => s.promptText.trim());
      assert.equal(filled.length, 40);
      assert.equal(g1.maxSlots, 40);
      for (let slot = 0; slot <= PORTAL_WEEKLY_PROMPT_MAX_SLOT; slot++) {
        const s = g1.slots.find((x: { slot: number }) => x.slot === slot);
        assert.ok(s?.id, `slot ${slot} debe tener id`);
        assert.ok(s.promptText.includes(MARKER), `slot ${slot} marker`);
      }
      steps.push({ name: 'GET confirma 40 slots 0..39 recuperables', ok: true });
    }

    // 7) "Nueva sesión": nueva instancia Fastify + GET
    {
      const app2 = Fastify({ logger: false });
      await app2.register(portalWeeklyPromptsRoutes, { prefix: '/api/portal' });
      await app2.ready();
      const res = await app2.inject({
        method: 'GET',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts`,
        headers: authA,
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.slots.filter((s: { promptText: string }) => s.promptText.trim()).length, 40);
      await app2.close();
      steps.push({ name: 'Nueva sesión Fastify: GET sigue devolviendo 40', ok: true });
    }

    // 8) Límite combinado: plan con full → overflow
    {
      const getFull = await app.inject({
        method: 'GET',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts`,
        headers: authA,
      });
      const fullBody = getFull.json();
      const planFull = csvLib.planCsvImport({
        rows: csvLib.parsePromptCsv(`prompt\n"${MARKER} extra overflow"\n`).rows,
        existing: fullBody.slots
          .filter((s: { promptText: string }) => s.promptText.trim())
          .map((s: { slot: number; promptText: string }) => ({ slot: s.slot, text: s.promptText })),
        max: 40,
        liveMax: 40,
      });
      assert.equal(planFull.toAdd.length, 0);
      assert.ok(planFull.skipped.some((s: { reason: string }) => s.reason === 'overflow'));
      steps.push({ name: 'Límite combinado 40: overflow sin toAdd', ok: true });
    }

    // 9) Aislamiento tenant B no ve marca A; A no escribe en B
    {
      const crossGet = await app.inject({
        method: 'GET',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts`,
        headers: authB,
      });
      assert.equal(crossGet.statusCode, 404);

      const crossPut = await app.inject({
        method: 'PUT',
        url: `/api/portal/brands/${b.brand.id}/weekly-prompts/0`,
        headers: authA,
        payload: { promptText: `${MARKER} cross-tenant` },
      });
      assert.equal(crossPut.statusCode, 404);

      const putB = await app.inject({
        method: 'PUT',
        url: `/api/portal/brands/${b.brand.id}/weekly-prompts/5`,
        headers: authB,
        payload: { promptText: `${MARKER} brand B slot 5` },
      });
      assert.equal(putB.statusCode, 200, putB.body);
      createdPromptIds.push(putB.json().id);

      const getA = await app.inject({
        method: 'GET',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts`,
        headers: authA,
      });
      assert.ok(
        !getA
          .json()
          .slots.some((s: { promptText: string }) => s.promptText.includes('brand B slot 5')),
      );
      steps.push({ name: 'Aislamiento marcas/tenants (404 cruzado + datos separados)', ok: true });
    }

    // 10) Confirmación servidor: fila en BD = respuesta PUT
    {
      const text = `${MARKER} confirm server slot 7 rewrite`;
      const put = await app.inject({
        method: 'PUT',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts/7`,
        headers: authA,
        payload: { promptText: text },
      });
      assert.equal(put.statusCode, 200);
      const id = put.json().id;
      const dbRow = await prisma.brandPortalSavedPrompt.findUnique({ where: { id } });
      assert.equal(dbRow?.promptText, text);
      assert.equal(dbRow?.slot, 7);
      const get = await app.inject({
        method: 'GET',
        url: `/api/portal/brands/${a.brand.id}/weekly-prompts`,
        headers: authA,
      });
      const slot7 = get.json().slots.find((s: { slot: number }) => s.slot === 7);
      assert.equal(slot7.promptText, text);
      assert.equal(slot7.id, id);
      steps.push({ name: 'Confirmación PUT+GET+BD (slot 7)', ok: true });
    }

    // 11) CHECK constraint BD rechaza slot 40 a nivel SQL
    {
      let rejected = false;
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO brand_portal_saved_prompts (id, brand_id, slot, title, prompt_text, created_at, updated_at)
           VALUES ($1, $2, 40, 'x', $3, NOW(), NOW())`,
          randomUUID(),
          a.brand.id,
          `${MARKER} check fail`,
        );
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true);
      steps.push({ name: 'CHECK BD rechaza slot=40', ok: true });
    }
  } finally {
    // Limpieza SOLO sintéticos marcados
    const deletedPrompts = await prisma.brandPortalSavedPrompt.deleteMany({
      where: {
        OR: [
          { id: { in: createdPromptIds } },
          { promptText: { contains: MARKER } },
          { brandId: { in: createdBrandIds } },
        ],
      },
    });

    // Shadow prompts ligados
    await prisma.prompt.deleteMany({
      where: {
        OR: [
          { name: { contains: MARKER } },
          { promptText: { contains: MARKER } },
        ],
      },
    });
    await prisma.promptVersion.deleteMany({
      where: { tenantId: { in: createdTenantIds } },
    });
    await prisma.promptCategory.deleteMany({
      where: { tenantId: { in: createdTenantIds } },
    });
    await prisma.brand.deleteMany({ where: { id: { in: createdBrandIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
    await prisma.plan.deleteMany({ where: { id: { in: createdPlanIds } } });

    const leftover = await prisma.brandPortalSavedPrompt.count({
      where: { promptText: { contains: MARKER } },
    });
    steps.push({
      name: 'Limpieza sintéticos',
      ok: leftover === 0,
      detail: `deletedPrompts=${deletedPrompts.count} leftover=${leftover}`,
    });

    await app.close();
    await prisma.$disconnect();
  }

  const report = {
    marker: MARKER,
    maxSlots: PORTAL_WEEKLY_PROMPT_SLOT_COUNT,
    against: 'Postgres local real + Fastify inject (no mocks de persistencia)',
    agencyPr2CsvLib: AGENCY_CSV,
    agencyPr2CsvLibSha256: createHash('sha256').update(readFileSync(AGENCY_CSV)).digest('hex'),
    steps,
    allOk: steps.every((s) => s.ok),
    at: new Date().toISOString(),
  };

  const outPath = join(ARTIFACTS, 'weekly-prompts-40-integration-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nArtifact: ${outPath}`);

  if (!report.allOk) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
