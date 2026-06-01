/**
 * Cliente OAuth 2.0 contra Google (web server flow).
 *
 * Sin SDK: usamos solo `fetch` para mantener el bundle chico y evitar
 * acoplarnos a `googleapis`.
 *
 * Env vars necesarias:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_OAUTH_REDIRECT_URI   (ej https://api.cleexs.com/api/google/oauth/callback)
 */

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

export type GoogleOAuthTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  scope: string;
  tokenType: string;
  idToken?: string;
};

export type GoogleUserInfo = {
  sub: string;
  email: string;
  emailVerified?: boolean;
  picture?: string | null;
  name?: string | null;
};

function readEnv(name: string): string {
  const v = (process.env[name] || '').trim();
  if (!v) throw new Error(`${name} no está configurada en la API`);
  return v;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim()
  );
}

export function getGoogleOAuthConfig() {
  return {
    clientId: readEnv('GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: readEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
    redirectUri: readEnv('GOOGLE_OAUTH_REDIRECT_URI'),
  };
}

/** Genera la URL de consentimiento. `state` es un valor opaco firmado o un nonce. */
export function buildGoogleAuthUrl(params: { state: string; loginHint?: string }) {
  const { clientId, redirectUri } = getGoogleOAuthConfig();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent'); // fuerza refresh_token siempre
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', params.state);
  if (params.loginHint) url.searchParams.set('login_hint', params.loginHint);
  return url.toString();
}

/** Intercambia `code` por tokens. */
export async function exchangeCodeForTokens(code: string): Promise<GoogleOAuthTokens> {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Google OAuth token exchange falló (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
  };
  if (!data.access_token) throw new Error('Google OAuth: respuesta sin access_token.');
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresInSeconds: data.expires_in || 0,
    scope: data.scope || '',
    tokenType: data.token_type || 'Bearer',
    idToken: data.id_token,
  };
}

/** Usa un refresh_token para obtener un access_token nuevo. */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresInSeconds: number;
  scope?: string;
}> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Google OAuth refresh falló (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!data.access_token) throw new Error('Google OAuth refresh: sin access_token.');
  return {
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in || 0,
    scope: data.scope,
  };
}

/** Lee identidad del usuario a partir del access_token (perfil userinfo). */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Google userinfo falló (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    picture?: string;
    name?: string;
  };
  if (!data.email || !data.sub) throw new Error('Google userinfo: respuesta incompleta.');
  return {
    sub: data.sub,
    email: data.email,
    emailVerified: data.email_verified,
    picture: data.picture || null,
    name: data.name || null,
  };
}

/** Revoca un refresh_token (best-effort: no fallamos si Google ya lo revocó). */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch {
    // no-op
  }
}
