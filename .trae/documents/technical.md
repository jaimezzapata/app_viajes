# App Viajes — Documentación Técnica

## Stack
- Frontend: React + Vite + TypeScript.
- Estilos: Tailwind CSS.
- Animaciones: Framer Motion.
- Estado: Zustand.
- Router: react-router-dom.
- PWA: vite-plugin-pwa (Service Worker para precache de UI).
- Offline DB: Dexie (IndexedDB).
- Backend: Supabase (Postgres) + Supabase Auth.

## Principios de arquitectura
- Offline-first: la fuente de verdad inmediata es Dexie.
- Sincronización eventual: Supabase como persistencia remota.
- Separación clara:
  - `src/db`: esquema Dexie y repositorios.
  - `src/sync`: motor de sincronización push/pull.
  - `src/pages`: pantallas.
  - `src/components`: UI reusable.
  - `src/stores`: estado global.

## Modelo de datos (alto nivel)
- `categorias`: catálogo con color semántico, jerarquía opcional.
- `gastos`: transacciones con moneda original y COP.
- `itinerarios`: eventos con rango horario y tipo (vuelo, tren, etc.).
- `hospedajes`: reservas con fechas y ubicación.
- `presupuestos`: presupuesto por país y categoría.

## Offline DB (Dexie)
- Tablas espejo del modelo + metadatos:
  - `outbox`: cola de operaciones pendientes.
  - `sync_state`: marcas de sincronización (watermarks por tabla).

## Sincronización
- Triggers:
  - Al volver online.
  - Manual (botón) en ajustes o reportes.
- Estrategia:
  - Push primero (para no perder cambios locales).
  - Pull después usando `updated_at` (o watermark) por tabla.
- Resolución de conflictos (MVP): last-write-wins por `updated_at`.

## Configuración Supabase
- Variables de entorno (frontend):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## PWA
- Precache de assets de UI.
- Cache runtime para fuentes e imágenes.
- Estrategia de actualización: `prompt` (UI puede mostrar banner de nueva versión).

