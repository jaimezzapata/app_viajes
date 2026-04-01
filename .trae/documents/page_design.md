# App Viajes — Diseño de Pantallas (Mobile-First)

## Navegación
- Bottom navigation con 5 tabs:
  - Calendario
  - Gastos
  - Itinerario
  - Hospedaje
  - Reportes

## Estilo
- Minimalista, alto contraste moderado.
- Jerarquía tipográfica limitada.
- Color semántico por categoría (tokens reutilizables).

## Calendario (principal)
- Vista tipo agenda vertical de 30 días.
- Cada día:
  - Header con fecha (sticky o muy visible).
  - Secciones compactas:
    - Actividades
    - Rutas
    - Hotel
    - Gastos (lista con chips de categoría y monto)
- Interacción:
  - Tap en día para expandir detalle.
  - Animaciones suaves al expandir/colapsar.

## Gastos
- Form rápido en modal o sheet:
  - Fecha (por defecto hoy)
  - País / moneda
  - Categoría / subcategoría
  - Descripción
  - Monto original y tasa de cambio
  - Monto en COP calculado
- Lista:
  - Agrupada por día.

## Itinerario
- Timeline vertical con cards (tipo, hora, origen/destino, notas).

## Hospedaje
- Cards por reserva con:
  - Nombre
  - Ciudad/País
  - Check-in / Check-out
  - Dirección y notas

## Reportes
- Selector de país.
- Dona por categorías.
- Resumen:
  - Total gastado COP
  - Presupuesto COP
  - Diferencia

