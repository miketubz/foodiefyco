import { createClient } from '@supabase/supabase-js';

const ROLE_OPTIONS = new Set(['owner', 'admin', 'staff_ops', 'finance', 'viewer']);

const getEnv = () => {
  const url = process.env.SUPABASE_URL
    || process.env.SUPABASE_PROJECT_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length) {
    return {
      error: `Missing required Vercel env: ${missing.join(', ')}.`,
    };
  }

  return {
    url,
    serviceRoleKey,
  };
};

const json = (res, status, payload) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
};

const getBearerToken = (req) => {
  const header = String(req.headers.authorization || '');
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
};

const isAdminRole = (role) => role === 'owner' || role === 'admin';

const normalizeRole = (value) => {
  const role = String(value || '').trim().toLowerCase();
  return ROLE_OPTIONS.has(role) ? role : 'viewer';
};

const parseBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
};

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/$/, '');

const getBaseUrlFromRequest = (req) => {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  if (!host) return '';

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').trim().toLowerCase();
  const isLocalHost = host.includes('localhost') || host.startsWith('127.0.0.1');
  const proto = forwardedProto || (isLocalHost ? 'http' : 'https');
  return `${proto}://${host}`;
};

const getTrustedAppBaseUrl = (req) => {
  const envBaseUrl = normalizeBaseUrl(
    process.env.PUBLIC_APP_URL
    || process.env.APP_BASE_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.VITE_PUBLIC_APP_URL
  );

  if (envBaseUrl) return envBaseUrl;
  return normalizeBaseUrl(getBaseUrlFromRequest(req));
};

const generateTempPassword = () => {
  const random = Math.random().toString(36).slice(2);
  const stamp = Date.now().toString(36);
  return `Tmp!${random}${stamp}`.slice(0, 24);
};

const mapUser = (user) => ({
  id: user.id,
  email: user.email || '',
  role: user.app_metadata?.role || user.user_metadata?.role || 'viewer',
  createdAt: user.created_at || '',
  lastSignInAt: user.last_sign_in_at || '',
  isEmailConfirmed: Boolean(user.email_confirmed_at),
  isBanned: Boolean(user.banned_until),
});

const resolveRole = (value) => {
  const role = String(value || '').trim().toLowerCase();
  return ROLE_OPTIONS.has(role) ? role : '';
};

const ensureAdmin = async (req, env) => {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, message: 'Missing Authorization bearer token.' };
  }

  const serviceClient = createClient(env.url, env.serviceRoleKey);

  const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return { ok: false, status: 401, message: 'Invalid or expired session token.' };
  }

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, status: 500, message: `Failed to verify admin role: ${profileError.message}` };
  }

  if (!profile?.is_admin) {
    return { ok: false, status: 403, message: 'Only admin users can access user management.' };
  }

  const { data: actorUserData } = await serviceClient.auth.admin.getUserById(userData.user.id);
  const actorRole =
    resolveRole(actorUserData?.user?.app_metadata?.role)
    || resolveRole(actorUserData?.user?.user_metadata?.role)
    || 'admin';

  return {
    ok: true,
    serviceClient,
    actorId: userData.user.id,
    actorRole,
  };
};

const syncProfileAdminFlag = async (serviceClient, userId, role) => {
  if (!userId) return;

  // Non-destructive update: only touch the existing profile row if it exists.
  await serviceClient
    .from('profiles')
    .update({ is_admin: isAdminRole(role) })
    .eq('id', userId);
};

