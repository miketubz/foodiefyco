import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminPanel from './pages/AdminPanel';
import ArchivePage from './pages/ArchivePage';
import ProfitCalculator from './pages/ProfitCalculator';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Login Route */}
        <Route path="/admin/login" element={<LoginPage />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/archive" element={<ArchivePage />} />
        <Route path="/admin/profit" element={<ProfitCalculator />} />
        
        {/* Redirects - since you don't have a public home page */}
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
