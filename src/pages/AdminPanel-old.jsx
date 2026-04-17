import React from 'react';

const AdminPanel = () => {
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Admin Panel Test</h1>
      <p>If you can see this text, the crash was in the Supabase code.</p>
      <p>If the page is still blank, the crash is in your imports.</p>
    </div>
  );
};

export default AdminPanel;
