export const ROLES = ['GERENCIA', 'ADMIN', 'SUPERVISOR', 'CONTADOR', 'CENTRAL', 'DEV'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  GERENCIA: 'Gerencia',
  ADMIN: 'Administración',
  SUPERVISOR: 'Supervisor',
  CONTADOR: 'Contador',
  CENTRAL: 'Central (red)',
  DEV: 'Desarrollador'
};

export const STAGES = ['Nuevo', 'Levantamiento', 'Cotizado', 'Negociación', 'Ganado'];

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  APROBADA: 'Aprobada',
  VENCIDA: 'Vencida',
  RECHAZADA: 'Rechazada'
};

export const UNIT_KINDS = ['MATRIZ', 'PILOTO', 'PROSPECTO', 'ACTIVA'] as const;

export const FLOW = [
  'Foto / XML / correo',
  'Borrador',
  'Revisión admin',
  'Gerencia autoriza',
  'ERP fiscal'
];

export const NETWORK_RULES = [
  { ok: true, text: 'Regalía 6% + marketing 2% sobre ventas timbradas (no sobre "ganancias").' },
  { ok: true, text: 'Fee tecnológico $2,500/mes por unidad.' },
  { ok: true, text: 'Compra exclusiva PROSEALMASTER; el franquiciado ve precio de compra, no landed.' },
  { ok: false, text: 'Franquicia formal solo con COF y marca IMPI (LFPPI 245–250).' }
];

export const GOLDEN_RULES = [
  { kind: 'ok', text: 'La IA sugiere, el humano aprueba. Nada se envía, paga ni contabiliza solo.' },
  { kind: 'bad', text: 'Cotización sin costo real: bloqueada. Margen bajo piso: requiere autorización.' },
  { kind: 'info', text: 'El XML CFDI manda sobre la foto. UUID duplicado: alerta y revisión.' },
  { kind: 'warn', text: 'Obra sin evidencia (foto + fase + m²): no se cierra.' }
];

export const COMMISSION_TYPES = [
  'FRANCHISE_ACQUIRED',
  'ROYALTY_CALCULATED',
  'TECH_FEE',
  'PRODUCT_ORDER',
  'SALE_TIMBRADA'
] as const;

export function fmt(n: number | null | undefined): string {
  return '$' + Math.round(n || 0).toLocaleString('es-MX');
}

export function fmt2(n: number | null | undefined): string {
  return '$' + (n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pct(n: number | null | undefined): string {
  return (n || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + '%';
}

// Zona horaria del negocio: la app opera en Torreón, Coahuila (México).
// Todas las fechas/horas que se muestran o agrupan usan esta zona, sin importar
// dónde corra el servidor (Vercel corre en UTC) ni el reloj del visitante.
export const TZ = 'America/Mexico_City';

/** Fecha + hora local de México (equivalente a toLocaleString('es-MX')). */
export function dateTimeStr(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleString('es-MX', { timeZone: TZ });
}

/** Hora local de México en formato HH:mm. */
export function timeStr(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

/** Clave de día local de México (YYYY-MM-DD), para agrupar consumos y kardex. */
export function dayKeyMX(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleDateString('en-CA', { timeZone: TZ }); // en-CA produce YYYY-MM-DD
}

/** Fecha local de México en formato dd/mm/aaaa. */
export function dateFullStr(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleDateString('es-MX', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function dateStr(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleDateString('es-MX', { timeZone: TZ, day: '2-digit', month: 'short' });
}

export function isoDate(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleDateString('en-CA', { timeZone: TZ });
}

export function periodOf(d: Date | string): string {
  return isoDate(d).slice(0, 7);
}
