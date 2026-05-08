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

const mapUser = (user) => ({
  id: user.id,
  email: user.email || '',
  role: user.app_metadata?.role || user.user_metadata?.role || 'viewer',
  createdAt: user.created_at || '',
  lastSignInAt: user.last_sign_in_at || '',
  isEmailConfirmed: Boolean(user.email_confirmed_at),
  isBanned: Boolean(user.banned_until),
});

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

  return {
    ok: true,
    serviceClient,
    actorId: userData.user.id,
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

  const { serviceClient } = auth;

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
    });
  }

  const body = parseBody(req);
  const action = String(body.action || '').trim().toLowerCase();

  if (action === 'invite') {
    const email = String(body.email || '').trim().toLowerCase();
    const role = normalizeRole(body.role);
    const redirectTo = String(body.redirectTo || '').trim() || undefined;

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
    const password = String(body.password || '');
    const role = normalizeRole(body.role);
    const emailConfirm = Boolean(body.emailConfirm);

    if (!email) {
      return json(res, 400, { error: 'Email is required.' });
    }

    if (password.length < 8) {
      return json(res, 400, { error: 'Password must be at least 8 characters.' });
    }

    const { data, error } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: emailConfirm,
      user_metadata: { role },
      app_metadata: { role },
    });

    if (error) {
      return json(res, 400, { error: error.message });
    }

    const userId = data?.user?.id;
    await syncProfileAdminFlag(serviceClient, userId, role);

    return json(res, 200, {
      message: `User created for ${email}.`,
      user: data?.user ? mapUser(data.user) : null,
    });
  }

  if (action === 'reset') {
    const email = String(body.email || '').trim().toLowerCase();
    const redirectTo = String(body.redirectTo || '').trim() || undefined;

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

  return json(res, 400, { error: 'Unsupported action.' });
}
