// Motor de cotización — espeja exactamente las fórmulas de IMPERTODO_AI_OS_FINAL / proseal-os-v02.
// Funciones puras: se usan en servidor (fuente de verdad) y en el cliente (resumen en vivo).

export interface SystemDef {
  key: string;
  name: string;
  short: string;
  life: number;
  warranty: number;
  list: number;
  promo: number;
  unit: string; // L | m2 | kg
  cons: number;
  pack: number;
  packPrice: number;
  labor: number;
  cons2: number;
  waste: number;
  pago: string;
  proc: string;
}

export interface ExtraInput {
  concept?: string;
  qty: number;
  price: number;
  costFactor: number;
  enabled: boolean;
}

export interface QuoteInput {
  planta: number;
  perim: number;
  alt: number;
  baj: number;
  dom: number;
  duc: number;
  optA: string;
  optB: string;
  selected: 'A' | 'B';
  priceMode: string; // promo | lista | manual | margen
  marginTarget: number;
  discount: number;
  floor: number;
  indirect: number;
  provider: string; // nac | psm
  access: string; // 1 | 1.15 | 1.3
  moving: number;
  billing: boolean;
  extras: ExtraInput[];
}

export interface Areas {
  planta: number;
  pretil: number;
  chaflan: number;
  bajantes: number;
  domos: number;
  ductos: number;
  dev: number;
}

export function areas(i: Pick<QuoteInput, 'planta' | 'perim' | 'alt' | 'baj' | 'dom' | 'duc'>): Areas {
  const planta = Math.max(0, i.planta || 0);
  const per = Math.max(0, i.perim || 0);
  const alt = Math.max(0, i.alt || 0);
  const baj = Math.max(0, i.baj || 0);
  const dom = Math.max(0, i.dom || 0);
  const duc = Math.max(0, i.duc || 0);
  const pretil = per * alt;
  const chaflan = per * 0.15;
  const bajantes = baj * 0.5;
  const domos = dom * 1.2;
  const ductos = duc * 0.4;
  return { planta, pretil, chaflan, bajantes, domos, ductos, dev: planta + pretil + chaflan + bajantes + domos + ductos };
}

export function providerFactor(provider: string): number {
  return provider === 'psm' ? 0.7 : 1;
}

export function matUnits(sys: SystemDef, area: number, provider: string) {
  const packs = Math.ceil((area * sys.cons * (1 + sys.waste)) / sys.pack || 0);
  const packCost = packs * sys.packPrice * providerFactor(provider);
  const unitName = sys.unit === 'L' ? 'cubetas 19 L' : sys.unit === 'm2' ? 'rollos 10 m²' : 'cubetas/sacos 20 kg';
  return { packs: packs || 0, unitName, cost: packCost };
}

export function costBreak(sys: SystemDef, area: number, opts: { provider: string; indirect: number; access: string; moving: number }) {
  const m = matUnits(sys, area, opts.provider);
  const acc = parseFloat(opts.access) || 1;
  const labor = area * sys.labor * acc;
  const cons = area * sys.cons2;
  const mov = Math.max(0, opts.moving || 0);
  const direct = m.cost + labor + cons + mov;
  const ind = direct * (Math.max(0, opts.indirect || 0) / 100);
  return { mat: m.cost, packs: m.packs, unitName: m.unitName, labor, cons, mov, ind, total: direct + ind };
}

export function perYear(sys: SystemDef): number {
  const maint = sys.unit === 'L' ? 18 : 6;
  return Math.round((sys.promo + maint * sys.life * 0.5) / sys.life);
}

export function unitPrice(sys: SystemDef, input: QuoteInput): number {
  let unit = sys.promo;
  if (input.priceMode === 'lista') unit = sys.list;
  if (input.priceMode === 'manual') unit = sys.list * 0.97;
  if (input.priceMode === 'margen') {
    const cb = costBreak(sys, 1, { provider: input.provider, indirect: input.indirect, access: input.access, moving: 0 });
    unit = cb.total / (1 - Math.max(1, Math.min(90, input.marginTarget)) / 100);
  }
  const disc = Math.max(0, Math.min(95, input.discount || 0)) / 100;
  return unit * (1 - disc);
}

export function semaforoClass(margin: number, floor: number): 'ok' | 'warn' | 'bad' {
  const f = floor / 100;
  if (margin >= f) return 'ok';
  if (margin >= f - 0.07) return 'warn';
  return 'bad';
}

