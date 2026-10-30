# PLAN PROFESIONAL — IMPERTODO AI OS en Next.js + Red de Franquicias + Comisión 20% (Vercel)

## 1. Alcance
Recrear TODO el sistema Impertodo mostrado en los 3 HTMLs con backend real (base de datos, autenticación, persistencia), usando el diseño visual de **IMPERTODO_AI_OS_FINAL** y el motor de negocio más completo (proseal-os-v02) más las reglas de aprobación/auditoría de MVP_V3. Desplegar en Vercel para que el cliente lo pruebe. La **red de franquicias es el corazón**: multi-tenancy real, regalías, fee tecnológico, pedidos exclusivos, motor de comisión 20% del desarrollador y bandeja interna de avisos por cada venta o adquisición de franquicia.

## 2. Stack tecnológico
- **Next.js 15 (App Router) + TypeScript**, CSS con los tokens del diseño final.
- **Prisma + PostgreSQL (Neon Serverless)** — SQLite en desarrollo, Postgres en Vercel (switch automático).
- **Auth.js v5** con credenciales y roles reales (Gerencia, Administración, Supervisor, Contador, Central, Dev).
- Zod para validación; PDF de propuesta por plantilla imprimible oficial.
- Notificaciones: **solo bandeja interna** (campana + contador + lista de eventos), tras una interfaz extensible a email/Telegram/WhatsApp.

## 3. Sistema de diseño (fiel al HTML favorito)
Sidebar 244px degradado `#122a40→#0f2438` con grupos (Diario/Vender/Operar/Dinero/Crecer/Control/Red), topbar con barra de comandos (🎙), selector de unidad, paleta azul `#1F4E79`, verde `#2E7D32`, amarillo `#F4B81E`, naranja, rojo, fondo `#eef1f6`, radio 13px; KPIs en grid, kanban, wizard con resumen sticky, semáforo de margen, badges/alertas/toasts, modal de onboarding, asistente flotante. Responsive 1100px/760px.

## 4. Arquitectura y multi-tenancy
- Monolito modular: `src/app/(app)/*` por módulo + `src/actions/*` (server actions) + `src/lib/*` (motor, sesión, eventos, prisma).
- **Tenant = Unidad**. `unitId` en tablas de negocio; Central/DEV/Gerencia ven toda la red y pueden filtrar por unidad (cookie); cada unidad ve su instancia.
- Roles verificados en servidor + `AuditLog` en escrituras sensibles.

## 5. Modelo de datos (Prisma)
`Unit`, `User`, `System` (9 sistemas reales), `CostSheet`, `Client`, `Asset`, `Lead`, `Quote`, `QuoteExtra`, `QuoteEvent`, `OT`, `OTPhoto`, `InventoryItem`, `StockMovement`, `Doc` (UUID único), `Invoice`, `Tender`, `Sale`, `RoyaltyPeriod`, `TechFee`, `ProductOrder`, `Franchise`, `BusinessEvent`, `CommissionConfig`, `CommissionEntry`, `Notification`, `AuditLog`, `Settings`.

## 6. Módulos funcionales
Hoy · Cotizar (5 pasos, motor idéntico a los HTMLs: área desarrollada = planta + pretil·altura + perímetro·0.15 + bajantes·0.5 + domos·1.2 + ductos·0.4; costo por empaque con merma, destajo por acceso, consumibles, viáticos, indirectos; margen `(subtotal−costo)/subtotal` vs piso; IVA 16%; APU; validador) · Propuesta viva pública con PDF oficial · Clientes & Techos · Obra/OT con fases, consumo y garantía digital · Inventario · Caja/CFDI con dedup UUID y doble aprobación · Cobrar · Aprobaciones · Captación · Catálogo/márgenes con ficha de costos documentada · Agentes IA (reglas reales, costo $0) · Franquicias · Central · Comisión 20% · Bandeja de notificaciones.

## 7. Red de franquicias + comisión del desarrollador
- Reglas aplicadas: regalía **6% + 2% sobre ventas timbradas**, fee **$2,500/mes**, compra exclusiva **PROSEALMASTER** (precio de compra; landed oculto) y nota legal COF/IMPI (LFPPI 245–250).
- Cada venta/adquisición/regalía/fee/pedido genera un `BusinessEvent` inmutable; el motor calcula el **20%** (tasa configurable) y crea `CommissionEntry` + aviso en la bandeja interna.
- Las ventas timbradas **no** se comisionan dos veces: alimentan la regalía, y la regalía sí se comisiona (solo el delta al recalcular).
- Panel **Mi comisión 20%** (solo DEV): devengado, cobrado, pendiente, por unidad y libro por evento con cobro manual.

## 8. Datos semilla
Catálogo completo con precios reales 2025–2026, unidades Torreón/Monterrey/Querétaro, clientes demo (Consulta Externa, OXXO, IMSS, LALA, Altozano, Edgar Yáñez), cotizaciones 2026-041/042/2025-118, OTs 088–090, CFDI, CxC, inventario, licitaciones, regalía Monterrey 2026-10 ($18,500) y eventos/comisiones iniciales ($94,200 devengados).

## 9. Despliegue en Vercel
Neon Postgres + `vercel-build` (switch a Postgres, `prisma db push`, seed idempotente, build). Variables `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`. Preview por rama. Ver `README.md`.

## 10. Estado de implementación
- [x] F0 Fundación: scaffold, diseño, auth, seed.
- [x] F1 Núcleo comercial (cotizador, propuesta, CRM, catálogo).
- [x] F2 Operación (OT, inventario, caja/CFDI, cobrar, aprobaciones).
- [x] F3 Crecimiento (captación, licitaciones, agentes, comandos, asistente).
- [x] F4 Red y comisión (franquicias, central, comisión 20%, notificaciones, panel DEV).
- [ ] F5 Deploy: requiere conectar Neon y publicar desde la cuenta Vercel del cliente (documentado).

## 11. Fuera de alcance (fase 2)
Pasarela de pagos, PAC/timbrado, WhatsApp/email reales, OCR/visión IA real, ERP contable, SAT masivo, asesoría legal COF/IMPI.

## 12. Criterios de aceptación verificados
- Login por roles con permisos reales ✅
- Cotización end-to-end con cálculos idénticos a los HTMLs ($257,631 / $501,543) y folio automático ✅
- Propuesta pública abre, el cliente elige y aprueba; cada apertura se registra ✅
- Revisión Administración + autorización Gerencia generan OT y reserva de material ✅
- CFDI con UUID duplicado se bloquea (acción real en Caja) ✅
- Adquisición de franquicia activa la unidad y devenga comisión 20% ✅
- Venta timbrada + regalía 6%+2% devenga comisión del delta sin duplicar ✅
- Panel DEV muestra libro de comisiones y bandeja de avisos con campana ✅
