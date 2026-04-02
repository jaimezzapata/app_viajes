# App Viajes — Documentación Funcional y Técnica

## Índice
- [Resumen](#resumen)
- [Alcance](#alcance)
- [Conceptos clave](#conceptos-clave)
- [Navegación (rutas)](#navegación-rutas)
- [Flujo general de uso](#flujo-general-de-uso)
- [Módulos y funcionalidades](#módulos-y-funcionalidades)
  - [Inicio (Home)](#inicio-home)
  - [Configuración del viaje](#configuración-del-viaje)
  - [Calendario](#calendario)
  - [Gastos](#gastos)
  - [Itinerario (Rutas/Trayectos)](#itinerario-rutastrayectos)
  - [Hospedaje](#hospedaje)
  - [Actividades](#actividades)
  - [Reportes](#reportes)
  - [Diagnóstico](#diagnóstico)
- [Formularios (campos de entrada)](#formularios-campos-de-entrada)
  - [Gasto (ExpenseModal)](#gasto-expensemodal)
  - [Trayecto (ItineraryModal)](#trayecto-itinerarymodal)
  - [Hospedaje (LodgingModal)](#hospedaje-lodgingmodal)
  - [Actividad (ActivityModal)](#actividad-activitymodal)
  - [Viaje/Países/Tramos (TripConfigModal)](#viajepaísestramos-tripconfigmodal)
- [Modelo de datos](#modelo-de-datos)
- [Offline-first y sincronización](#offline-first-y-sincronización)
- [Supabase (Auth, tablas, RLS)](#supabase-auth-tablas-rls)
- [Exportación, importación y backup](#exportación-importación-y-backup)
- [SQL y reset de datos](#sql-y-reset-de-datos)
- [Limitaciones y consideraciones](#limitaciones-y-consideraciones)

## Resumen
App Viajes es una aplicación web tipo PWA para planificar y registrar un viaje día a día:
- Calendario con agenda diaria (rutas, hotel, actividades y gastos).
- Registro de trayectos (aire/tierra/agua/a pie), hospedajes y actividades.
- Control financiero (gastos en diferentes monedas, conversión a COP, presupuestos y reportes).
- Funcionamiento **offline-first**: la app guarda todo localmente (IndexedDB) y sincroniza cuando hay conexión (Supabase).

Referencias clave del código:
- Rutas: [App.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/App.tsx)
- Modelos: [types.ts](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/shared/types.ts)
- DB local: [appDb.ts](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/db/appDb.ts)
- Sync: [sync.ts](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/sync/sync.ts)
- Supabase client: [client.ts](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/supabase/client.ts)

## Alcance
La app cubre:
- CRUD de viajes, configuración de países/segmentos (tramos), selección de día vigente.
- CRUD de entidades por viaje: gastos, itinerarios, hospedajes, actividades, presupuestos.
- Reportes operativos: totales, gasto por país/categoría, presupuesto vs gastado, top gastos, alertas.
- Backups (export/import JSON) por viaje.
- Diagnóstico de consistencia local (detecta problemas típicos de sincronización/datos).

No cubre (por diseño actual):
- Gestión multiusuario avanzada (roles/colaboración).
- Motor de mapas (polylines, rutas geográficas). “Rutas” son trayectos textuales.
- Reglas contables complejas (división de gastos, reembolsos, cuentas compartidas).

## Conceptos clave

### Viaje
Entidad maestra. Define:
- Nombre del viaje.
- Rango de fechas (`start_date` → `end_date`).
- Tipo: `is_national` (nacional) o internacional.
- Países/destinos del viaje y sus monedas.
- Tramos/segmentos del viaje (línea de tiempo por país/etapa).

### País/Etapa (stage)
Dentro de la app, `stage` representa el país (o ciudad si el viaje es nacional) y se usa como clave para agrupar información.

Convención:
- `countries_json` guarda un arreglo de objetos “TripCountry”.
- `segments_json` guarda un arreglo de objetos “TripSegment”.
- La función `stageForYmd(ymd, segments, fallback)` decide qué stage aplica a una fecha según los segmentos.

Referencia: [tripStore.ts](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/stores/tripStore.ts)

### Gasto “espejo”
Cuando registras una Ruta/Hospedaje/Actividad con costo, la app crea (o mantiene) un gasto vinculado, compartiendo el mismo `id`:
- `itinerarios.id == gastos.id`
- `hospedajes.id == gastos.id`
- `actividades.id == gastos.id`

Esto permite:
- Ver el impacto económico en Gastos/Reportes.
- Mantener un “origen” del gasto con contexto (ruta/hotel/actividad).

Regla UX actual:
- Los gastos espejo **se crean desde el módulo origen**.
- En Gastos, **no se permite crear** manualmente categorías que correspondan a orígenes (hospedaje/transporte/entretenimiento), pero sí puedes editar/eliminar el origen desde Gastos si el registro es espejo.

Referencias:
- Restricción de categorías en gastos: [ExpenseModal.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/components/ExpenseModal.tsx), [Expenses.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Expenses.tsx)
- Cascadas bidireccionales: [Expenses.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Expenses.tsx), [Itinerary.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Itinerary.tsx), [Lodging.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Lodging.tsx), [ActivityModal.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/components/ActivityModal.tsx)

## Navegación (rutas)
Definidas en [App.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/App.tsx).

- `/inicio` — Home (listado de viajes).
- `/calendario` — Calendario mensual + Agenda diaria.
- `/gastos` — Gastos (CRUD).
- `/itinerario` — Itinerario / rutas (CRUD).
- `/actividades` — Actividades (CRUD).
- `/hospedaje` — Hospedajes (CRUD).
- `/reportes` — Reportes + export/backup.
- `/diagnostico` — Diagnóstico de consistencia.

Atajos de edición desde Gastos:
- `/itinerario?edit=<id>`
- `/hospedaje?edit=<id>`
- `/actividades?edit=<id>`

## Flujo general de uso
1) **Crear viaje**
- En Home, “Crear Viaje Nuevo”.
- Se abre configuración inicial del viaje.

2) **Configurar viaje**
- Definir nombre, fechas, nacional/internacional.
- Cargar países (o destinos si es nacional) y moneda por país.
- Definir tramos (segmentos) para que el calendario pueda autoseleccionar el país por fecha.

3) **Registrar el día a día**
- Calendario: seleccionar un día.
- Itinerario: crear rutas (vuelos, tren, bus, etc.) y opcionalmente el costo (gasto espejo).
- Hospedaje: crear reservas y opcionalmente costo (gasto espejo).
- Actividades: crear actividades; la app mantiene un gasto espejo asociado.
- Gastos: registrar gastos manuales (comida, souvenirs, otros, etc.) y administrar gastos espejo desde su acceso.

4) **Ver reportes**
- Totales, gasto por país/categoría.
- Presupuesto vs gastado.
- Alertas y top de gastos.

5) **Sincronizar**
- La app guarda local y sube a Supabase cuando hay internet.
- Puedes forzar con el botón “Sincronizar”.

6) **Backup antes de cambios en Supabase**
- En Reportes: exportar un Backup (JSON) por viaje.
- Importar backup para reconstruir el viaje en caso de reset.

## Módulos y funcionalidades

### Inicio (Home)
Archivo: [Home.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Home.tsx)

- Lista todos los viajes (`db.viajes`) no eliminados.
- Separa los viajes en:
  - **Nacionales**
  - **Internacionales**
- Seleccionar un viaje fija `activeTripId` en el store y navega al calendario.

### Configuración del viaje
Archivo: [TripConfigModal.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/components/TripConfigModal.tsx)

Permite:
- Editar nombre, fechas, tipo de viaje.
- Configurar países/destinos:
  - `code` interno
  - `acronym` (CCA2 para bandera)
  - `currency`
- Configurar tramos (segmentos) con fechas.
- Eliminar viaje (y limpiar datos asociados en local + encolar deletes para sync).

Nota: existe normalización defensiva en el modal para evitar códigos vacíos/duplicados.

### Calendario
Archivo: [Calendar.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Calendar.tsx)

Incluye:
- Vista **Mes**: celdas por día con resumen y destacado del día actual del viaje.
- Vista **Agenda**: listado por día (cards desplegables).
- Detalle del día:
  - Filtros: Todo / Vuelos / Hotel / Actividades / Gastos.
  - Resumen por categoría (con icono).

Fuentes de datos:
- Gastos: `db.gastos` por `trip_id` + `date`.
- Rutas: `db.itinerarios` por `trip_id` + `date`.
- Hotel: `db.hospedajes` por rango (check-in/check-out) según implementación del resumen diario.
- Actividades: `db.actividades` por `trip_id` + `date`.

### Gastos
Archivo: [Expenses.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Expenses.tsx)

Permite:
- Crear/editar/borrar gastos manuales.
- Agrupar por país/etapa (stage).
- Mantener consistencia con gastos espejo:
  - Si editas/borras un gasto que es espejo de itinerario/hospedaje/actividad, se aplica cascada al origen.
  - UX: si es espejo, el modal bloquea campos sensibles y ofrece abrir el modal origen.

Categorías restringidas en creación manual de gastos:
- `HOSPEDAJE`
- `TRANSPORTE`
- `ENTRETENIMIENTO`

(Se crean desde sus respectivos módulos.)

### Itinerario (Rutas/Trayectos)
Archivo: [Itinerary.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Itinerary.tsx)

Permite:
- Crear trayectos por día y país.
- Tipos: vuelo, tren, bus, metro, a pie u otro.
- Campos adicionales en vuelos (aerolíneas, escalas) se guardan dentro de `notes` (serializado).
- Costo opcional: crea gasto espejo con categoría transporte (subkind por tipo y nacional/internacional).
- Eliminar trayecto elimina su gasto espejo (si existe).

### Hospedaje
Archivo: [Lodging.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Lodging.tsx)

Permite:
- Registrar hospedaje por país/ciudad, con check-in/check-out.
- Costo opcional: crea/actualiza gasto espejo.
- Eliminar hospedaje elimina su gasto espejo.

### Actividades
Archivo: [Activities.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Activities.tsx)

Permite:
- Registrar actividades por día con tipo (tour, museo, compras, etc.).
- Mantener gasto espejo asociado.
- Eliminar actividad elimina su gasto espejo.

### Reportes
Archivo: [Reports.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Reports.tsx)

Incluye:
- Totales en COP, restantes vs presupuesto global.
- “Gasto por país” (con banderas).
- “Presupuesto vs gastado”:
  - por país (presupuesto de país)
  - por categoría (presupuesto por categoría)
- “Gasto por categoría” (donut).
- “Alertas”:
  - presupuesto global excedido
  - países/categorías excedidos
  - posibles FX faltantes
- “Top 10 gastos”
- Exportaciones:
  - PDF ejecutivo
  - Excel consolidado
  - Backup JSON por viaje (export e import)
- Acceso a “Diagnóstico”.

### Diagnóstico
Archivo: [Diagnostics.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Diagnostics.tsx)

Pantalla para detectar inconsistencias típicas localmente:
- Países sin código o con código duplicado.
- Tramos solapados.
- Gastos con stage inválido.
- Gastos espejo sin origen (por categoría).
- Orígenes sin gasto espejo (puede ser válido si no hay costo).
- Registros fuera del rango del viaje.

Sirve para:
- Detectar fallas de sync.
- Identificar datos corruptos o incompletos antes de exportar/respaldar.

## Formularios (campos de entrada)

### Gasto (ExpenseModal)
Archivos:
- Estado del formulario: [expenses.ts](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/types/expenses.ts)
- UI: [ExpenseModal.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/components/ExpenseModal.tsx)

Campos:
- `date` (fecha del gasto, `YYYY-MM-DD`)
- `stageMode`:
  - `AUTO`: intenta determinar país por fecha y tramos
  - `MANUAL`: seleccionas el país manualmente
- `stage` (país/etapa)
- `categoryKind` (tipo macro: hospedaje/transporte/comida/entretenimiento/souvenires/otros)
- `categoryId` (subcategoría específica)
- `description` (texto libre)
- `currency` (moneda)
- `amountOriginal` (monto en moneda original)
- `fxRate` (tasa a COP)

Comportamiento:
- Para moneda COP, `fxRate` se mantiene en 1.
- Para monedas distintas, se intenta prellenar tasa FX por fecha (si hay conectividad/servicio disponible).
- Para gastos espejo, la UI bloquea los campos sensibles y sugiere editar desde el módulo origen.

### Trayecto (ItineraryModal)
Archivo: [ItineraryModal.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/components/ItineraryModal.tsx)

Campos:
- `date`
- `stage`
- `type`: `VUELO | TREN | BUS | METRO | A_PIE | OTRO`
- `title`
- `from_place`, `to_place`
- `start_time`, `end_time`
- Extra solo en vuelos:
  - `airlinesCsv`
  - `stopsCsv`
- `note`

Costo opcional (gasto espejo):
- `currency`, `amountOriginal`, `fxRate`
- En viaje nacional se simplifica el input a COP.

### Hospedaje (LodgingModal)
Archivo: [LodgingModal.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/components/LodgingModal.tsx)

Campos:
- `stage`
- `name` (nombre del lugar)
- `city`
- `check_in`, `check_out`
- `address`
- `note`

Costo opcional (gasto espejo):
- `currency`, `amountOriginal`, `fxRate`
- La tasa FX se intenta prellenar usando `check_in` como fecha de referencia.

### Actividad (ActivityModal)
Archivo: [ActivityModal.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/components/ActivityModal.tsx)

Campos:
- `date`
- `startTime`, `endTime`
- `stage`
- `type` (ej. museo, restaurante, tour, evento, compras, otro)
- `title`
- `location`
- `bookingRefs`
- `notes`

Comportamiento:
- Mantiene un gasto espejo asociado a la actividad (misma `id`) para reflejar costo en reportes.

### Viaje/Países/Tramos (TripConfigModal)
Archivo: [TripConfigModal.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/components/TripConfigModal.tsx)

Viaje:
- `name`
- `start_date`, `end_date`
- `is_national`

Países/destinos (`TripCountry`):
- `code` (clave interna)
- `acronym` (CCA2; se usa para bandera)
- `name`
- `currency`

Tramos (`TripSegment`):
- `fromStage`, `toStage`
- `startYmd`, `endYmd`

Validaciones/normalización recomendada:
- No permitir `code` vacío.
- Evitar códigos duplicados.
- Evitar tramos solapados.
- Mantener rangos dentro del viaje.

## Modelo de datos
Definiciones principales en [types.ts](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/shared/types.ts).

Entidades “core”:
- `viajes` (AppTrip)
- `categorias` (AppCategory)
- `gastos` (AppExpense)
- `itinerarios` (AppItinerary)
- `hospedajes` (AppLodging)
- `actividades` (AppActivity)
- `presupuestos` (AppBudget)

Tablas técnicas (local):
- `outbox` (cola de cambios a sincronizar)
- `sync_state` (estado de sync)
- `meta` (metadatos locales de la app)

## Offline-first y sincronización
Arquitectura offline-first:
- La fuente de verdad primaria es **IndexedDB** (Dexie).
- Supabase funciona como réplica en la nube por usuario.

DB local (Dexie): [appDb.ts](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/db/appDb.ts)

### Outbox
Cada operación del CRUD relevante encola un `OutboxItem` con:
- `table_name` (tabla destino)
- `op`: `UPSERT` o `DELETE`
- `entity_id` (id de la entidad)
- `payload` (para UPSERT)

### Sync (push/pull)
Implementación: [sync.ts](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/sync/sync.ts)

- **Push**: sube outbox a Supabase.
  - Deduplica por clave compuesta `table_name:entity_id` (evita perder cambios cuando hay entidades “espejo”).
  - Parchea `user_id` con `auth.uid()` si viene vacío.
  - Procesa por orden de tablas para reducir inconsistencias.
- **Pull**: baja cambios desde Supabase.
  - Se basa en `updated_at > last_sync_success_at`.
  - Filtra por `user_id = uid` (categorías permite `user_id is null` para categorías por defecto).

### Estado de sync
Se guarda en `sync_state`:
- `last_sync_attempt_at`
- `last_sync_success_at`
- `last_sync_error`

La UI dispara sync de forma automática cuando hay internet y hay pendientes, y también manualmente desde la app shell.
Referencia: [AppShell.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/components/AppShell.tsx)

## Supabase (Auth, tablas, RLS)

### ¿Dónde se guardan los usuarios?
Los usuarios registrados viven en el esquema de Auth, no en `public.*`:
- `auth.users`
- `auth.identities`

Consultas típicas:
```sql
select id, email, created_at, last_sign_in_at
from auth.users
order by created_at desc;
```

### Tablas del dominio
Tablas en `public` (ver migraciones):
- [reset_schema.sql](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/supabase/migrations/reset_schema.sql)
- [0001_init.sql](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/supabase/migrations/0001_init.sql)
- [0002_multi_trip_and_activities.sql](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/supabase/migrations/0002_multi_trip_and_activities.sql)

### RLS (Row Level Security)
La seguridad se basa en `user_id = auth.uid()` para aislar datos por usuario.
Archivo: [0003_secure_rls.sql](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/supabase/migrations/0003_secure_rls.sql)

Excepción: `categorias` permite lectura de:
- categorías del usuario (`user_id = auth.uid()`)
- categorías por defecto del sistema (`user_id IS NULL`)

## Exportación, importación y backup

### Exportes “ejecutivos”
Archivo: [export.ts](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/utils/export.ts)
- PDF ejecutivo
- Excel consolidado

### Backup por viaje (JSON)
Archivo: [tripBackup.ts](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/utils/tripBackup.ts)

Export:
- Crea un JSON versionado con:
  - viaje
  - categorías
  - gastos
  - itinerarios
  - hospedajes
  - actividades
  - presupuestos

Import:
- Crea un **nuevo viaje** (id nuevo) y reescribe `trip_id` en todas las entidades.
- Mantiene ids consistentes entre entidades relacionadas usando un mapeo de ids.
- Encola todo a outbox para que al sincronizar suba a Supabase.

UI de backup: [Reports.tsx](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/src/pages/Reports.tsx)

## SQL y reset de datos

### Reset de datos sin tocar estructura
Archivo: [reset_data_keep_schema.sql](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/supabase/reset_data_keep_schema.sql)

Uso recomendado:
1) Exportar backup JSON del viaje.
2) Ejecutar reset de datos (si aplica).
3) Importar backup para restaurar y luego sincronizar.

### Migraciones de estructura
Ver carpeta:
- [supabase/migrations](file:///c:/Users/Jaime%20Zapata/Documents/trae_projects/app_viajes/supabase/migrations/)

## Limitaciones y consideraciones
- **Git push no sube datos**: el repo solo contiene código. Los datos viven en:
  - local (IndexedDB) y/o
  - nube (Supabase) tras sincronizar.
- **Consistencia multi-dispositivo**: la app mantiene cascadas en el cliente. Para garantía total en servidor, se recomienda añadir triggers en Supabase (soft-delete en cascada) si se necesita.
- **Tasas FX**: la app intenta prellenar, pero si faltan o la tasa es inválida, Reportes muestra alertas de “FX posiblemente faltantes”.
- **Gastos espejo**: solo se reconocen por compartir `id` con el origen. Gastos manuales no deben intentar “crear” rutas/hotel/actividad sin metadatos.
- **Datos heredados**: si se resetearon tablas o hubo migraciones incompletas, pueden existir huérfanos (gasto sin itinerario/hospedaje/actividad). Revisa `/diagnostico`.

