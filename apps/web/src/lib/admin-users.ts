import { scryptSync, timingSafeEqual } from 'crypto';
import { normalizeEnvSecret } from '@/lib/admin-session';
import type { AdminRole } from '@/lib/admin-roles';

export type AdminAccount = {
  username: string;
  role: AdminRole;
};

type StoredAccount = AdminAccount & {
  passwordHash: Buffer;
  salt: string;
};

function hashPassword(password: string, salt: string): Buffer {
  return scryptSync(password, salt, 32);
}

function verifyPassword(password: string, salt: string, expected: Buffer): boolean {
  try {
    const actual = hashPassword(password, salt);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** ADMIN_UI_ACCOUNTS=user:pass:role|user2:pass2:role2 (roles: admin | marketing) */
function parseEnvAccounts(): StoredAccount[] {
  const raw = normalizeEnvSecret(process.env.ADMIN_UI_ACCOUNTS);
  if (!raw) return [];

  return raw.split('|').flatMap((chunk) => {
    const part = chunk.trim();
    if (!part) return [];
    const sep = part.indexOf(':');
    const sep2 = part.indexOf(':', sep + 1);
    if (sep <= 0 || sep2 <= sep) return [];
    const username = part.slice(0, sep).trim().toLowerCase();
    const password = part.slice(sep + 1, sep2);
    const roleRaw = part.slice(sep2 + 1).trim().toLowerCase();
    const role: AdminRole = roleRaw === 'marketing' ? 'marketing' : 'admin';
    if (!username || !password) return [];
    const salt = `cleexs-admin-env-${username}`;
    return [
      {
        username,
        role,
        salt,
        passwordHash: hashPassword(password, salt),
      },
    ];
  });
}

function envAdminAccount(): StoredAccount | null {
  const password = normalizeEnvSecret(process.env.ADMIN_UI_PASSWORD);
  if (!password) return null;
  const username = normalizeEnvSecret(process.env.ADMIN_UI_USERNAME || 'admin').toLowerCase();
  const salt = `cleexs-admin-env-${username}`;
  return {
    username,
    role: 'admin',
    salt,
    passwordHash: hashPassword(password, salt),
  };
}

function allAccounts(): StoredAccount[] {
  const envAdmin = envAdminAccount();
  const map = new Map<string, StoredAccount>();
  for (const acc of parseEnvAccounts()) {
    map.set(acc.username, acc);
  }
  if (envAdmin) {
    map.set(envAdmin.username, envAdmin);
  }
  return Array.from(map.values());
}

export function verifyAdminCredentials(
  usernameInput: string,
  passwordInput: string,
): AdminAccount | null {
  const username = usernameInput.trim().toLowerCase();
  const password = passwordInput;
  if (!username || !password) return null;

  const account = allAccounts().find((a) => a.username === username);
  if (!account) return null;
  if (!verifyPassword(password, account.salt, account.passwordHash)) return null;

  return { username: account.username, role: account.role };
}
