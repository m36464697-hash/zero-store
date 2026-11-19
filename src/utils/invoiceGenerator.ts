import { OrderRecord } from '../types';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function formatOrderDate(createdAt: unknown): string {
  try {
    if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
      const date = (createdAt as { toDate: () => Date }).toDate();
      return date.toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (typeof createdAt === 'string' || typeof createdAt === 'number') {
      return new Date(createdAt).toLocaleString('ar-EG');
    }
  } catch {
    // ignore formatting errors
  }
  return new Date().toLocaleString('ar-EG');
}

export async function generateInvoicePngDataUrl(
  order: OrderRecord,
  brandName = 'ZONE',
  accentColor = '#10B981'
): Promise<string> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await document.fonts.ready;
  }

  const width = 920;
  const height = 1220;
  const scale = 2;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر إنشاء الفاتورة');
  }
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#0B0E14';
  ctx.fillRect(0, 0, width, height);

  // Main Card
  drawRoundedRect(ctx, 40, 40, width - 80, height - 80, 24);
  ctx.fillStyle = '#121721';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#232B3A';
  ctx.stroke();

  // Top Accent Stripe
  drawRoundedRect(ctx, 40, 40, width - 80, 10, 6);
  ctx.fillStyle = accentColor;
  ctx.fill();

  // Header Brand (Right in RTL)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 38px Cairo, "Plus Jakarta Sans", sans-serif';
  ctx.fillText(brandName, width - 82, 122);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 16px Cairo, sans-serif';
  ctx.fillText('فاتورة شراء رقمية رسمية', width - 82, 152);

  // Order Number & Date (Left in RTL)
  ctx.textAlign = 'left';
  ctx.fillStyle = accentColor;
  ctx.font = '700 24px "JetBrains Mono", monospace';
  ctx.fillText(order.orderNumber, 82, 118);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 15px Cairo, sans-serif';
  ctx.fillText(formatOrderDate(order.createdAt), 82, 148);

  // Divider
  ctx.strokeStyle = '#232B3A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(82, 188);
  ctx.lineTo(width - 82, 188);
  ctx.stroke();

  // Status Box
  const statusLabels: Record<string, string> = {
    pending_payment: 'بانتظار مراجعة التحويل من الإدارة',
    verifying: 'تم تأكيد استلام المبلغ — جاري المراجعة',
    processing: 'قيد التنفيذ والتجهيز',
    completed: 'مكتمل — تم التسليم بنجاح',
    failed: 'ملغي / مرفوض',
  };

  drawRoundedRect(ctx, 82, 214, width - 164, 62, 14);
  ctx.fillStyle = order.status === 'completed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)';
  ctx.fill();
  ctx.strokeStyle = order.status === 'completed' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)';
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 15px Cairo, sans-serif';
  ctx.fillText('حالة الطلب', width - 106, 251);

  ctx.textAlign = 'left';
  ctx.fillStyle = order.status === 'completed' ? '#34D399' : '#FBBF24';
  ctx.font = '700 17px Cairo, sans-serif';
  ctx.fillText(statusLabels[order.status] || order.status, 106, 251);

  // Customer & Payment Info Grid
  const infoRows: Array<[string, string]> = [
    ['اسم العميل', order.customerName],
    ['البريد الإلكتروني', order.customerEmail],
    ['طريقة الدفع', order.paymentMethodName],
    ['محفظة التحويل', order.walletSenderPhone],
    ['مرجع التحويل', order.transactionRef],
  ];
  if (order.playerId) {
    infoRows.push(['معرّف اللاعب (Player ID)', order.playerId]);
  }

  let currentY = 324;
  for (const [label, value] of infoRows) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 16px Cairo, sans-serif';
    ctx.fillText(label, width - 82, currentY);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 16px Cairo, "JetBrains Mono", sans-serif';
    ctx.fillText(value, 82, currentY);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.moveTo(82, currentY + 18);
    ctx.lineTo(width - 82, currentY + 18);
    ctx.stroke();

    currentY += 46;
  }

  // Product Item Box
  currentY += 12;
  drawRoundedRect(ctx, 82, currentY, width - 164, 146, 16);
  ctx.fillStyle = '#181F2C';
  ctx.fill();
  ctx.strokeStyle = '#2A3446';
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 14px Cairo, sans-serif';
  ctx.fillText('تفاصيل المنتج الرقمي', width - 108, currentY + 34);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 22px Cairo, "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${order.productTitle} — ${order.packageName}`, width - 108, currentY + 72);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '600 16px Cairo, sans-serif';
  ctx.fillText(`الكمية: ${order.quantity} × ${order.unitPrice} ${order.currencySymbol}`, width - 108, currentY + 110);

  // Delivered Code Box
  currentY += 172;
  drawRoundedRect(ctx, 82, currentY, width - 164, 114, 16);
  ctx.fillStyle = '#0D131D';
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = accentColor;
  ctx.font = '700 15px "Readex Pro", Cairo, sans-serif';
  ctx.fillText(
    order.deliveryType === 'direct_id'
      ? 'مرجع تأكيد الشحن المباشر'
      : order.deliveryType === 'subscription_login'
      ? 'حالة تفعيل الاشتراك والخروج'
      : order.deliveryType === 'account_delivery'
      ? 'الحساب المسلم'
      : 'الكود الرقمي المسلم',
    width - 108,
    currentY + 36
  );

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 21px "JetBrains Mono", monospace';
  const deliveryDisplay =
    order.deliveryType === 'account_delivery' && order.deliveredAccountEmail
      ? `${order.deliveredAccountEmail}`
      : order.deliveredCode || 'بانتظار التأكيد وإصدار البيانات';
  ctx.fillText(deliveryDisplay, width / 2, currentY + 82);

  // Totals Section
  currentY += 146;
  if (order.discountAmount > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#34D399';
    ctx.font = '600 15px Cairo, sans-serif';
    ctx.fillText(`خصم كوبون (${order.couponCode})`, width - 82, currentY);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#34D399';
    ctx.font = '700 16px "JetBrains Mono", Cairo, sans-serif';
    ctx.fillText(`-${order.discountAmount.toFixed(2)} ${order.currencySymbol}`, 82, currentY);
    currentY += 36;
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 16px Cairo, sans-serif';
  ctx.fillText('رسوم بوابة الدفع الإلكتروني', width - 82, currentY);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '700 17px "JetBrains Mono", Cairo, sans-serif';
  ctx.fillText(`${order.feeAmount.toFixed(2)} ${order.currencySymbol}`, 82, currentY);

  currentY += 44;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px Cairo, sans-serif';
  ctx.fillText('الإجمالي المدفوع', width - 82, currentY);

  ctx.textAlign = 'left';
  ctx.fillStyle = accentColor;
  ctx.font = '800 28px "JetBrains Mono", Cairo, sans-serif';
  ctx.fillText(`${order.totalAmount.toFixed(2)} ${order.currencySymbol}`, 82, currentY);

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = '600 14px Cairo, sans-serif';
  ctx.fillText(
    `شكراً لتسوقك من متجر ${brandName} · هذه الفاتورة صادرة إلكترونياً وموثقة برقم الطلب ${order.orderNumber}`,
    width / 2,
    height - 72
  );

  return canvas.toDataURL('image/png');
}

export async function downloadInvoiceImage(
  order: OrderRecord,
  brandName = 'ZONE',
  accentColor = '#10B981'
): Promise<void> {
  const dataUrl = await generateInvoicePngDataUrl(order, brandName, accentColor);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${brandName}-Invoice-${order.orderNumber}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
