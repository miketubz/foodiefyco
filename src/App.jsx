import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminPanel } from './components/AdminPanel.jsx';
import MenuAdminPanel from './components/MenuAdminPanel.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import FrontendPage from './pages/FrontendPage.jsx';
import GalleryPage from './pages/GalleryPage.jsx';
import AdminGalleryPage from './pages/AdminGalleryPage.jsx';
import AdminExternalPage from './pages/AdminExternalPage.jsx';

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
            <AdminPanel />
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
        path="/admin/gallery"
        element={
          <RequireAdmin>
            <AdminGalleryPage />
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
