import { Navigate, Route, Routes } from 'react-router-dom';
import FrontendPage from './pages/FrontendPage';
import AdminPage from './pages/AdminPage';
import MenuAdminPanel from './pages/MenuAdminPanel';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminExternalPage from './pages/AdminExternalPage';
import GalleryPage from './pages/GalleryPage';
import AdminGalleryPage from './pages/AdminGalleryPage';
import RequireAdmin from './components/RequireAdmin';

function App() {
  return (
    <Routes>
      <Route path="/" element={<FrontendPage />} />
      <Route path="/gallery" element={<GalleryPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/menu"
        element={
          <RequireAdmin>
            <MenuAdminPanel />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/external"
        element={
          <RequireAdmin>
            <AdminExternalPage />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/gallery"
        element={
          <RequireAdmin>
            <AdminGalleryPage />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
