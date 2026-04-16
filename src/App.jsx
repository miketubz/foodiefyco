import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminPanel from './pages/AdminPanel';
import ArchivePage from './pages/ArchivePage';
import ProfitCalculator from './pages/ProfitCalculator';
// Add your existing imports here - LoginPage, etc.
import LoginPage from './pages/LoginPage'; // or whatever your login file is called

function App() {
  return (
    <Router>
      <Routes>
        {/* Your existing routes - ADD THESE BACK */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/" element={<YourFrontStorePage />} /> {/* whatever your home page is */}
        
        {/* New routes I added */}
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/archive" element={<ArchivePage />} />
        <Route path="/admin/profit" element={<ProfitCalculator />} />
        
        {/* Catch-all: redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
