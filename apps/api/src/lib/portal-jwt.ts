import jwt from 'jsonwebtoken';

function secret(): string {
  return process.env.PORTAL_JWT_SECRET?.trim() || '';
}

export function assertPortalJwtConfigured(): void {
  if (!secret()) {
    throw new Error('PORTAL_JWT_SECRET no está configurado en la API');
  }
}

export function signPortalToken(userId: string): string {
  assertPortalJwtConfigured();
  return jwt.sign({ sub: userId }, secret(), { expiresIn: '7d', issuer: 'cleexs-portal' });
}

export function verifyPortalToken(token: string): { userId: string } | null {
  try {
    const s = secret();
    if (!s) return null;
    const payload = jwt.verify(token, s, { issuer: 'cleexs-portal' }) as jwt.JwtPayload;
    const userId = typeof payload.sub === 'string' ? payload.sub : null;
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}
