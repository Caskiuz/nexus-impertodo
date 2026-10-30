# IMPERTODO AI OS · by Nexus

Sistema operativo de impermeabilización para **Impertodo Torreón** y su red de franquicias. Recreado en Next.js a partir de los prototipos HTML (`IMPERTODO_AI_OS_FINAL`, `IMPERTODO_OS_MVP_V3_INTERACTIVO`, `proseal-os-v02`) con **backend real**: autenticación, base de datos y reglas de negocio operativas.

> Diseño visual fiel a `IMPERTODO_AI_OS_FINAL` (sidebar azul, topbar con comandos, wizard de cotización, semáforos de margen) y motor de negocio de `proseal-os-v02`.

## 🔑 Credenciales demo

| Usuario | Correo | Contraseña | Rol |
|---|---|---|---|
| Gerencia | `gerencia@impertodo.mx` | `impertodo2026` | GERENCIA |
| Administración | `admin@impertodo.mx` | `impertodo2026` | ADMIN |
| Supervisor | `supervisor@impertodo.mx` | `impertodo2026` | SUPERVISOR |
| Contador | `contador@impertodo.mx` | `impertodo2026` | CONTADOR |
| Central (red) | `central@impertodo.mx` | `impertodo2026` | CENTRAL |
| **Desarrollador** | `dev@nexus.mx` | **`nexus2026`** | DEV |

Propuesta pública demo: `/p/2026-042`

## ✅ Qué está implementado

- **Hoy** — KPIs, acciones priorizadas por reglas (cotizaciones sin respuesta, cobranza vencida, margen bajo piso, stock mínimo), ventana de aplicación y reglas de oro.
- **Cotizador (5 pasos)** — cliente → medición con **área desarrollada** → diagnóstico simulado → 2 opciones con `$/m²/año` → precio/margen/validaciones. Motor de costos real: material en unidades (cubeta/rollo/kg) con merma, destajo por acceso, consumibles, movilización, indirectos; **margen = (venta − costo) / venta** con semáforo vs. piso configurable. APU y validador anti-error de 9 comprobaciones.
- **Propuesta viva** — enlace público `/p/[folio]`, comparación de opciones, elección, aprobación del cliente (registra aperturas y eventos) y **plantilla oficial imprimible** (PDF por impresión del navegador).
- **Clientes & Techos** — kanban por etapas, cuentas con activos y m² bajo garantía, alta de prospectos.
- **Obra / OT** — la OT nace al aprobar la cotización (incluye reserva de material teórico), fases con evidencia, consumo teórico vs. real con merma, entrega con firma registrada y **garantía digital** (activo del cliente).
- **Inventario** — stock, mínimos, pedido propuesto, entradas/salidas; compra exclusiva PROSEALMASTER.
- **Caja / Contabilidad** — bandeja con **XML CFDI real** (parseo en servidor y **deduplicación por UUID**), captura manual, dos niveles de revisión (Administración → Gerencia), libro y utilidad por obra. La IA/reglas nunca contabilizan solas.
- **Cobrar** — CxC, vencidos, recordatorios (registro interno, sin envío real), cobro manual.
- **Aprobaciones** — cotizaciones y comprobantes con flujo de dos niveles y bloqueo si faltan costos documentados.
- **Captación** — estimador web que crea lead, radar de techos (secuencias demo), licitaciones con match y pre-llenado.
- **Catálogo / Precios** — parámetros globales (piso, indirectos, proveedor PSM −30%), tabla de márgenes y precio mínimo, **ficha de costos con evidencia** que desbloquea aprobaciones.
- **Agentes IA** — reglas deterministas sobre datos reales (sin llamadas a IA externas, costo $0) + bitácora de auditoría.
- **Franquicias** — unidades (Torreón matriz, Monterrey piloto, Querétaro prospecto), reglas de red (regalía **6% + 2% sobre ventas timbradas**, fee **$2,500/mes**, compra exclusiva PROSEALMASTER, nota COF/IMPI), alta y **adquisición de franquicia** con activación de unidad.
- **Central** — registro de ventas timbradas, cálculo de regalías (con delta para no duplicar), fees, pedidos de producto.
- **Comisión del 20% (panel DEV)** — libro mayor automático sobre **toda la red** (cuota de franquicia, regalías, fees y producto). Cada evento crea un asiento `DEVENGADA` y un aviso. El cobro se marca manualmente (sin pasarela).
- **Bandeja interna de notificaciones** — campana con contador + bandeja completa; cada venta/franquicia/regalía incluye el monto de tu comisión.
- **Experiencia tipo app (PWA)** — diseño responsive completo (móvil, tablet y escritorio), navegación inferior en celular, menú lateral deslizable, safe areas de iOS, manifest e iconos para instalar la app desde el navegador.

