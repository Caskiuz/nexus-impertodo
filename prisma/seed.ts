import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { computeQuote, type SystemDef, type QuoteInput } from '../src/lib/calc';

const prisma = new PrismaClient();

const SYSTEMS: SystemDef[] = [
  { key: 'acr7', name: 'Acrílico fibratado 7 años (Valmex) blanco', short: 'Acrílico 7 años', life: 7, warranty: 5, list: 189, promo: 169, unit: 'L', cons: 1.0, pack: 19, packPrice: 950, labor: 30, cons2: 4, waste: 0.1, pago: '60/40', proc: '1) Limpieza de la superficie · 2) Sellador acrílico tapaporos · 3) Sellar grietas y puntos críticos con cemento plástico · 4) 1ª capa acrílico 7 años · 5) Membrana súper reforzada, traslape 10 cm · 6) 2ª capa acrílico 7 años' },
  { key: 'acr10', name: 'Acrílico fibratado 10 años (Kánuh) blanco o terracota', short: 'Acrílico 10 años', life: 10, warranty: 5, list: 199, promo: 169, unit: 'L', cons: 1.0, pack: 19, packPrice: 1050, labor: 30, cons2: 4, waste: 0.1, pago: '60/40', proc: '1) Limpieza de la superficie · 2) Sellador acrílico tapaporos · 3) Sellar grietas y puntos críticos con cemento plástico · 4) 1ª capa acrílico 10 años · 5) 1 capa de membrana súper reforzada, traslape 10 cm · 6) 2ª capa acrílico 10 años' },
  { key: 'sbs45', name: 'Rollo prefabricado SBS 4.5 mm fibra poliéster, gravilla blanca (Chovatek)', short: 'Rollo SBS 4.5 mm', life: 12, warranty: 10, list: 390, promo: 329, unit: 'm2', cons: 1.0, pack: 10, packPrice: 1500, labor: 45, cons2: 14, waste: 0.12, pago: '70/30', proc: '1) Limpieza · 2) Primer asfáltico concentrado · 3) Sellado de puntos críticos con cemento plástico asfáltico · 4) Colocación de rollo 4.5 mm por termofusión, traslape 10 cm · 5) Resoldar traslapes · 6) Cemento plástico asfáltico perimetral · 7) Cubrir perímetro con acrílico' },
  { key: 'pu', name: 'Poliuretano espreado 3/4"–1" + recubrimiento blanco', short: 'Poliuretano espreado', life: 8, warranty: 2.5, list: 240, promo: 220, unit: 'kg', cons: 1.1, pack: 20, packPrice: 2100, labor: 40, cons2: 8, waste: 0.08, pago: '60/40', proc: '1) Limpieza · 2) Poliuretano espreado 3/4"–1" de espesor promedio · 3) Capa de recubrimiento especial color blanco' },
  { key: 'polu', name: 'Poliurea por aspersión (industrial / tanques)', short: 'Poliurea', life: 15, warranty: 10, list: 690, promo: 620, unit: 'kg', cons: 2.0, pack: 20, packPrice: 3200, labor: 90, cons2: 20, waste: 0.08, pago: '70/30', proc: '1) Preparación mecánica · 2) Primer epóxico · 3) Poliurea 2 mm por aspersión en caliente · 4) Detalles y protección UV' },
  { key: 'sil', name: 'Silicona líquida alta reflectancia', short: 'Silicona', life: 15, warranty: 10, list: 360, promo: 310, unit: 'L', cons: 1.2, pack: 19, packPrice: 2600, labor: 35, cons2: 6, waste: 0.1, pago: '60/40', proc: '1) Limpieza · 2) Primer de adherencia · 3) Refuerzo en detalles · 4) 2 capas de silicona' },
  { key: 'cem', name: 'Cementoso flexible / cristalización (cisternas, muros)', short: 'Cementoso', life: 10, warranty: 5, list: 290, promo: 260, unit: 'kg', cons: 3.0, pack: 20, packPrice: 780, labor: 45, cons2: 6, waste: 0.08, pago: '60/40', proc: '1) Preparación y saturación · 2) 1ª capa cementosa · 3) Malla en detalles · 4) 2ª capa · 5) Curado' },
  { key: 'ais', name: 'Aislamiento térmico + acrílico reflectivo (NO MÁS CALOR)', short: 'Aislamiento térmico', life: 10, warranty: 5, list: 320, promo: 290, unit: 'L', cons: 1.6, pack: 19, packPrice: 1900, labor: 38, cons2: 8, waste: 0.1, pago: '60/40', proc: '1) Limpieza · 2) Sellador · 3) Aislante térmico elastomérico 2 capas · 4) Refuerzo · 5) Acabado reflectivo' },
  { key: 'epx', name: 'Piso epóxico industrial 2 mm', short: 'Piso epóxico', life: 10, warranty: 3, list: 390, promo: 350, unit: 'kg', cons: 1.2, pack: 20, packPrice: 3400, labor: 60, cons2: 15, waste: 0.08, pago: '60/40', proc: '1) Preparación mecánica (diamantado) · 2) Primer epóxico · 3) Capa base · 4) Capa de acabado' }
];

