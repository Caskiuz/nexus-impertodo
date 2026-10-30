import { prisma } from '@/lib/prisma';
import { fmt } from '@/lib/constants';

export type EventType =
  | 'SALE_TIMBRADA'
  | 'FRANCHISE_ACQUIRED'
  | 'FRANCHISE_OPENED'
  | 'ROYALTY_CALCULATED'
  | 'TECH_FEE'
  | 'PRODUCT_ORDER'
  | 'QUOTE_APPROVED'
  | 'DOC_AUTHORIZED';

const KIND_BY_TYPE: Record<string, string> = {
  SALE_TIMBRADA: 'SALE',
  FRANCHISE_ACQUIRED: 'FRANCHISE',
  FRANCHISE_OPENED: 'FRANCHISE',
  ROYALTY_CALCULATED: 'ROYALTY',
  TECH_FEE: 'FEE',
  PRODUCT_ORDER: 'ORDER',
  QUOTE_APPROVED: 'SYSTEM',
  DOC_AUTHORIZED: 'SYSTEM'
};

type CommissionConfigLike = {
  rate: number;
  onFranchiseFee: boolean;
  onRoyalties: boolean;
  onTechFee: boolean;
  onProduct: boolean;
};

/**
 * La comisión del desarrollador aplica a los ingresos de la red:
 * cuota de franquicia, regalías, fee tecnológico y producto a unidades.
 * Una venta timbrada NO se comisiona directo (genera regalía, que sí se comisiona)
 * para evitar doble conteo.
 */
function appliesToCommission(type: EventType, cfg: CommissionConfigLike): boolean {
  switch (type) {
    case 'FRANCHISE_ACQUIRED':
    case 'FRANCHISE_OPENED':
      return cfg.onFranchiseFee;
    case 'ROYALTY_CALCULATED':
      return cfg.onRoyalties;
    case 'TECH_FEE':
      return cfg.onTechFee;
    case 'PRODUCT_ORDER':
      return cfg.onProduct;
    default:
      return false;
  }
}

export interface BusinessEventInput {
  type: EventType;
  title: string;
  description: string;
  amount?: number;
  unitId?: string | null;
  sourceId?: string | null;
}

/**
 * Registra un evento de negocio inmutable, calcula la comisión del desarrollador
 * (20% configurable sobre toda la red) y deja el aviso en la bandeja interna.
 */
export async function recordBusinessEvent(input: BusinessEventInput) {
  const amount = input.amount ?? 0;
  const event = await prisma.businessEvent.create({
    data: {
      type: input.type,
      title: input.title,
      description: input.description,
      amount,
      unitId: input.unitId ?? null,
      sourceId: input.sourceId ?? null
    }
  });

  let cfg = await prisma.commissionConfig.findUnique({ where: { id: 'default' } });
  if (!cfg) {
    cfg = await prisma.commissionConfig.create({
      data: { id: 'default', rate: 0.2, onFranchiseFee: true, onRoyalties: true, onTechFee: true, onProduct: true }
    });
  }

  let commissionNote = '';
  if (amount > 0 && appliesToCommission(input.type, cfg)) {
    const commission = Math.round(amount * cfg.rate * 100) / 100;
    await prisma.commissionEntry.create({
      data: {
        eventId: event.id,
        baseAmount: amount,
        rate: cfg.rate,
        amount: commission,
        unitId: input.unitId ?? null
      }
    });
    commissionNote = ` · Tu comisión: ${fmt(commission)} (${Math.round(cfg.rate * 100)}%)`;
  }

  await prisma.notification.create({
    data: {
      title: input.title,
      body: input.description + commissionNote,
      kind: KIND_BY_TYPE[input.type] ?? 'SYSTEM',
      eventId: event.id
    }
  });

  return event;
}

export async function notify(title: string, body: string, kind = 'SYSTEM') {
  return prisma.notification.create({ data: { title, body, kind } });
}

export async function unreadCount(): Promise<number> {
  return prisma.notification.count({ where: { read: false } });
}
