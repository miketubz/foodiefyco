export const generateOrdersCSV = (orders) => {
  if (!orders.length) return '';

  const headers = [
    'Order ID',
    'Date Ordered',
    'Customer Name',
    'Phone Number',
    'Delivery Address',
    'Payment Method',
    'Promo Code',
    'Discount Amount',
    'Special Instructions',
    'Items',
    'Item Count',
    'Total Amount',
    'Status',
  ];

  const escapeCSV = (value) => {
    const stringValue = String(value ?? '');
    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const rows = orders.map((order) => [
    escapeCSV(order.orderId),
    escapeCSV(order.orderDate),
    escapeCSV(order.customerName),
    escapeCSV(order.phoneNumber),
    escapeCSV(order.deliveryAddress),
    escapeCSV(order.paymentMethod),
    escapeCSV(order.promoCode),
    Number(order.discountAmount || 0).toFixed(2),
    escapeCSV(order.specialInstructions),
    escapeCSV(order.itemsSummary),
    order.itemCount,
    Number(order.totalAmount || 0).toFixed(2),
    escapeCSV(order.status),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
};

export const downloadCSV = (csvContent, filename = 'orders.csv') => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
