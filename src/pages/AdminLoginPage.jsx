import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import useAdminAuth from '../hooks/useAdminAuth.js';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, isAdmin, session, signOut } = useAdminAuth();

  const redirectTo = location.state?.from || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!loading && isAdmin) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    try {
      if (session && !isAdmin) {
        await signOut();
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      navigate(redirectTo, { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Failed to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOutAndRetry = async () => {
    setSubmitting(true);
    setErrorMessage('');

    try {
      await signOut();
      navigate('/admin/login', { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Failed to sign out.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange-500">
            FoodiefyCo Admin
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
          <p className="mt-2 text-sm text-gray-600">
            Use your admin email and password.
          </p>
        </div>

        {session && !isAdmin && !loading && (
          <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
            <p className="mb-3">
              You are signed in, but this account does not have admin access.
            </p>
            <button
              type="button"
              onClick={handleSignOutAndRetry}
              disabled={submitting}
              className="rounded-lg bg-yellow-600 px-3 py-2 text-white hover:bg-yellow-700 disabled:bg-yellow-400"
            >
              Sign out and try another account
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 disabled:bg-gray-400"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-semibold text-gray-800">For now</p>
          <p className="mt-1">
            Create users in Supabase Auth, then mark their profile as admin.
          </p>
        </div>

        <Link
          to="/"
          className="mt-6 inline-block text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          ← Back to storefront
        </Link>
      </div>
    </div>
  );
}
