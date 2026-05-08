import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import useAdminAuth from '../hooks/useAdminAuth.js';

export default function AdminLoginPage() {
  const location = useLocation();
  const { loading, isAdmin, session, signOut } = useAdminAuth();
  const searchParams = new URLSearchParams(location.search);
  const onboardingMode = String(searchParams.get('mode') || '').trim();
  const onboardingMessage = String(searchParams.get('welcome') || '').trim();

  const redirectTo = location.state?.from || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data?.session) {
        setErrorMessage('Sign in succeeded, but no session was returned. Please try again.');
        return;
      }

      // Hard redirect so the whole app reloads with the fresh auth session.
      window.location.assign(redirectTo);
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
      window.location.assign('/admin/login');
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

        {(onboardingMode === 'new-user' || onboardingMessage) && (
          <div className="mb-4 rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-semibold">Welcome to FoodiefyCo Admin</p>
            <p className="mt-1">
              {onboardingMessage || 'Your account is ready. Set a new password using the link from your email, then sign in.'}
            </p>
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
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              style={{ color: '#111827', backgroundColor: '#ffffff' }}
              placeholder="admin@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-11 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                style={{ color: '#111827', backgroundColor: '#ffffff' }}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
                    <path d="M9.88 5.09A9.77 9.77 0 0112 5c5 0 9 4.5 9 7-1.06 2.09-2.6 3.8-4.41 4.96" />
                    <path d="M6.1 6.1C4.29 7.27 2.77 8.95 1.73 11 2.79 13.09 4.33 14.8 6.14 15.96" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M1.73 12C2.79 9.91 6.03 6 12 6s9.21 3.91 10.27 6c-1.06 2.09-4.3 6-10.27 6S2.79 14.09 1.73 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
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
          <p className="font-semibold text-gray-800">Get Access:</p>
          <p className="mt-1">
            Contact Admin Mike Tubel to register .
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
