import type { PrismaClient } from '@prisma/client';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

export type EnsurePortalUserForBrandResult = {
  accion: 'created' | 'updated';
  email: string;
  password: string;
  brandId: string;
  brandName: string;
  brandDomain: string | null;
  tenantId: string;
  tenantCode: string;
  portalCliente: string;
};

function slugPart(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24) || 'marca';
}

function hostFromBrandDomain(domain: string | null | undefined): string {
  if (!domain?.trim()) return 'cleexs.internal';
  const h = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    ?.trim();
  if (!h) return 'cleexs.internal';
  return h.replace(/[^a-z0-9.-]/gi, '') || 'cleexs.internal';
}

/**
 * Busca una marca por nombre (contiene, sin distinguir mayúsculas) y crea o actualiza un usuario de portal para su tenant.
 */
export async function ensurePortalUserForBrand(
  prisma: PrismaClient,
  input: { brandName: string; password: string; email?: string | null },
): Promise<EnsurePortalUserForBrandResult> {
  const rawName = input.brandName.trim();
  if (rawName.length < 2) {
    throw new Error('brandName demasiado corto.');
  }
  const password = input.password.trim();
  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  const brands = await prisma.brand.findMany({
    where: { name: { contains: rawName, mode: 'insensitive' } },
    orderBy: { updatedAt: 'desc' },
    take: 8,
    select: {
      id: true,
      name: true,
      domain: true,
      tenantId: true,
      tenant: { select: { tenantCode: true } },
      runs: { select: { id: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (brands.length === 0) {
    throw new Error(`No se encontró ninguna marca que coincida con "${rawName}".`);
  }

  const brand = brands[0]!;

  let email = (input.email?.trim().toLowerCase() || '').slice(0, 320);
  if (!email || !email.includes('@')) {
    const host = hostFromBrandDomain(brand.domain);
    email = `portal.${slugPart(brand.name)}@${host}`.toLowerCase();
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true, tenantId: true },
  });
  if (existingByEmail && existingByEmail.tenantId !== brand.tenantId) {
    throw new Error(
      `El email ${email} ya existe en otro tenant. Pasá otro "email" en el body o cambiá la cuenta existente.`,
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const latestRunId = brand.runs[0]?.id;

  let accion: 'created' | 'updated';
  if (existingByEmail) {
    await prisma.user.update({
      where: { id: existingByEmail.id },
      data: { passwordHash, tenantId: brand.tenantId, role: UserRole.owner, name: brand.name },
    });
    accion = 'updated';
  } else {
    await prisma.user.create({
      data: {
        email,
        name: brand.name,
        tenantId: brand.tenantId,
        role: UserRole.owner,
        passwordHash,
      },
    });
    accion = 'created';
  }

  return {
    accion,
    email,
    password,
    brandId: brand.id,
    brandName: brand.name,
    brandDomain: brand.domain,
    tenantId: brand.tenantId,
    tenantCode: brand.tenant.tenantCode,
    portalCliente: latestRunId
      ? `/portal-cliente/reporte/${latestRunId}`
      : '/portal-cliente',
  };
}
