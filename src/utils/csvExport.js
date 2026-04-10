export function generateOrdersCSV(orders = []) {
  const headers = [
    'Order ID',
    'Date Ordered',
    'Customer Name',
    'Phone Number',
    'Delivery Address',
    'Payment Method',
    'Promo Code',
    'Discount Amount',
    'Items',
    'Item Count',
    'Total Amount',
    'Status',
    'Special Instructions',
  ];

  const escapeValue = (value) => {
    const stringValue = String(value ?? '');
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const rows = orders.map((order) => [
    order.orderId,
    order.orderDate,
    order.customerName,
    order.phoneNumber,
    order.deliveryAddress,
    order.paymentMethod,
    order.promoCode || '',
    Number(order.discountAmount || 0).toFixed(2),
    order.itemsSummary,
    order.itemCount,
    Number(order.totalAmount || 0).toFixed(2),
    order.status,
    order.specialInstructions || '',
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeValue).join(','))
    .join('\n');
}

export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
