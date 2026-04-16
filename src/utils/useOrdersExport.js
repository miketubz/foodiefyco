import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportSelectedArchiveToPDF = (orders) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text('Archived Orders Report', 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(`Total Orders: ${orders.length}`, 14, 34);

  const tableColumn = ['ID', 'Customer', 'Total', 'Status', 'Payment', 'Ordered', 'Archived'];
  const tableRows = orders.map(order => [
    order.id.substring(0, 8),
    order.customer_name,
    `₱${order.total_amount}`,
    order.status,
    order.payment_method,
    new Date(order.created_at).toLocaleDateString(),
    order.archived_at ? new Date(order.archived_at).toLocaleDateString() : '-'
  ]);

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 40,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] }
  });

  doc.save(`archived_orders_${new Date().toISOString().split('T')[0]}.pdf`);
};