## 🧱 Stack

- **Next.js 15** (App Router) + TypeScript + React 19
- **Prisma ORM** — SQLite en local, **PostgreSQL (Neon)** en producción (switch automático por `DATABASE_URL`)
- **Auth.js v5** (credenciales, sesión JWT, roles)
- Zod para validación; SCSS-free, CSS propio con los tokens del diseño original
- Sin dependencias de pago: notificaciones internas por diseño (extensible a email/Telegram después)

## 🚀 Desarrollo local

```bash
npm install
npx prisma db push      # crea la base SQLite (prisma/dev.db)
npm run db:seed         # datos demo (catálogo, quotes, OTs, red, comisiones)
npm run dev             # http://localhost:3000
```

Variables en `.env`:
```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="cambia-esto-en-produccion"
AUTH_TRUST_HOST=true
```

## ☁️ Despliegue en Vercel (cuenta Caskiuz) con Neon

1. **Repositorio**: sube este repo a `https://github.com/Caskiuz/nexus-impertodo`.
2. **Neon**: el proyecto ya está vinculado en `neon.ts` + `.neon` (org/proyecto/rama `production`). Para provisionar/pull de variables: `neon deploy` (escribe `DATABASE_URL` pooled y `DATABASE_URL_UNPOOLED` directo en `.env`).
3. **Proyecto en Vercel**: *Add New Project* → importa `Caskiuz/nexus-impertodo`.
4. **Variables de entorno** del proyecto:
   - `DATABASE_URL` = conexión **pooled** de Neon (host con `-pooler`)
   - `DATABASE_URL_UNPOOLED` = conexión **directa** (sin `-pooler`) → la usan las migraciones
   - `AUTH_SECRET` = una cadena aleatoria larga (32+ caracteres)
   - `AUTH_TRUST_HOST` = `true`
5. **Deploy**. El build usa `vercel-build`: cambia el provider de Prisma a `postgresql`, genera el cliente, crea las tablas con la conexión **directa** (`scripts/db-push.mjs`) y **siembra los datos demo** en el primer deploy. No requiere pasos manuales.
6. Abre la URL del proyecto y entra con las credenciales demo. Cambia las contraseñas antes de darlo a un cliente real.

> `scripts/db-push.mjs` implementa la recomendación de Neon: **pooled para la app, directo para migraciones**. Si solo existe `DATABASE_URL`, se usa como respaldo.

> Nota: el script `scripts/set-provider.mjs` detecta automáticamente SQLite (`file:`) vs PostgreSQL (`postgres://`) para que el mismo repo funcione en local y en Vercel.

## 🔐 Seguridad y límites actuales

- Roles reales en servidor (Gerencia, Administración, Supervisor, Contador, Central, DEV); las server actions validan rol y unidad.
- Aislamiento por unidad (`unitId`) en los datos de negocio; Central/DEV pueden ver toda la red.
- `AuditLog` en las acciones sensibles.
- **Fuera de alcance de esta versión** (diseñado para fase 2): pasarela de pagos, timbrado/PAC, WhatsApp/email reales, OCR/visión IA real, SAT masivo, ERP contable. Los cobros y pagos se registran manualmente; el CFDI se carga como XML y se deduplica por UUID.

## 📁 Estructura

```
prisma/           schema.prisma + seed.ts (datos demo completos)
src/app/          rutas (login, dashboard, módulos, propuesta pública /p/[folio])
src/actions/      server actions (cotizaciones, documentos, propuesta pública)
src/components/   shell, wizard de cotización, propuesta, comandos, asistente
src/lib/          motor de cálculo, sesión/roles, eventos/comisión, prisma, constantes
scripts/          set-provider (sqlite ↔ postgres), sesión de prueba
```

## 📋 Documentación del plan

El plan aprobado y su estado están en [`PLAN.md`](./PLAN.md).
