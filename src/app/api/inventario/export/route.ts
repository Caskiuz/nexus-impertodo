import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

// Colores estilo Excel: entradas verdes, salidas rojas.
const FILL_ENTRADA = 'C6EFCE';
const FONT_ENTRADA = '006100';
const FILL_SALIDA = 'FFC7CE';
const FONT_SALIDA = '9C0006';
const FILL_HEADER = '1F4E78';
const FILL_STOCK_OK = 'C6EFCE';
const FILL_STOCK_BAJO = 'FFEB9C';
const FILL_STOCK_SIN = 'FFC7CE';

// Los movimientos anteriores a la columna `type` guardaban las salidas con cantidad negativa.
const esSalida = (m: { type: string; qty: number }) => m.type === 'SALIDA' || m.qty < 0;
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const [items, movements] = await Promise.all([
    prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } }),
    prisma.stockMovement.findMany({ orderBy: { createdAt: 'asc' } })
  ]);

  const itemMap = new Map(items.map((i) => [i.id, i]));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IMPERTODO AI OS';
  wb.created = new Date();

  // ---------- Hoja 1: Kardex (filas = productos, columnas = movimientos) ----------
  const kardex = wb.addWorksheet('Kardex', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
  });

  kardex.getRow(1).values = [
    'Producto',
    'Stock actual',
    ...movements.map((m, i) => `${i + 1} ${m.docRef || m.reason} · ${m.createdAt.toLocaleDateString('es-MX')}`)
  ];
  kardex.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  kardex.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + FILL_HEADER } };
  kardex.getRow(1).height = 24;
  kardex.getRow(1).alignment = { wrapText: true, vertical: 'middle' };
  kardex.columns = [
    { width: 38 },
    { width: 12 },
    ...movements.map(() => ({ width: 15 }))
  ];

  for (const item of items) {
    const row = kardex.addRow([item.name, `${item.stock} ${item.unitName}`]);
    row.getCell('A').font = { bold: true };

    const stockCell = row.getCell('B');
    stockCell.alignment = { horizontal: 'center' };
    if (item.stock <= 0) {
      stockCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + FILL_STOCK_SIN } };
      stockCell.font = { bold: true, color: { argb: 'FF' + FONT_SALIDA } };
    } else if (item.stock < item.min) {
      stockCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + FILL_STOCK_BAJO } };
      stockCell.font = { bold: true, color: { argb: 'FF7B6E00' } };
    } else {
      stockCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + FILL_STOCK_OK } };
      stockCell.font = { bold: true, color: { argb: 'FF' + FONT_ENTRADA } };
    }

    const byMovement = new Map(
      movements.filter((m) => m.itemId === item.id).map((m) => [m.id, m])
    );
    movements.forEach((m, idx) => {
      const own = byMovement.get(m.id);
      if (!own) return;
      const cell = row.getCell(idx + 3);
      const salida = esSalida(own);
      cell.value = `${salida ? '−' : '+'}${Math.abs(own.qty)} ${item.unitName}`;
      cell.alignment = { horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (salida ? FILL_SALIDA : FILL_ENTRADA) } };
      cell.font = { color: { argb: 'FF' + (salida ? FONT_SALIDA : FONT_ENTRADA) } };
    });
  }

  // ---------- Hoja 2: Movimientos (desglose) ----------
  const mov = wb.addWorksheet('Movimientos', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  mov.getRow(1).values = ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Saldo', 'Factura / remisión', 'Motivo', 'Usuario'];
  mov.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  mov.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + FILL_HEADER } };
  mov.columns = [
    { width: 18 },
    { width: 38 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 22 },
    { width: 28 },
    { width: 16 }
  ];
  for (const m of [...movements].reverse()) {
    const it = itemMap.get(m.itemId);
    const salida = esSalida(m);
    const row = mov.addRow([
      m.createdAt.toLocaleString('es-MX'),
      it?.name || 'Producto eliminado',
      salida ? 'SALIDA' : 'ENTRADA',
      `${salida ? '−' : '+'}${Math.abs(m.qty)} ${it?.unitName || ''}`,
      m.balance ?? '',
      m.docRef || '',
      `${m.reason}${m.otCode ? ' · ' + m.otCode : ''}`,
      m.userName || ''
    ]);
    const tipoCell = row.getCell(3);
    if (salida) {
      tipoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + FILL_SALIDA } };
      tipoCell.font = { color: { argb: 'FF' + FONT_SALIDA } };
    } else {
      tipoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + FILL_ENTRADA } };
      tipoCell.font = { color: { argb: 'FF' + FONT_ENTRADA } };
    }
  }

  // ---------- Hoja 3: Productos (maestro) ----------
  const prod = wb.addWorksheet('Productos', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  prod.getRow(1).values = ['Producto', 'Stock', 'Mínimo', 'Costo unitario', 'Proveedor', 'Estado', 'Valor del almacén'];
  prod.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  prod.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + FILL_HEADER } };
  prod.columns = [
    { width: 38 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
    { width: 20 },
    { width: 14 },
    { width: 16 }
  ];
  for (const i of items) {
    const estado = i.stock <= 0 ? 'Sin stock' : i.stock < i.min ? 'Bajo mínimo' : 'OK';
    prod.addRow([i.name, i.stock, i.min, i.cost, i.provider, estado, i.stock * i.cost]);
  }

  // ---------- Hoja 4: Consumos diarios (salidas por fecha, estilo Excel) ----------
  const salidas = movements.filter(esSalida);
  const dias = Array.from(new Set(salidas.map((m) => dayKey(m.createdAt))));
  const consumos = wb.addWorksheet('Consumos', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  });
  consumos.getRow(1).values = [
    'Producto',
    ...dias.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`),
    'Total período'
  ];
  consumos.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  consumos.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + FILL_HEADER } };
  consumos.columns = [{ width: 38 }, ...dias.map(() => ({ width: 12 })), { width: 14 }];

  const consumoPorItem = new Map<string, Map<string, number>>();
  for (const m of salidas) {
    if (!consumoPorItem.has(m.itemId)) consumoPorItem.set(m.itemId, new Map());
    const map = consumoPorItem.get(m.itemId)!;
    const k = dayKey(m.createdAt);
    map.set(k, Math.round(((map.get(k) || 0) + Math.abs(m.qty)) * 100) / 100);
  }
  for (const item of items) {
    const map = consumoPorItem.get(item.id);
    if (!map) continue;
    const total = Math.round(dias.reduce((s, d) => s + (map.get(d) || 0), 0) * 100) / 100;
    const row = consumos.addRow([
      item.name,
      ...dias.map((d) => map.get(d) ?? null),
      `${total} ${item.unitName}`
    ]);
    row.getCell('A').font = { bold: true };
    row.getCell(dias.length + 2).font = { bold: true, color: { argb: 'FF' + FONT_SALIDA } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const fecha = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="inventario-${fecha}.xlsx"`
    }
  });
}
