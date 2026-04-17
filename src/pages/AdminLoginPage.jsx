import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import useAdminAuth from '../hooks/useAdminAuth.js';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, isAdmin, session, signOut } = useAdminAuth();

  const redirectTo = location.state?.from || '/admin';

  const [mode, setMode] = useState('login');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const recoveryDetected = hash.includes('type=recovery') || search.includes('type=recovery');

    if (recoveryDetected) {
      setRecoveryMode(true);
      setMode('recovery');
    }
  }, []);

  if (!loading && isAdmin && !recoveryMode) {
    return <Navigate to={redirectTo} replace />;
  }

  const title = useMemo(() => {
    if (recoveryMode) return 'Set a new password';
    return mode === 'forgot' ? 'Forgot password' : 'Sign in';
  }, [mode, recoveryMode]);

  const subtitle = useMemo(() => {
    if (recoveryMode) return 'Choose a new password for your admin account.';
    if (mode === 'forgot') return 'Enter your admin email and we will send a password reset link.';
    return 'Use your admin email and password.';
  }, [mode, recoveryMode]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/admin/login`,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage('Password reset email sent. Check your inbox and spam folder.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!newPassword || newPassword.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage('Password updated successfully. You can sign in now.');
      setRecoveryMode(false);
      setMode('login');
      setNewPassword('');
      setConfirmPassword('');
      window.history.replaceState({}, document.title, '/admin/login');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOutAndRetry = async () => {
    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

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
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
        </div>

        {!recoveryMode && (
          <div className="mb-4 flex gap-2 rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'login' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'forgot' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'}`}
            >
              Forgot password
            </button>
          </div>
        )}

        {session && !isAdmin && !loading && !recoveryMode && (
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

        {successMessage && (
          <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {recoveryMode ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {submitting ? 'Updating...' : 'Update password'}
            </button>
          </form>
        ) : mode === 'forgot' ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Admin email
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

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 disabled:bg-gray-400"
            >
              {submitting ? 'Sending reset link...' : 'Send reset link'}
            </button>
          </form>
        ) : (
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
        )}

        <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-semibold text-gray-800">Recommended setup</p>
          <p className="mt-1">
            Use invite-only admin accounts in Supabase Auth. Avoid public self-registration for the admin area.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            ← Back to storefront
          </Link>
          <Link
            to="/admin/help"
            className="text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Admin help
          </Link>
        </div>
      </div>
    </div>
  );
}
