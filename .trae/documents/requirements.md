# App Viajes (PWA Offline-First) — Requisitos

## Objetivo
Registrar y gestionar logística y gastos de un viaje de 30 días (Japón y España) para dos usuarios, con funcionamiento 100% offline y sincronización en segundo plano con Supabase.

## Alcance
- PWA mobile-first.
- Módulos principales con navegación inferior: Calendario, Gastos, Itinerario, Hospedaje, Reportes.
- Multi-país y multi-moneda: Colombia (pre-viaje), España, Japón.
- Moneda base de reportes: COP.

## Usuarios
- Dos usuarios humanos (cuentas Supabase Auth) usando la misma app.
- En esta primera iteración, RLS permitirá lectura/escritura anónima temporal para acelerar el desarrollo.

## Funcionalidades

### Calendario (módulo principal)
- Muestra el lapso completo de 30 días.
- Interacción: tocar un día abre el resumen cronológico de esa fecha.
- El resumen responde:
  - Actividades del día.
  - Rutas activas (vuelos/trenes).
  - Hotel de la noche.
  - Lista exacta de gastos del día.

### Gastos
- Formulario rápido para registrar un gasto.
- Lista de movimientos por día.
- Categorías con color semántico consistente (iconos/listas/tarjetas/reportes).

### Itinerario
- Línea de tiempo vertical: vuelos, trenes, traslados.

### Hospedaje
- Tarjetas minimalistas por reserva.

### Reportes
- Filtro por país.
- Gráficos (dona) y balance vs presupuesto.
- Todas las sumas y reportes en COP.

## Offline-First
- Todas las escrituras se hacen primero en IndexedDB (Dexie).
- Al detectar red, sincronización en segundo plano:
  - Push: sube cambios locales pendientes.
  - Pull: trae cambios remotos.
- La UI debe funcionar sin red sin degradar funcionalidades críticas.

## Multi-moneda
- Entrada: EUR (España), JPY (Japón), COP (Colombia).
- Se guarda:
  - Monto y moneda original.
  - Tasa de cambio usada.
  - Equivalente en COP.

## Datos
- Categorías base con subcategorías y color.
- Entidades: categorias, gastos, itinerarios, hospedajes, presupuestos.

## No-objetivos (por ahora)
- Conciliación avanzada de conflictos multi-dispositivo.
- Adjuntos (fotos) y OCR.