const mergeRoleIntoAppMetadata = async (serviceClient, userId, role) => {
  if (!userId) return;

  const { data: existingData } = await serviceClient.auth.admin.getUserById(userId);
  const existingMetadata = existingData?.user?.app_metadata || {};

  await serviceClient.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...existingMetadata,
      role,
    },
  });
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const env = getEnv();
  if (env.error) {
    return json(res, 500, { error: env.error });
  }

  const auth = await ensureAdmin(req, env);
  if (!auth.ok) {
    return json(res, auth.status, { error: auth.message });
  }

  const { serviceClient, actorId, actorRole } = auth;

  if (req.method === 'GET') {
    const page = Number(req.query?.page || 1);
    const perPage = Number(req.query?.perPage || 200);

    const { data, error } = await serviceClient.auth.admin.listUsers({
      page: Number.isFinite(page) && page > 0 ? page : 1,
      perPage: Number.isFinite(perPage) && perPage > 0 ? Math.min(perPage, 500) : 200,
    });

    if (error) {
      return json(res, 500, { error: error.message });
    }

    return json(res, 200, {
      users: (data?.users || []).map(mapUser),
      total: data?.total || 0,
      actorRole,
      actorId,
    });
  }

  const body = parseBody(req);
  const action = String(body.action || '').trim().toLowerCase();

  if (action === 'invite') {
    const email = String(body.email || '').trim().toLowerCase();
    const role = normalizeRole(body.role);
    const appBaseUrl = getTrustedAppBaseUrl(req);
    const redirectTo = appBaseUrl ? `${appBaseUrl}/admin/login` : undefined;

    if (!email) {
      return json(res, 400, { error: 'Email is required.' });
    }

    const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: { role },
      redirectTo,
    });

    if (error) {
      return json(res, 400, { error: error.message });
    }

    const userId = data?.user?.id;
    await mergeRoleIntoAppMetadata(serviceClient, userId, role);
    await syncProfileAdminFlag(serviceClient, userId, role);

    return json(res, 200, {
      message: `Invite sent to ${email}.`,
      user: data?.user ? mapUser(data.user) : null,
    });
  }

  if (action === 'register') {
    const email = String(body.email || '').trim().toLowerCase();
    const role = normalizeRole(body.role);
    const customMessage = String(body.customMessage || '').trim().slice(0, 300);
    const appBaseUrl = getTrustedAppBaseUrl(req);
    const redirectQuery = new URLSearchParams({
      mode: 'new-user',
      ...(customMessage ? { welcome: customMessage } : {}),
    });
    const redirectTo = appBaseUrl ? `${appBaseUrl}/admin/login?${redirectQuery.toString()}` : undefined;

    if (!email) {
      return json(res, 400, { error: 'Email is required.' });
    }

    const { data, error } = await serviceClient.auth.admin.createUser({
      email,
      password: generateTempPassword(),
      email_confirm: true,
      user_metadata: {
        role,
        onboarding_message: customMessage,
      },
      app_metadata: {
        role,
      },
    });

    if (error) {
      return json(res, 400, { error: error.message });
    }

    const userId = data?.user?.id;
    await syncProfileAdminFlag(serviceClient, userId, role);

    const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      return json(res, 200, {
        message: `User created for ${email}, but reset email failed. Use Send Reset action manually.`,
        warning: resetError.message,
        user: data?.user ? mapUser(data.user) : null,
      });
    }

    return json(res, 200, {
      message: `User created for ${email}. Reset-password email has been sent.`,
      user: data?.user ? mapUser(data.user) : null,
    });
  }

  if (action === 'reset') {
    const email = String(body.email || '').trim().toLowerCase();
    const appBaseUrl = getTrustedAppBaseUrl(req);
    const redirectTo = appBaseUrl ? `${appBaseUrl}/admin/login` : undefined;

    if (!email) {
      return json(res, 400, { error: 'Email is required.' });
    }

    const { error } = await serviceClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return json(res, 400, { error: error.message });
    }

    return json(res, 200, {
      message: `Password reset email sent to ${email}.`,
    });
  }

  if (action === 'update-role') {
    const userId = String(body.userId || '').trim();
    const role = normalizeRole(body.role);

    if (!userId) {
      return json(res, 400, { error: 'userId is required.' });
    }

    await mergeRoleIntoAppMetadata(serviceClient, userId, role);
    await syncProfileAdminFlag(serviceClient, userId, role);

    return json(res, 200, {
      message: 'User role updated.',
      role,
    });
  }

  if (action === 'delete-users') {
    if (actorRole !== 'owner') {
      return json(res, 403, { error: 'Only owner can remove users.' });
    }

    const idsRaw = Array.isArray(body.userIds) ? body.userIds : [];
    const userIds = [...new Set(idsRaw.map((id) => String(id || '').trim()).filter(Boolean))];

    if (!userIds.length) {
      return json(res, 400, { error: 'No user IDs provided.' });
    }

    if (userIds.includes(actorId)) {
      return json(res, 400, { error: 'Owner cannot remove the currently signed-in account.' });
    }

    const failed = [];
    for (const userId of userIds) {
      const { error } = await serviceClient.auth.admin.deleteUser(userId);
      if (error) {
        failed.push({ userId, error: error.message });
      }
    }

    if (failed.length) {
      return json(res, 400, {
        error: 'Some users could not be removed.',
        failed,
      });
    }

    return json(res, 200, {
      message: `${userIds.length} user(s) removed.`,
      removedIds: userIds,
    });
  }

  return json(res, 400, { error: 'Unsupported action.' });
}