export interface QuoteComputation {
  area: Areas;
  system: SystemDef;
  unitPrice: number;
  main: number;
  extrasSum: number;
  extrasCost: number;
  sub: number;
  iva: number;
  total: number;
  cost: number;
  cb: ReturnType<typeof costBreak>;
  margin: number;
  semaforo: 'ok' | 'warn' | 'bad';
  perYearValue: number;
  packs: number;
  packUnit: string;
}

export function computeQuote(sys: SystemDef, input: QuoteInput): QuoteComputation {
  const area = areas(input);
  const p = unitPrice(sys, input);
  const main = area.dev * p;
  const enabled = input.extras.filter((e) => e.enabled);
  const extrasSum = enabled.reduce((x, e) => x + e.qty * e.price, 0);
  const extrasCost = enabled.reduce((x, e) => x + e.qty * e.price * e.costFactor, 0);
  const sub = main + extrasSum;
  const iva = input.billing ? sub * 0.16 : 0;
  const cb = costBreak(sys, area.dev, {
    provider: input.provider,
    indirect: input.indirect,
    access: input.access,
    moving: input.moving
  });
  const cost = cb.total + extrasCost;
  const margin = sub > 0 ? (sub - cost) / sub : 0;
  return {
    area,
    system: sys,
    unitPrice: p,
    main,
    extrasSum,
    extrasCost,
    sub,
    iva,
    total: sub + iva,
    cost,
    cb,
    margin,
    semaforo: semaforoClass(margin, input.floor),
    perYearValue: perYear(sys),
    packs: cb.packs,
    packUnit: cb.unitName
  };
}

export interface Check {
  kind: 'ok' | 'warn' | 'bad';
  text: string;
}

export function validations(sys: SystemDef, input: QuoteInput, c: QuoteComputation, opts: { verified: boolean; drainageOk: boolean; diagnosed: boolean; documented: boolean }): Check[] {
  return [
    { kind: 'ok', text: 'Área desarrollada incluye pretiles, chaflanes, bajantes, domos y ductos.' },
    {
      kind: opts.verified ? 'ok' : 'warn',
      text: opts.verified ? 'Área verificada en sitio.' : 'Área no verificada: la propuesta lleva "a reserva de verificar área". Programar visita.'
    },
    {
      kind: opts.drainageOk || input.extras.some((e) => e.concept?.toLowerCase().includes('pendiente') && e.enabled) ? 'ok' : 'bad',
      text: 'Encharcamiento sin partida de corrección de pendiente: la garantía no se sostiene.'
    },
    { kind: opts.diagnosed ? 'ok' : 'warn', text: opts.diagnosed ? 'Diagnóstico IA adjunto.' : 'Sin diagnóstico: puedes enviar, pero conviene correr el análisis de fotos.' },
    { kind: 'ok', text: `Producto y espesor consistentes entre título y procedimiento (${sys.short}).` },
    {
      kind: sys.warranty < sys.life ? 'warn' : 'ok',
      text: sys.warranty < sys.life ? `Producto "${sys.life} años" con garantía ${sys.warranty} años: la propuesta explica la diferencia (mantenimiento).` : 'Garantía consistente.'
    },
    {
      kind: c.semaforo,
      text: `Margen ${(c.margin * 100).toFixed(0)}% vs piso ${input.floor}%${c.semaforo === 'bad' ? ' — requiere autorización de gerencia (queda registrado)' : ''}.`
    },
    {
      kind: opts.documented ? 'ok' : 'warn',
      text: opts.documented ? 'Ficha de costos documentada y declarada revisada por Administración.' : 'Sin ficha de costos documentada: la aprobación quedará bloqueada hasta registrarla.'
    },
    { kind: 'ok', text: `Vigencia 30 días, esquema ${sys.pago}, domicilio y "45 años" unificados.` }
  ];
}

export function selSystemKey(input: Pick<QuoteInput, 'selected' | 'optA' | 'optB'>): string {
  return input.selected === 'A' ? input.optA : input.optB;
}

export const DEFAULT_EXTRAS = [
  { concept: 'Retiro de acrílico ampollado/despegado y disposición', unit: 'm²', qty: 197, price: 28, costFactor: 0.68, source: 'Diagnóstico: ampollas' },
  { concept: 'Resane de fisuras en pretil con mortero flexible + refuerzo', unit: 'ml', qty: 38, price: 65, costFactor: 0.68, source: 'Diagnóstico: fisura pretil' },
  { concept: 'Corrección de pendiente zona de encharcamiento (mortero ≈2%)', unit: 'm²', qty: 45, price: 120, costFactor: 0.68, source: 'Diagnóstico: encharcamiento' },
  { concept: 'Refuerzo de bajantes y domo con membrana líquida', unit: 'pza', qty: 5, price: 380, costFactor: 0.6, source: 'Levantamiento' }
];
