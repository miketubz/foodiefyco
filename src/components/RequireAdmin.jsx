import { Navigate, useLocation } from 'react-router-dom';
import useAdminAuth from '../hooks/useAdminAuth.js';

export default function RequireAdmin({ children }) {
  const location = useLocation();
  const { loading, session, user, profile, isAdmin, signOut } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <p className="text-lg font-semibold text-gray-800">Checking admin access...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Access denied</h1>
          <p className="mb-4 text-sm text-gray-600">
            This account is signed in but is not marked as an admin.
          </p>

          <div className="mb-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
            <p><span className="font-semibold">Email:</span> {user?.email || 'N/A'}</p>
            <p><span className="font-semibold">Username:</span> {profile?.username || 'N/A'}</p>
          </div>

          <button
            onClick={signOut}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return children;
}
