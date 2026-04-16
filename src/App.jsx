import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminPanel from './pages/AdminPanel';
import ArchivePage from './pages/ArchivePage';
import ProfitCalculator from './pages/ProfitCalculator';

function App() {
  return (
    <Router>
      <Routes>
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/archive" element={<ArchivePage />} />
        <Route path="/admin/profit" element={<ProfitCalculator />} />
        
        {/* Redirect everything else to /admin */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
