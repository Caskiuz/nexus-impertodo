import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { dateStr } from '@/lib/constants';
import { markNotificationReadAction, markAllNotificationsReadAction } from './actions';

const kindLabel: Record<string, { label: string; cls: string }> = {
  SALE: { label: 'Venta', cls: 'ok' },
  FRANCHISE: { label: 'Franquicia', cls: 'ok' },
  ROYALTY: { label: 'Regalía', cls: 'info' },
  FEE: { label: 'Fee', cls: 'info' },
  ORDER: { label: 'Pedido', cls: 'warn' },
  SYSTEM: { label: 'Sistema', cls: '' }
};

export default async function NotificacionesPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Bandeja interna · avisos del negocio</div>
          <h1>Notificaciones</h1>
          <div className="sub">
            Aquí se registra cada venta, adquisición de franquicia, regalía y fee con la comisión estimada del desarrollador.
          </div>
        </div>
        <div className="actions">
          <span className="badge warn">{unread} sin leer</span>
          <form action={markAllNotificationsReadAction}>
            <button className="btn sm" type="submit">
              Marcar todo como leído
            </button>
          </form>
        </div>
      </div>

      <div className="card panel">
        {notifications.map((n) => {
          const k = kindLabel[n.kind] || kindLabel.SYSTEM;
          return (
            <div className="rule" key={n.id} style={n.read ? {} : { background: 'var(--azul-50)', borderRadius: 8, paddingInline: 8 }}>
              <span className={`ic ${n.kind === 'FRANCHISE' || n.kind === 'SALE' ? 'ok' : n.kind === 'ORDER' ? 'warn' : 'info'}`}>•</span>
              <div style={{ flex: 1 }}>
                <b>{n.title}</b> <span className={`badge ${k.cls}`}>{k.label}</span>
                {!n.read && <span className="badge bad">Nuevo</span>}
                <div className="mini">{n.body}</div>
                <div className="mini">{n.createdAt.toLocaleString('es-MX')}</div>
              </div>
              {!n.read && (
                <form action={markNotificationReadAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button className="btn sm ghost" type="submit">
                    Leído
                  </button>
                </form>
              )}
            </div>
          );
        })}
        {!notifications.length && <div className="alert b">Sin avisos. Cuando ocurra una venta o franquicia aparecerá aquí.</div>}
      </div>

      <div className="card panel" style={{ marginTop: 14 }}>
        <div className="sec">Regla de visibilidad</div>
        <div className="rule">
          <span className="ic ok">✓</span>
          <div>Como desarrollador, cada evento de la red genera tu comisión 20% en el libro mayor y un aviso aquí.</div>
        </div>
        <div className="rule">
          <span className="ic info">i</span>
          <div>Canales externos (email/Telegram/WhatsApp) quedan deshabilitados por elección; la arquitectura permite añadirlos después sin rehacer el motor.</div>
        </div>
        <div className="mini">Usuario actual: {user.name} · rol {user.role} · {dateStr(new Date())}</div>
      </div>
    </>
  );
}
