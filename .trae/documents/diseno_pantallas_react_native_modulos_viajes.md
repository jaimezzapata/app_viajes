# Diseño de pantallas (React Native, desktop-first adaptado a móvil)
Nota: en mobile “desktop-first” se interpreta como **priorizar layouts amplios/tablet** y luego compactar a teléfono.

## Estilos globales
- Layout: Flexbox como base; grids con `FlatList` + `numColumns` (tablet) y una columna (teléfono).
- Breakpoints sugeridos: teléfono (<768dp), tablet (>=768dp).
- Tokens:
  - Background: #0B1220 (oscuro) o #FFFFFF (claro) según tema; default claro.
  - Primary: #2563EB; Accent: #22C55E; Danger: #EF4444.
  - Tipografía: escala 12/14/16/20/24; títulos semibold.
  - Botones: primario (filled), secundario (outline), estado disabled con 40% opacity.
  - Links: color primary, underline solo en pressed.
  - Cards: borde 1px #E5E7EB, radio 12, sombra suave en iOS/Android.
- Estados:
  - Offline banner persistente cuando no hay red.
  - Sync badge: "Sincronizado", "Pendiente", "Error".
- Transiciones: navegación nativa; microtransiciones 150–200ms en pressed/expand.

---

## Pantalla: Acceso (/auth)
### Layout
- Flexbox vertical centrado; en tablet usar card centrada (maxWidth 420dp).

### Meta Information (equivalente app)
- Título de pantalla: "Acceso"
- Descripción interna: "Inicia sesión para sincronizar tus viajes"

### Estructura
1. Header: logo/nombre de app.
2. Form:
   - Email
   - Contraseña
   - Botón "Entrar"
3. Acciones secundarias:
   - "Crear cuenta"
   - "Olvidé mi contraseña"
4. Estado:
   - Indicador de cargando
   - Mensajes de error (credenciales/red)

### Interacciones
- Si hay sesión válida en caché: redirigir a Mis viajes.
- Si no hay red y no hay sesión: mostrar aviso y deshabilitar login.

---

## Pantalla: Mis viajes (/trips)
### Layout
- AppShell: top bar + contenido.
- Contenido: lista en tarjetas; en tablet 2 columnas.

### Meta Information
- Título: "Mis viajes"
- Descripción: "Gestiona tus viajes sin conexión"

### Secciones & Componentes
1. Top bar
   - Título
   - Botón "Sincronizar" (icono + texto)
   - Indicador: última sync (fecha/hora) + estado
2. Banner offline (condicional)
   - Texto: "Estás sin conexión. Se guardará localmente."
3. Lista de viajes
   - Card de viaje: nombre, rango de fechas, moneda, badge de sync (pendiente/error)
   - Acción: tap abre detalle
4. FAB / botón primario
   - "Nuevo viaje"
5. Modal "Nuevo viaje"
   - Nombre, fechas, moneda
   - Guardar (crea local + outbox)

### Interacciones
- Pull-to-refresh: refresca desde local; si hay red, dispara sync pull.
- Sync manual: ejecuta push (outbox) y luego pull.

---

## Pantalla: Detalle de viaje (/trips/:tripId)
### Layout
- Contenedor con tabs superiores (tablet) o tabs inferiores (teléfono).
- Header fijo con nombre de viaje + estado de sync.

### Meta Information
- Título: "Detalle del viaje"
- Descripción: "Planificación y control"

### Componentes globales dentro del viaje
1. Header
   - Back
   - Nombre del viaje
   - Estado: "Pendiente" / "Sincronizado" / "Error"
2. Tab bar
   - Calendario
   - Itinerario
   - Hospedaje
   - Gastos
   - Reportes

---

## Tab: Calendario (/calendar)
### Layout
- Tablet: vista mes + panel lateral de eventos del día.
- Teléfono: vista agenda por día/semana.

### Secciones & Componentes
1. Selector de rango (mes/semana/día)
2. Lista de eventos
   - Item: hora, título, notas (1–2 líneas)
3. Acción "Nuevo evento"
   - Modal: título, fecha/hora inicio-fin, notas
4. Edición
   - Tap abre detalle rápido; opciones editar/eliminar

### Offline + Sync
- Al crear/editar: guardar en SQLite + outbox; badge "Pendiente" en item.

---

## Tab: Itinerario (/itinerary)
### Layout
- Lista reordenable (drag & drop).
- Agrupación por día (acordeón) en tablet; en teléfono un día a la vez.

### Secciones & Componentes
1. Selector de día
2. Lista de items
   - Checkbox "Hecho"
   - Título, hora (texto), ubicación (texto)
3. Acción "Agregar item"
   - Modal: título, hora, ubicación, notas

---

## Tab: Hospedaje (/lodging)
### Layout
- Cards; en tablet dos columnas.

### Secciones & Componentes
1. Lista de estancias
   - Card: nombre, check-in/out, dirección (1 línea)
   - Badge: adjunto pendiente / subido
2. Acción "Agregar hospedaje"
   - Form: nombre, dirección, check-in/out, notas
   - Adjuntar comprobante (archivo/foto)

### Offline + Sync
- Adjuntos: guardar ruta local; en sync subir a Supabase Storage y actualizar `receipt_object_path`.

---

## Tab: Gastos (/expenses)
### Layout
- Resumen arriba + lista debajo.
- Tablet: resumen en cards (por categoría) + tabla/lista.

### Secciones & Componentes
1. Resumen
   - Total del viaje (moneda)
   - Totales por categoría (top 3)
2. Filtros
   - Día, categoría
3. Lista de gastos
   - Item: monto, categoría, fecha, nota corta
4. Acción "Nuevo gasto"
   - Modal: monto, moneda, categoría, fecha, notas

---

## Tab: Reportes (/reports)
### Layout
- Secciones apiladas; en tablet 2 columnas.

### Secciones & Componentes
1. Reporte de gastos
   - Totales por categoría/día
   - Selector de rango de fechas
2. Vista de planificación
   - Conteo de eventos/itinerario por día
3. Exportar/Compartir
   - Botón "Exportar CSV"
   - Botón "Generar PDF"

### Interacciones
- Exportación usa datos locales (no requiere red). Si hay red, opcionalmente refresca antes de exportar.
