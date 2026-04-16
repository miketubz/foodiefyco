import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminPanel from './pages/AdminPanel';
import ArchivePage from './pages/ArchivePage';
import ProfitCalculator from './pages/ProfitCalculator';
// Import your other existing pages here

function App() {
  return (
    <Router>
      <Routes>
        {/* Your existing routes */}
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/archive" element={<ArchivePage />} />
        <Route path="/admin/profit" element={<ProfitCalculator />} />
        {/* Add other routes */}
      </Routes>
    </Router>
  );
}

export default App;
