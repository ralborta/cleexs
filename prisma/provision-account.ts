import { PrismaClient, TenantType, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

type CliArgs = {
  email: string;
  domain: string;
  plan: 'free' | 'crecimiento';
  grantCourtesyCrecimiento: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key?.startsWith('--') && value && !value.startsWith('--')) {
      map.set(key, value);
      i += 1;
    } else if (key?.startsWith('--')) {
      map.set(key, 'true');
    }
  }

  const email = (map.get('--email') || '').trim().toLowerCase();
  const domain = (map.get('--domain') || '').trim().toLowerCase();
  const planRaw = (map.get('--plan') || 'crecimiento').trim().toLowerCase();
  const plan = planRaw === 'free' ? 'free' : 'crecimiento';
  const grantCourtesyCrecimiento =
    map.get('--courtesy-crecimiento') === 'true' ||
    map.get('--courtesy-premium') === 'true' ||
    plan === 'crecimiento';

  if (!email || !email.includes('@')) {
    throw new Error('Falta --email válido. Ejemplo: --email ralborta@kiev-srl.com');
  }
  if (!domain || !domain.includes('.')) {
    throw new Error('Falta --domain válido. Ejemplo: --domain kiev-srl.com');
  }

  return { email, domain, plan, grantCourtesyCrecimiento };
}

function slugFromDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^-+|-+$/g, '');
}

function companyNameFromDomain(domain: string): string {
  const firstPart = domain.split('.')[0] || 'Empresa';
  return firstPart
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function nextAvailableTenantCode(base: string): Promise<string> {
  const normalized = base.replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'tenant-local';
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? normalized : `${normalized}-${i}`;
    const exists = await prisma.tenant.findFirst({
      where: { tenantCode: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${normalized}-${Date.now().toString(36)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const normalizedDomain = slugFromDomain(args.domain);
  const companyName = companyNameFromDomain(normalizedDomain);
  const now = new Date();
  const oneYear = new Date(now);
  oneYear.setFullYear(oneYear.getFullYear() + 1);

  const rootTenant = await prisma.tenant.findFirst({
    where: { tenantCode: '000' },
    select: { id: true, tenantPath: true, planId: true },
  });
  if (!rootTenant) {
    throw new Error('No existe tenant root (000). Ejecutá primero el seed base.');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: args.email },
    include: { tenant: true },
  });

  let tenantId = existingUser?.tenantId;
  let tenantCode = existingUser?.tenant?.tenantCode;

  if (!tenantId) {
    const codeBase = normalizedDomain.split('.')[0] || 'tenant-local';
    tenantCode = await nextAvailableTenantCode(codeBase);
    const tenant = await prisma.tenant.create({
      data: {
        tenantCode,
        tenantPath: `${rootTenant.tenantPath}/${tenantCode}`,
        parentTenantId: rootTenant.id,
        tenantType: TenantType.DIRECT_CLIENT,
        planId: rootTenant.planId,
        status: 'active',
      },
    });
    tenantId = tenant.id;
  }

  const user = await prisma.user.upsert({
    where: { email: args.email },
    update: {
      tenantId,
      role: UserRole.owner,
      name: companyName,
    },
    create: {
      email: args.email,
      name: companyName,
      tenantId,
      role: UserRole.owner,
    },
  });

  const existingBrand = await prisma.brand.findFirst({
    where: { tenantId, OR: [{ name: companyName }, { domain: normalizedDomain }] },
    select: { id: true },
  });

  const brand = existingBrand
    ? await prisma.brand.update({
        where: { id: existingBrand.id },
        data: {
          name: companyName,
          domain: normalizedDomain,
          industry: 'Servicios',
          country: 'Argentina',
          objective: 'Cuenta piloto provisionada automáticamente',
        },
      })
    : await prisma.brand.create({
        data: {
          tenantId,
          name: companyName,
          domain: normalizedDomain,
          industry: 'Servicios',
          country: 'Argentina',
          objective: 'Cuenta piloto provisionada automáticamente',
        },
      });

  const warnings: string[] = [];

  try {
    await prisma.tenantBrandAccess.upsert({
      where: {
        tenantId_brandId: {
          tenantId,
          brandId: brand.id,
        },
      },
      update: {},
      create: {
        tenantId,
        brandId: brand.id,
        source: 'provision-script',
      },
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'P2021') {
      warnings.push('Tabla tenant_brand_access no existe aún (migración pendiente).');
    } else {
      throw error;
    }
  }

  if (args.grantCourtesyCrecimiento) {
    try {
      const existingOverride = await prisma.entitlementOverride.findFirst({
        where: { tenantId, userId: user.id, active: true },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (existingOverride) {
        await prisma.entitlementOverride.update({
          where: { id: existingOverride.id },
          data: {
            grantPlan: 'crecimiento',
            startsAt: now,
            endsAt: oneYear,
            reason: 'Provision automático piloto',
            active: true,
          },
        });
      } else {
        await prisma.entitlementOverride.create({
          data: {
            tenantId,
            userId: user.id,
            grantPlan: 'crecimiento',
            active: true,
            startsAt: now,
            endsAt: oneYear,
            reason: 'Provision automático piloto',
            createdBy: 'provision-account-script',
          },
        });
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'P2021') {
        warnings.push('Tabla entitlement_overrides no existe aún (migración pendiente).');
      } else {
        throw error;
      }
    }
  }

  const output = {
    ok: true,
    email: user.email,
    tenantId,
    tenantCode,
    brandId: brand.id,
    brandDomain: brand.domain,
    effectivePlan: args.grantCourtesyCrecimiento ? 'crecimiento' : args.plan,
    warnings,
    nextChecks: [
      `/api/me/usage?tenantId=${tenantId}&userId=${user.id}`,
      `/api/reports/app/reports?tenantId=${tenantId}&userId=${user.id}`,
    ],
  };

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error('❌ Error en provision-account:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
