'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import CommandBar from '@/components/CommandBar';
import Assistant from '@/components/Assistant';
import HelpModal from '@/components/HelpModal';
import { logoutAction, setActiveUnit } from '@/app/actions';

interface UnitOption {
  id: string;
  name: string;
  kind: string;
}

export default function AppShell({
  user,
  units,
  activeUnitId,
  unread,
  pendingApprovals,
  children
}: {
  user: { name: string; email: string; role: string };
  units: UnitOption[];
  activeUnitId: string | null;
  unread: number;
  pendingApprovals: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isCentral = ['CENTRAL', 'DEV', 'GERENCIA'].includes(user.role);

  const groups: { label: string; items: { href: string; icon: string; label: string; badge?: number; roles?: string[] }[] }[] = [
    { label: 'Diario', items: [{ href: '/hoy', icon: '📊', label: 'Hoy' }] },
    {
      label: 'Vender',
      items: [
        { href: '/cotizar', icon: '🧠', label: 'Cotizar', roles: ['ADMIN', 'GERENCIA', 'SUPERVISOR', 'CENTRAL', 'DEV'] },
        { href: '/clientes', icon: '👥', label: 'Clientes & Techos' },
        { href: '/propuesta', icon: '📱', label: 'Propuesta viva' },
        { href: '/captacion', icon: '📣', label: 'Marketing / Captación', roles: ['ADMIN', 'GERENCIA', 'CENTRAL', 'DEV'] }
      ]
    },
    {
      label: 'Operar',
      items: [
        { href: '/obra', icon: '🏗️', label: 'Obra / OT', roles: ['ADMIN', 'GERENCIA', 'SUPERVISOR', 'CENTRAL', 'DEV'] },
        { href: '/inventario', icon: '📦', label: 'Inventario', roles: ['ADMIN', 'GERENCIA', 'SUPERVISOR', 'CENTRAL', 'DEV'] }
      ]
    },
    {
      label: 'Dinero',
      items: [
        { href: '/caja', icon: '🧾', label: 'Caja / Contabilidad', roles: ['ADMIN', 'GERENCIA', 'CONTADOR', 'CENTRAL', 'DEV'] },
        { href: '/cobrar', icon: '💵', label: 'Cobrar', roles: ['ADMIN', 'GERENCIA', 'CONTADOR', 'CENTRAL', 'DEV'] },
        { href: '/aprobaciones', icon: '✅', label: 'Aprobaciones', badge: pendingApprovals, roles: ['ADMIN', 'GERENCIA', 'CONTADOR', 'CENTRAL', 'DEV'] }
      ]
    },
    {
      label: 'Crecer',
      items: [
        { href: '/licitaciones', icon: '🏛️', label: 'Licitaciones', roles: ['ADMIN', 'GERENCIA', 'CENTRAL', 'DEV'] },
        { href: '/franquicias', icon: '🌐', label: 'Franquicias', roles: ['ADMIN', 'GERENCIA', 'CENTRAL', 'DEV'] }
      ]
    },
    {
      label: 'Control',
      items: [
        { href: '/catalogo', icon: '⚙️', label: 'Catálogo / Precios', roles: ['ADMIN', 'GERENCIA', 'CENTRAL', 'DEV'] },
        { href: '/agentes', icon: '🤖', label: 'Agentes IA', roles: ['ADMIN', 'GERENCIA', 'CENTRAL', 'DEV'] }
      ]
    },
    {
      label: 'Red',
      items: [
        { href: '/central', icon: '🏢', label: 'Central (red)', roles: ['ADMIN', 'GERENCIA', 'CENTRAL', 'DEV'] },
        { href: '/notificaciones', icon: '🔔', label: 'Notificaciones', badge: unread, roles: ['GERENCIA', 'CENTRAL', 'DEV'] },
        { href: '/comisiones', icon: '💠', label: 'Mi comisión 20%', roles: ['DEV'] }
      ]
    }
  ];

  const activeUnit = units.find((u) => u.id === activeUnitId);

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`} id="sidebar">
        <div className="brand">
          <div className="logo">
            <div className="mark">I</div>
            <div>
              <div className="name">IMPERTODO AI OS</div>
              <div className="sub">PROSEALMASTER · by Nexus</div>
            </div>
          </div>
        </div>
        <nav className="nav">
          {groups.map((g) => {
            const items = g.items.filter((i) => !i.roles || i.roles.includes(user.role));
            if (!items.length) return null;
            return (
              <div key={g.label}>
                <div className="grp">{g.label}</div>
                {items.map((i) => (
                  <Link key={i.href} href={i.href} className={pathname === i.href ? 'on' : ''} onClick={() => setOpen(false)}>
                    <span className="ic">{i.icon}</span>
                    {i.label}
                    {typeof i.badge === 'number' && i.badge > 0 && <span className="badge">{i.badge}</span>}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidefoot">v3 · datos demo · {activeUnit?.name || 'Todas las unidades'}</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="burger" onClick={() => setOpen((v) => !v)} aria-label="Menú">
            ☰
          </button>
          <CommandBar />
          {isCentral ? (
            <form action={setActiveUnit} className="seg">
              <select name="unit" defaultValue={activeUnitId || ''} onChange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Unidad">
                <option value="">Todas las unidades</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.kind}
                  </option>
                ))}
              </select>
            </form>
          ) : (
            <div className="seg">
              <span style={{ padding: '6px 11px', fontSize: 12, fontWeight: 600, color: 'var(--gris)' }}>{activeUnit?.name}</span>
            </div>
          )}
          <div className="seg hide-m">
            <span style={{ padding: '6px 11px', fontSize: 12, fontWeight: 600, color: 'var(--gris)' }}>
              {roleLabel(user.role)}
            </span>
          </div>
          <Link href="/notificaciones" className="bell" title="Bandeja de avisos">
            🔔{unread > 0 && <span className="cnt">{unread}</span>}
          </Link>
          <HelpModal />
          <div className="who">
            <b>{user.name}</b>
            {user.email}
          </div>
          <form action={logoutAction}>
            <button className="btn sm ghost" type="submit" title="Salir">
              Salir
            </button>
          </form>
        </header>
        <div className="content">{children}</div>
      </div>
      <Assistant />
    </div>
  );
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    GERENCIA: 'Gerencia',
    ADMIN: 'Administración',
    SUPERVISOR: 'Supervisor',
    CONTADOR: 'Contador',
    CENTRAL: 'Central',
    DEV: 'Dev'
  };
  return map[role] || role;
}
