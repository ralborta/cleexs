import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Crear Plan básico
  const basicPlan = await prisma.plan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Basic Plan',
      runsPerMonth: 10,
      promptsActiveLimit: 50,
      brandsLimit: 5,
      competitorsLimit: 10,
      retentionMonths: 12,
      automationEnabled: false,
      priceMonthly: 99.0,
    },
  });

  console.log('✅ Plan creado:', basicPlan.name);

  // 2. Crear Master Tenant (ROOT - 000)
  const rootTenant = await prisma.tenant.upsert({
    where: { tenantCode: '000' },
    update: {},
    create: {
      tenantCode: '000',
      tenantPath: '000',
      parentTenantId: null,
      tenantType: 'ROOT',
      planId: basicPlan.id,
      status: 'active',
    },
  });

  console.log('✅ Master Tenant creado:', rootTenant.tenantCode);

  // 3. Crear usuario admin para Master
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@cleexs.com' },
    update: {},
    create: {
      email: 'admin@cleexs.com',
      name: 'Cleexs Admin',
      tenantId: rootTenant.id,
      role: 'owner',
    },
  });

  console.log('✅ Admin user creado:', adminUser.email);

  // 4. Crear categoría de ejemplo
  const category = await prisma.promptCategory.upsert({
    where: {
      tenantId_name: {
        tenantId: rootTenant.id,
        name: 'General',
      },
    },
    update: {},
    create: {
      tenantId: rootTenant.id,
      name: 'General',
    },
  });

  console.log('✅ Categoría creada:', category.name);

  // 5. Crear PromptVersion v1
  const promptVersion = await prisma.promptVersion.upsert({
    where: {
      tenantId_name: {
        tenantId: rootTenant.id,
        name: 'PROMPTS_v1',
      },
    },
    update: {},
    create: {
      tenantId: rootTenant.id,
      name: 'PROMPTS_v1',
      active: true,
    },
  });

  console.log('✅ PromptVersion creada:', promptVersion.name);

  // 6. Crear prompt de ejemplo
  const examplePrompt = await prisma.prompt.upsert({
    where: {
      id: '00000000-0000-0000-0000-000000000010',
    },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      promptVersionId: promptVersion.id,
      categoryId: category.id,
      promptText: '¿Cuáles son las mejores herramientas de análisis de datos?',
      active: true,
    },
  });

  console.log('✅ Prompt de ejemplo creado');

  console.log('\n🎉 Seed completado exitosamente!');
  console.log('\n📋 Resumen:');
  console.log(`   - Plan: ${basicPlan.name}`);
  console.log(`   - Tenant Master: ${rootTenant.tenantCode} (${rootTenant.tenantPath})`);
  console.log(`   - Admin: ${adminUser.email}`);
  console.log(`   - PromptVersion: ${promptVersion.name}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