const EXTRAS = [
  { concept: 'Retiro de acrílico ampollado/despegado y disposición', unitName: 'm²', qty: 197, price: 28, costFactor: 0.68, sourceLabel: 'Diagnóstico: ampollas' },
  { concept: 'Resane de fisuras en pretil con mortero flexible + refuerzo', unitName: 'ml', qty: 38, price: 65, costFactor: 0.68, sourceLabel: 'Diagnóstico: fisura pretil' },
  { concept: 'Corrección de pendiente zona de encharcamiento (mortero ≈2%)', unitName: 'm²', qty: 45, price: 120, costFactor: 0.68, sourceLabel: 'Diagnóstico: encharcamiento' },
  { concept: 'Refuerzo de bajantes y domo con membrana líquida', unitName: 'pza', qty: 5, price: 380, costFactor: 0.6, sourceLabel: 'Levantamiento' }
];

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86400000);

async function main() {
  const existing = await prisma.unit.count();
  if (existing > 0) {
    console.log('Seed omitido: la base ya tiene datos.');
    return;
  }

  const hash = await bcrypt.hash('impertodo2026', 10);
  const devHash = await bcrypt.hash('nexus2026', 10);

  const torreon = await prisma.unit.create({ data: { name: 'Impertodo Torreón', city: 'Torreón', kind: 'MATRIZ', model: 'Unidad matriz' } });
  const monterrey = await prisma.unit.create({ data: { name: 'Unidad Monterrey', city: 'Monterrey', kind: 'PILOTO', model: 'Piloto (licenciatario)' } });
  const queretaro = await prisma.unit.create({ data: { name: 'Unidad Querétaro', city: 'Querétaro', kind: 'PROSPECTO', model: 'Prospecto', investment: 650000, feasibility: 'Alta' } });

  await prisma.user.createMany({
    data: [
      { email: 'gerencia@impertodo.mx', name: 'Gerencia', passwordHash: hash, role: 'GERENCIA', unitId: torreon.id },
      { email: 'admin@impertodo.mx', name: 'Administración', passwordHash: hash, role: 'ADMIN', unitId: torreon.id },
      { email: 'supervisor@impertodo.mx', name: 'Supervisor', passwordHash: hash, role: 'SUPERVISOR', unitId: torreon.id },
      { email: 'contador@impertodo.mx', name: 'Contador', passwordHash: hash, role: 'CONTADOR', unitId: torreon.id },
      { email: 'central@impertodo.mx', name: 'Central', passwordHash: hash, role: 'CENTRAL', unitId: torreon.id },
      { email: 'dev@nexus.mx', name: 'Desarrollador Nexus', passwordHash: devHash, role: 'DEV', unitId: torreon.id }
    ]
  });

  await prisma.system.createMany({ data: SYSTEMS });
  await prisma.costSheet.createMany({
    data: [
      { systemKey: 'acr10', supplier: 'Kánuh (nacional)', material: 62, labor: 30, prep: 13, waste: 8, source: 'CFDI KAN-1042 / 2026-10-05', technical: 'Ficha acrílico 10 años / rev 2026', confirmed: true },
      { systemKey: 'sbs45', supplier: 'Chovatek Norte', material: 156, labor: 48, prep: 15, waste: 10, source: 'CFDI CHV-8821 / 2026-10-18', technical: 'Ficha SBS 4.5 mm / rev 2026 aprobada por ingeniería', confirmed: true }
    ]
  });
  await prisma.settings.create({ data: { id: 'default', floor: 32, indirect: 8, provider: 'nac' } });
  await prisma.commissionConfig.create({ data: { id: 'default', rate: 0.2 } });

  // ---------- Clientes y activos ----------
  const clients = await Promise.all([
    prisma.client.create({ data: { unitId: torreon.id, name: 'Unidad de Consulta Externa Torreón', sector: 'Gobierno / Salud', contact: 'Ing. Isaac Díaz', phone: '871 710 1254', address: 'Agroindustrias #328 Ote., Parque Industrial Oriente, Torreón' } }),
    prisma.client.create({ data: { unitId: torreon.id, name: 'OXXO Región Laguna', sector: 'Comercial', contact: 'Mantenimiento zona', phone: '871 000 0001', address: 'Región Laguna' } }),
    prisma.client.create({ data: { unitId: torreon.id, name: 'IMSS HGZ No. 16', sector: 'Gobierno / Salud', contact: 'Conservación', address: 'Torreón' } }),
    prisma.client.create({ data: { unitId: torreon.id, name: 'LALA Planta Torreón', sector: 'Industrial', contact: 'Compras', address: 'Planta Torreón' } }),
    prisma.client.create({ data: { unitId: torreon.id, name: 'Altozano Casa club', sector: 'Comercial', contact: 'Administración', address: 'Torreón' } }),
    prisma.client.create({ data: { unitId: torreon.id, name: 'Edgar Yáñez', sector: 'Residencial', contact: 'Edgar Yáñez', phone: '870 168 9391', address: 'Circuito Santa Isabel #79, Villas de San Ángel' } })
  ]);

  await prisma.asset.createMany({
    data: [
      { clientId: clients[1].id, name: 'OXXO · 12 sucursales', area: 3420, note: 'Garantía año 1 por sucursal' },
      { clientId: clients[2].id, name: 'HGZ 16 · losas y techumbres', area: 5800, note: 'Licitación en curso' },
      { clientId: clients[3].id, name: 'Planta · techumbre anexo', area: 9150, warrantyUntil: new Date('2029-06-30') },
      { clientId: clients[4].id, name: 'Casa club', area: 1100, note: 'Obra en proceso' },
      { clientId: clients[5].id, name: 'Casa · losa y ductos', area: 78, warrantyUntil: new Date('2028-03-01') }
    ]
  });

  // ---------- Leads (embudo) ----------
  await prisma.lead.createMany({
    data: [
      { unitId: torreon.id, company: 'Unidad de Consulta Externa Torreón', contact: 'Ing. Isaac Díaz', phone: '871 710 1254', sector: 'Gobierno / Salud', project: 'Impermeabilización losa principal', address: 'Parque Industrial Oriente', area: 1314.18, amount: 501543.66, stage: 2, source: 'Referido', nextAction: 'Seguimiento: 2 opciones sin respuesta', daysInStage: 18, heat: 'hot' },
      { unitId: torreon.id, company: 'LALA · techumbre anexo', contact: 'Compras', phone: '871 000 1111', sector: 'Industrial', project: 'Mantenimiento de techumbre', area: 2250, amount: 860000, stage: 3, source: 'Referido', nextAction: 'OC en trámite', daysInStage: 9, heat: 'warm' },
      { unitId: torreon.id, company: 'Nave · Parque Industrial Lagunero', contact: 'Gerente de mantto', sector: 'Industrial', project: 'Impermeabilización nave logística', address: 'Parque Industrial Lagunero', area: 6800, amount: 1900000, stage: 0, source: 'Radar de techos', nextAction: 'Levantamiento con dron', daysInStage: 1, heat: 'cool' },
      { unitId: torreon.id, company: 'Condominio Torre Alta', contact: 'Administración', sector: 'Comercial', project: 'Revisión de bajantes y pretiles', area: 900, amount: 240000, stage: 1, source: 'Referido', nextAction: 'Visita agendada', daysInStage: 3, heat: 'warm' },
      { unitId: torreon.id, company: 'IMSS · HGZ No. 16', contact: 'Conservación', sector: 'Gobierno / Salud', project: 'Mantenimiento impermeabilización', area: 5800, amount: 1600000, stage: 3, source: 'Licitación', nextAction: 'Propuesta técnica', daysInStage: 5, heat: 'warm' },
      { unitId: torreon.id, company: 'OXXO · 4 sucursales', contact: 'Mantenimiento zona', sector: 'Comercial', project: 'Mantenimiento anual', area: 1140, amount: 193000, stage: 3, source: 'Referido', nextAction: 'Mantenimiento anual', daysInStage: 12, heat: 'warm' },
      { unitId: torreon.id, company: 'Local comercial · Centro', contact: 'Sr. Ramos', phone: '871 555 0101', sector: 'Comercial', project: 'Impermeabilización local', area: 180, amount: 52500, stage: 0, source: 'WhatsApp', nextAction: 'Visita viernes 9:00', daysInStage: 0, heat: 'cool' },
      { unitId: torreon.id, company: 'Edgar Yáñez · PU losa y ductos', contact: 'Edgar Yáñez', phone: '870 168 9391', sector: 'Residencial', project: 'Poliuretano losa y ductos', area: 78, amount: 17160, stage: 4, source: 'Referido', nextAction: 'Garantía 2.5 años', daysInStage: 0, heat: 'cool' }
    ]
  });

  // ---------- Cotizaciones demo (motor real) ----------
  const baseInput: QuoteInput = {
    planta: 1314.18, perim: 0, alt: 0, baj: 0, dom: 0, duc: 0,
    optA: 'acr10', optB: 'sbs45', selected: 'A', priceMode: 'promo', marginTarget: 32,
    discount: 0, floor: 32, indirect: 8, provider: 'nac', access: '1', moving: 0,
    billing: true, extras: []
  };
  const acr10 = SYSTEMS.find((s) => s.key === 'acr10')!;
  const sbs45 = SYSTEMS.find((s) => s.key === 'sbs45')!;
  const puSys = SYSTEMS.find((s) => s.key === 'pu')!;

  const q041 = computeQuote(acr10, { ...baseInput, selected: 'A' });
  const q042 = computeQuote(sbs45, { ...baseInput, selected: 'B' });
  const q118 = computeQuote(puSys, { ...baseInput, planta: 78, perim: 0, billing: false, selected: 'B' });

  await prisma.quote.create({
    data: {
      folio: '2026-041', unitId: torreon.id, clientId: clients[0].id, clientName: clients[0].name,
      contact: 'Ing. Isaac Díaz', phone: '871 710 1254', sector: 'Gobierno / Salud',
      element: 'Losa de azotea no transitable', address: 'Parque Industrial Oriente',
      planta: 1314.18, optA: 'acr10', optB: 'sbs45', selected: 'A', billing: 'si', provider: 'nac',
      floor: 32, indirect: 8, areaDev: q041.area.dev, sub: q041.sub, iva: q041.iva, total: q041.total,
      margin: q041.margin, status: 'ENVIADA', costsDocumented: true, catalogSource: 'CFDI KAN-1042 / 2026-10-05',
      createdAt: daysAgo(18), verified: true,
      extras: { create: EXTRAS.map((e) => ({ concept: e.concept, unitName: e.unitName, qty: e.qty, price: e.price, costFactor: e.costFactor, enabled: false, sourceLabel: e.sourceLabel })) }
    }
  });
  const quote042 = await prisma.quote.create({
    data: {
      folio: '2026-042', unitId: torreon.id, clientId: clients[0].id, clientName: clients[0].name,
      contact: 'Ing. Isaac Díaz', phone: '871 710 1254', sector: 'Gobierno / Salud',
      element: 'Losa de azotea no transitable', address: 'Parque Industrial Oriente',
      planta: 1314.18, optA: 'acr10', optB: 'sbs45', selected: 'B', billing: 'si', provider: 'nac',
      floor: 32, indirect: 8, areaDev: q042.area.dev, sub: q042.sub, iva: q042.iva, total: q042.total,
      margin: q042.margin, status: 'ENVIADA', costsDocumented: true, catalogSource: 'CFDI CHV-8821 / 2026-10-18',
      createdAt: daysAgo(18), verified: true,
      extras: { create: EXTRAS.map((e) => ({ concept: e.concept, unitName: e.unitName, qty: e.qty, price: e.price, costFactor: e.costFactor, enabled: false, sourceLabel: e.sourceLabel })) }
    }
  });
  await prisma.quote.create({
    data: {
      folio: '2025-118', unitId: torreon.id, clientId: clients[5].id, clientName: clients[5].name,
      contact: 'Edgar Yáñez', phone: '870 168 9391', sector: 'Residencial', element: 'Losa transitable',
      planta: 78, optA: 'pu', optB: 'pu', selected: 'B', billing: 'no', floor: 30,
      areaDev: q118.area.dev, sub: q118.sub, iva: 0, total: q118.total, margin: q118.margin,
      status: 'APROBADA', approvalsAdmin: true, approvalsGerencia: true, costsDocumented: false,
      createdAt: new Date('2025-12-18')
    }
  });

  // ---------- Órdenes de trabajo ----------
  await prisma.oT.createMany({
    data: [
      { code: 'OT-2026-088', unitId: torreon.id, quoteId: quote042.id, clientName: 'OXXO · Sucursal Torreón Centro', systemKey: 'acr10', area: 285, supervisor: 'J. Ramírez', crew: 3, status: 'EN_OBRA', phases: 6, phasesDone: 4, matTheo: 15, matReal: 16, laborReal: 190, createdAt: daysAgo(9) },
      { code: 'OT-2026-089', unitId: torreon.id, clientName: 'Altozano · Casa club', systemKey: 'sbs45', area: 1100, supervisor: 'M. Torres', crew: 4, status: 'EN_OBRA', phases: 7, phasesDone: 3, matTheo: 124, matReal: 72, laborReal: 600, createdAt: daysAgo(11) },
      { code: 'OT-2026-090', unitId: torreon.id, clientName: 'Maseca · cuarto de máquinas', systemKey: 'polu', area: 320, supervisor: 'J. Ramírez', crew: 2, status: 'DETENIDA', phases: 4, phasesDone: 1, matTheo: 35, matReal: 0, laborReal: 0, createdAt: daysAgo(8) }
    ]
  });

  // ---------- Documentos / CFDI ----------
  await prisma.doc.createMany({
    data: [
      { unitId: torreon.id, source: 'SAT', supplier: 'Comercializadora Imperquimia Laguna SA de CV', description: 'CFDI recibido · 12 cubetas acrílico 10 años', date: daysAgo(8), total: 12600, iva: 2016, category: 'Material de obra', workRef: 'OT-2026-088', uuid: '3F2A0000-1111-4000-8000-0000000009C1', confidence: 0.96, status: 'PENDIENTE' },
      { unitId: torreon.id, source: 'CORREO', supplier: 'Gas LP del Norte', description: 'CFDI por correo · gas para termofusión', date: daysAgo(9), total: 2350, iva: 376, category: 'Consumibles', workRef: 'OT-2026-089', uuid: '7B100000-2222-4000-8000-00000000044E', confidence: 0.9, status: 'PENDIENTE' },
      { unitId: torreon.id, source: 'FOTO', supplier: 'OXXO Gas · ticket', description: 'Foto de ticket · gasolina camioneta', date: daysAgo(8), total: 1200, iva: 0, category: 'Viáticos / traslado', workRef: 'OT-2026-088', confidence: 0.82, status: 'PENDIENTE' },
      { unitId: torreon.id, source: 'FOTO', supplier: 'Ferretería El Clavo', description: 'Foto de nota · brochas, cuñas, cinta', date: daysAgo(8), total: 860, iva: 0, category: 'Herramienta menor', workRef: 'OT-2026-089', confidence: 0.71, warn: 'Sin factura: pedir CFDI con RFC', status: 'PENDIENTE' },
      { unitId: torreon.id, source: 'SAT', supplier: 'Unidad de Consulta Externa Torreón', description: 'CFDI emitido · anticipo 60% cot. 2026-041', date: daysAgo(7), total: 154579, iva: 21321, category: 'Ingreso · anticipo', uuid: 'A91C0000-3333-4000-8000-0000000002D7', confidence: 0.99, status: 'PENDIENTE', income: true },
      { unitId: torreon.id, source: 'BANCO', supplier: 'BBVA · estado de cuenta', description: 'Depósito SPEI $154,579 → concilia con CFDI anticipo', date: daysAgo(7), total: 154579, iva: 0, category: 'Cobro', confidence: 0.97, status: 'PENDIENTE', income: true },
      { unitId: torreon.id, source: 'SAT', supplier: 'Distribuidora Chovatek Norte', description: 'CFDI recibido · 40 rollos SBS 4.5 mm', date: daysAgo(12), total: 60000, iva: 9600, category: 'Material de obra', workRef: 'OT-2026-089', uuid: 'C0DE0000-4444-4000-8000-00000000011F', confidence: 0.98, status: 'AUTORIZADO', adminOk: true, gerenciaOk: true },
      { unitId: torreon.id, source: 'SAT', supplier: 'Proveedor desconocido SA', description: 'CFDI recibido · "servicios" — RFC en lista 69-B', date: daysAgo(10), total: 18000, iva: 2880, category: 'Por clasificar', uuid: 'BAD00000-5555-4000-8000-000000000001', confidence: 0.3, warn: 'Posible factura apócrifa (69-B). Revisar.', status: 'PENDIENTE' }
    ]
  });

  // ---------- CxC ----------
  await prisma.invoice.createMany({
    data: [
      { unitId: torreon.id, clientName: 'LALA · Planta Torreón', folio: 'F-2026-212', amount: 325000, dueDate: daysAgo(13) },
      { unitId: torreon.id, clientName: 'OXXO · Región Laguna', folio: 'F-2026-219', amount: 96500, dueDate: daysAhead(7) },
      { unitId: torreon.id, clientName: 'Altozano · Casa club', folio: 'F-2026-220 (anticipo)', amount: 294000, dueDate: daysAhead(2) },
      { unitId: torreon.id, clientName: 'Edgar Yáñez', folio: 'Recibo', amount: 6864, dueDate: daysAgo(18) }
    ]
  });

  // ---------- Inventario ----------
  await prisma.inventoryItem.createMany({
    data: [
      { name: 'Acrílico fibratado 10 años 19 L', stock: 14, min: 20, unitName: 'cubeta', cost: 1050, provider: 'Kánuh (nacional)' },
      { name: 'Rollo SBS 4.5 mm gravilla blanca 10 m²', stock: 62, min: 40, unitName: 'rollo', cost: 1500, provider: 'Chovatek (nacional)' },
      { name: 'Primer asfáltico 19 L', stock: 3, min: 8, unitName: 'cubeta', cost: 1326, provider: 'Al-Koat' },
      { name: 'Cemento plástico asfáltico 19 L', stock: 9, min: 6, unitName: 'cubeta', cost: 980, provider: 'Nacional' },
      { name: 'Membrana de refuerzo 1.05×100 m', stock: 4, min: 4, unitName: 'rollo', cost: 1100, provider: 'Nacional' },
      { name: 'Poliurea 2 comp. 20 kg (A+B)', stock: 0, min: 6, unitName: 'juego', cost: 3200, provider: 'Importado' }
    ]
  });

  // ---------- Licitaciones ----------
  await prisma.tender.createMany({
    data: [
      { unitId: torreon.id, convener: 'IMSS · OOAD Coahuila', object: 'Mantenimiento de impermeabilización HGZ 16 y UMF 79', openingDate: daysAhead(6), match: 92 },
      { unitId: torreon.id, convener: 'Coahuila · SEDU', object: 'Techumbres en 6 planteles, Región Laguna', openingDate: daysAhead(12), match: 85 },
      { unitId: torreon.id, convener: 'Municipio de Torreón', object: 'Impermeabilización mercado Alianza', openingDate: daysAhead(15), match: 80 }
    ]
  });

  // ---------- Red de franquicias: ventas timbradas, regalías, fee ----------
  await prisma.franchise.createMany({
    data: [
      { name: 'Unidad Monterrey', city: 'Monterrey', contact: 'Licenciatario piloto', stage: 'PILOTO', investment: 450000, feasibility: 'Alta', fee: 450000, unitId: monterrey.id },
      { name: 'Unidad Querétaro', city: 'Querétaro', contact: 'Prospecto', stage: 'PROSPECTO', investment: 650000, feasibility: 'Alta' }
    ]
  });

  await prisma.sale.createMany({
    data: [
      { unitId: monterrey.id, description: 'Impermeabilización nave industrial · acrílico 10 años', amount: 154579.5, uuid: 'MON00000-6666-4000-8000-000000000001', folio: 'MTY-2026-011', customer: 'Parque Industrial Apodaca', date: daysAgo(12) },
      { unitId: monterrey.id, description: 'Mantenimiento losa comercial · SBS 4.5 mm', amount: 76670.5, uuid: 'MON00000-7777-4000-8000-000000000002', folio: 'MTY-2026-012', customer: 'Plaza Sendero', date: daysAgo(6) }
    ]
  });

  const salesTotal = 154579.5 + 76670.5; // 231,250
  await prisma.royaltyPeriod.create({
    data: { unitId: monterrey.id, period: '2026-10', salesTotal, royalty6: salesTotal * 0.06, marketing2: salesTotal * 0.02, total: salesTotal * 0.08, status: 'CALCULADA' }
  });
  await prisma.techFee.create({ data: { unitId: monterrey.id, period: '2026-10', amount: 2500, status: 'PENDIENTE' } });

  // ---------- Eventos de negocio + comisión 20% + bandeja de avisos ----------
  async function seedEvent(type: string, title: string, description: string, amount: number, unitId: string, sourceId: string | null, commission: boolean) {
    const event = await prisma.businessEvent.create({ data: { type, title, description, amount, unitId, sourceId } });
    if (commission) {
      await prisma.commissionEntry.create({ data: { eventId: event.id, baseAmount: amount, rate: 0.2, amount: Math.round(amount * 0.2 * 100) / 100, unitId } });
    }
    return event;
  }

  const evFranchise = await seedEvent(
    'FRANCHISE_ACQUIRED',
    'Franquicia adquirida · Monterrey',
    'Alta de la unidad piloto Monterrey. Cuota inicial $450,000. Comisión del desarrollador: $90,000 (20%).',
    450000,
    monterrey.id,
    null,
    true
  );
  await seedEvent(
    'ROYALTY_CALCULATED',
    'Regalía calculada · Monterrey · 2026-10',
    'Ventas timbradas $231,250 → regalía 6% ($13,875) + marketing 2% ($4,625) = $18,500. Comisión del desarrollador: $3,700 (20%).',
    18500,
    monterrey.id,
    null,
    true
  );
  await seedEvent(
    'TECH_FEE',
    'Fee tecnológico · Monterrey · 2026-10',
    'Fee tecnológico mensual de la unidad Monterrey: $2,500. Comisión del desarrollador: $500 (20%).',
    2500,
    monterrey.id,
    null,
    true
  );

  await prisma.notification.createMany({
    data: [
      { title: 'Franquicia adquirida · Monterrey', body: 'Alta de la unidad piloto Monterrey. Cuota inicial $450,000. Tu comisión: $90,000 (20%).', kind: 'FRANCHISE', eventId: evFranchise.id, read: false },
      { title: 'Regalía calculada · Monterrey · 2026-10', body: 'Ventas timbradas $231,250 → regalía 8% = $18,500. Tu comisión: $3,700 (20%).', kind: 'ROYALTY', read: false },
      { title: 'Documentos en bandeja', body: '2 CFDI listos para aprobar en lote y 2 con alerta (69-B y ticket sin RFC).', kind: 'SYSTEM', read: true }
    ]
  });

  await prisma.auditLog.createMany({
    data: [
      { userName: 'Administración', role: 'ADMIN', action: 'Ficha de costos guardada', ref: 'sbs45' },
      { userName: 'Administración', role: 'ADMIN', action: 'CFDI leído y deduplicado por UUID', ref: 'C0DE…11F' },
      { userName: 'Central', role: 'CENTRAL', action: 'Regalía calculada', ref: 'Monterrey 2026-10' }
    ]
  });

  console.log('Seed completo: unidades, usuarios, catálogo, quotes, OTs, docs, red y comisiones.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
