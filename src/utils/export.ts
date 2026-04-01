import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { db } from '@/db/appDb'
import type { AppActivity, AppBudget, AppCategory, AppExpense, AppItinerary, CountryStage, CategoryKind } from '@/../shared/types'
import { CATEGORY_KIND_LABEL } from '@/utils/categoryPalette'
import { parseItineraryNotes } from '@/itinerary/notes'
import { toYmd } from '@/utils/date'

interface TripExportData {
  tripId: string
  countries: Array<{ code: string; name: string; currency: string }>
}

/** Configuración de colores corporativos del Excel */
const C_BRAND = '0ea5e9' // sky-500
const C_BRAND_DARK = '0369a1' // sky-700
const C_HEADER_BG = '1e293b' // slate-800
const C_HEADER_TXT = 'f8fafc' // slate-50
const C_CELL_BG_ALT = 'f8fafc' // slate-50
const C_DANGER = 'ef4444' // red-500
const C_SUCCESS = '22c55e' // green-500

/** Progress bar en texto ASCII para gráficos dentro de celda */
function getProgressBar(pct: number, length = 15): string {
  const filled = Math.round(pct * length)
  const empty = length - filled
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty))
}

function getReportDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function exportConsolidatedExcel(data: TripExportData) {
  const { tripId, countries } = data

  const [gastos, categorias, presupuestos, actividades, itinerarios, trip] = await Promise.all([
    db.gastos.where('trip_id').equals(tripId).filter((e) => e.deleted_at == null).toArray(),
    db.categorias.filter((c) => c.deleted_at == null).toArray(),
    db.presupuestos.where('trip_id').equals(tripId).filter((b) => b.deleted_at == null && b.stage === 'GLOBAL').toArray(),
    db.actividades.where('trip_id').equals(tripId).filter((a) => a.deleted_at == null).toArray(),
    db.itinerarios.where('trip_id').equals(tripId).filter((i) => i.deleted_at == null).toArray(),
    db.viajes.get(tripId)
  ])

  const tripName = trip?.name || 'Viaje'
  const safeTripName = tripName.replace(/[^a-z0-9]/gi, '_').toLowerCase()

  const categoryById = new Map<string, AppCategory>(categorias.map(c => [c.id, c]))
  const stageNameByCode = new Map<string, string>(countries.map(c => [c.code, c.name]))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'App Viajes'
  wb.created = new Date()

  // --------------------------------------------------------
  // HOJA 1: DASHBOARD EJECUTIVO
  // --------------------------------------------------------
  const wsResumen = wb.addWorksheet('📊 Dashboard Ejecutivo', { views: [{ showGridLines: false }] })
  
  // Ajuste general de ancho de columnas
  wsResumen.columns = [
    { width: 5 },  // A: Margen
    { width: 35 }, // B: Categoria / Titulo
    { width: 25 }, // C: Valores
    { width: 20 }, // D: Graficas
    { width: 5 }   // E: Margen
  ]

  // Título Principal
  wsResumen.mergeCells('B2:D3')
  const tCell = wsResumen.getCell('B2')
  tCell.value = `✈️ REPORTE FINANCIERO: ${tripName.toUpperCase()}`
  tCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_BRAND_DARK } }
  tCell.alignment = { vertical: 'middle', horizontal: 'center' }
  tCell.border = { top: { style: 'thick', color: { argb: C_BRAND_DARK } }, bottom: { style: 'thick', color: { argb: '000000' } } }

  const budgetTotal = presupuestos[0]?.amount_cop ?? 0
  const spentTotal = gastos.reduce((acc, e) => acc + (e.amount_cop ?? 0), 0)
  const remainingTotal = Math.max(0, budgetTotal - spentTotal)
  const pctGastado = budgetTotal > 0 ? Math.min(1, spentTotal / budgetTotal) : 0

  // Tarjetas KPI (KPI Cards simualdas)
  wsResumen.mergeCells('B5:D5')
  const subTitle = wsResumen.getCell('B5')
  subTitle.value = 'RESUMEN GLOBAL'
  subTitle.font = { size: 14, bold: true, color: { argb: C_HEADER_TXT } }
  subTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_HEADER_BG } }
  subTitle.alignment = { vertical: 'middle', horizontal: 'center' }

  const kpis = [
    { label: '💰 Presupuesto Asignado', val: budgetTotal, color: 'FF334155' },
    { label: '🔥 Total Gastado', val: spentTotal, color: 'FF' + C_DANGER },
    { label: '✅ Saldo Disponible', val: remainingTotal, color: 'FF' + C_SUCCESS }
  ]

  let rIdx = 6
  for (const k of kpis) {
    const row = wsResumen.getRow(rIdx)
    row.height = 25
    wsResumen.getCell(`B${rIdx}`).value = k.label
    wsResumen.getCell(`B${rIdx}`).font = { bold: true, size: 12 }
    wsResumen.getCell(`B${rIdx}`).alignment = { vertical: 'middle' }

    wsResumen.getCell(`C${rIdx}`).value = k.val
    wsResumen.getCell(`C${rIdx}`).numFmt = '"$"#,##0'
    wsResumen.getCell(`C${rIdx}`).font = { bold: true, size: 12, color: { argb: k.color } }
    wsResumen.getCell(`C${rIdx}`).alignment = { vertical: 'middle', horizontal: 'right' }
    
    // Borde inferior sutil
    const borderObj = { bottom: { style: 'thin' as any, color: { argb: 'FFCBD5E1' } } }
    wsResumen.getCell(`B${rIdx}`).border = borderObj
    wsResumen.getCell(`C${rIdx}`).border = borderObj
    wsResumen.getCell(`D${rIdx}`).border = borderObj
    
    rIdx++
  }

  // Barra de progreso de consumo
  rIdx++
  wsResumen.mergeCells(`B${rIdx}:D${rIdx}`)
  const barCell = wsResumen.getCell(`B${rIdx}`)
  barCell.value = `Consumo: ${(pctGastado * 100).toFixed(1)}%   ${getProgressBar(pctGastado, 20)}`
  barCell.font = { size: 12, bold: true, color: { argb: pctGastado > 0.9 ? ('FF' + C_DANGER) : ('FF' + C_BRAND) } }
  barCell.alignment = { horizontal: 'center' }
  
  // Tabla de Gastos por Categoría
  rIdx += 2
  wsResumen.mergeCells(`B${rIdx}:D${rIdx}`)
  const catTitle = wsResumen.getCell(`B${rIdx}`)
  catTitle.value = 'DESGLOSE POR CATEGORÍA'
  catTitle.font = { size: 14, bold: true, color: { argb: C_HEADER_TXT } }
  catTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_HEADER_BG } }
  catTitle.alignment = { vertical: 'middle', horizontal: 'center' }

  const spentByKind = new Map<CategoryKind, number>()
  for (const e of gastos) {
    const cat = categoryById.get(e.category_id)
    if (!cat) continue
    spentByKind.set(cat.kind, (spentByKind.get(cat.kind) ?? 0) + e.amount_cop)
  }

  rIdx++
  wsResumen.getCell(`B${rIdx}`).value = 'Categoría'
  wsResumen.getCell(`C${rIdx}`).value = 'Monto (COP)'
  wsResumen.getCell(`D${rIdx}`).value = 'Proporción'
  wsResumen.getRow(rIdx).font = { bold: true }
  wsResumen.getRow(rIdx).border = { bottom: { style: 'thick', color: { argb: 'FF94A3B8' } } }

  rIdx++
  // Ordenar de mayor a menor
  const sortedKinds = Array.from(spentByKind.entries()).sort((a,b) => b[1] - a[1])
  
  for (const [kind, total] of sortedKinds) {
    const row = wsResumen.getRow(rIdx)
    row.height = 20
    
    wsResumen.getCell(`B${rIdx}`).value = CATEGORY_KIND_LABEL[kind]
    
    wsResumen.getCell(`C${rIdx}`).value = total
    wsResumen.getCell(`C${rIdx}`).numFmt = '"$"#,##0'
    wsResumen.getCell(`C${rIdx}`).font = { color: { argb: 'FF475569' }, bold: true }
    
    const prop = spentTotal > 0 ? (total / spentTotal) : 0
    wsResumen.getCell(`D${rIdx}`).value = getProgressBar(prop, 10) + ` ${(prop*100).toFixed(0)}%`
    wsResumen.getCell(`D${rIdx}`).font = { color: { argb: 'FF94A3B8' } }
    
    // Bordes sutiles
    const borderObj = { bottom: { style: 'hair' as any, color: { argb: 'FFE2E8F0' } } }
    wsResumen.getCell(`B${rIdx}`).border = borderObj
    wsResumen.getCell(`C${rIdx}`).border = borderObj
    wsResumen.getCell(`D${rIdx}`).border = borderObj

    rIdx++
  }

  // Tabla de Gastos por País / Etapa
  rIdx += 2
  wsResumen.mergeCells(`B${rIdx}:D${rIdx}`)
  const stageTitle = wsResumen.getCell(`B${rIdx}`)
  stageTitle.value = 'DESGLOSE POR PAÍS / ETAPA'
  stageTitle.font = { size: 14, bold: true, color: { argb: C_HEADER_TXT } }
  stageTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_HEADER_BG } }
  stageTitle.alignment = { vertical: 'middle', horizontal: 'center' }

  const spentByStage = new Map<string, { cop: number, orig: number, currency: string }>()
  for (const e of gastos) {
    if (!spentByStage.has(e.stage)) {
      spentByStage.set(e.stage, { cop: 0, orig: 0, currency: e.currency })
    }
    const bucket = spentByStage.get(e.stage)!
    bucket.cop += e.amount_cop
    if (bucket.currency === e.currency) {
      bucket.orig += e.amount_original
    }
  }

  rIdx++
  wsResumen.getCell(`B${rIdx}`).value = 'País / Etapa'
  wsResumen.getCell(`C${rIdx}`).value = 'Gasto Moneda Local'
  wsResumen.getCell(`D${rIdx}`).value = 'Equivalente (COP)'
  wsResumen.getRow(rIdx).font = { bold: true }
  wsResumen.getRow(rIdx).border = { bottom: { style: 'thick', color: { argb: 'FF94A3B8' } } }

  rIdx++
  const sortedStages = Array.from(spentByStage.entries()).sort((a,b) => b[1].cop - a[1].cop)
  
  for (const [stageCode, bucket] of sortedStages) {
    const row = wsResumen.getRow(rIdx)
    row.height = 20
    
    wsResumen.getCell(`B${rIdx}`).value = stageNameByCode.get(stageCode) || stageCode
    
    wsResumen.getCell(`C${rIdx}`).value = `${bucket.orig.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${bucket.currency}`
    wsResumen.getCell(`C${rIdx}`).font = { color: { argb: 'FF475569' } }
    wsResumen.getCell(`C${rIdx}`).alignment = { horizontal: 'right' }

    wsResumen.getCell(`D${rIdx}`).value = bucket.cop
    wsResumen.getCell(`D${rIdx}`).numFmt = '"$"#,##0'
    wsResumen.getCell(`D${rIdx}`).font = { color: { argb: 'FF475569' }, bold: true }
    
    const borderObj = { bottom: { style: 'hair' as any, color: { argb: 'FFE2E8F0' } } }
    wsResumen.getCell(`B${rIdx}`).border = borderObj
    wsResumen.getCell(`C${rIdx}`).border = borderObj
    wsResumen.getCell(`D${rIdx}`).border = borderObj

    rIdx++
  }

  // --------------------------------------------------------
  // HELPER PARA ESTANDARIZAR CABECERAS DE TABLAS DE DATOS
  // --------------------------------------------------------
  function formatDataSheet(ws: ExcelJS.Worksheet) {
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.getRow(1).height = 25
    ws.getRow(1).font = { bold: true, color: { argb: C_HEADER_TXT } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_HEADER_BG } }
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
  }

  // --------------------------------------------------------
  // HOJA 2: BASE DE GASTOS
  // --------------------------------------------------------
  const wsGastos = wb.addWorksheet('💳 Base de Gastos')
  wsGastos.columns = [
    { header: '📅 Fecha', key: 'date', width: 14 },
    { header: '🏳️ País/Etapa', key: 'stage', width: 20 },
    { header: '🏷️ Categoría', key: 'category', width: 25 },
    { header: '📝 Descripción', key: 'desc', width: 45 },
    { header: '💶 Monto Orig.', key: 'origAmount', width: 15 },
    { header: '💱 Moneda', key: 'currency', width: 12 },
    { header: '📈 Tasa FX', key: 'fxRate', width: 12 },
    { header: '💰 Monto (COP)', key: 'copAmount', width: 20 }
  ]
  formatDataSheet(wsGastos)

  const gastosOrdenados = [...gastos].sort((a, b) => b.date.localeCompare(a.date))
  gastosOrdenados.forEach((g, i) => {
    const r = wsGastos.addRow({
      date: g.date,
      stage: stageNameByCode.get(g.stage) || g.stage,
      category: categoryById.get(g.category_id)?.name || 'Sin Categoría',
      desc: g.description,
      origAmount: g.amount_original,
      currency: g.currency,
      fxRate: g.fx_rate_to_cop,
      copAmount: g.amount_cop
    })
    r.height = 18
    r.getCell('date').alignment = { horizontal: 'center' }
    r.getCell('origAmount').numFmt = '#,##0.00'
    r.getCell('fxRate').numFmt = '#,##0.00'
    r.getCell('copAmount').numFmt = '"$"#,##0'
    r.getCell('copAmount').font = { bold: true, color: { argb: 'FF' + C_DANGER } }
    
    if (i % 2 === 1) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_CELL_BG_ALT } }
  })

  // --------------------------------------------------------
  // HOJA 3: ITINERARIO / TRASLADOS
  // --------------------------------------------------------
  const wsItinerario = wb.addWorksheet('🚂 Itinerario (Trayectos)')
  wsItinerario.columns = [
    { header: '📅 Fecha', key: 'date', width: 14 },
    { header: '🕒 Salida', key: 'start', width: 12 },
    { header: '🕒 Llegada', key: 'end', width: 12 },
    { header: '🚆 Tipo', key: 'type', width: 15 },
    { header: '📍 Título/Ruta', key: 'title', width: 40 },
    { header: '✈️ Specs (Vuelo)', key: 'extras', width: 35 },
    { header: '📋 Notas', key: 'notes', width: 45 }
  ]
  formatDataSheet(wsItinerario)

  const itinerariosOrdenados = [...itinerarios].sort((a, b) => {
    const d = a.date.localeCompare(b.date); return d === 0 ? (a.start_time||'').localeCompare(b.start_time||'') : d
  })
  itinerariosOrdenados.forEach((it, i) => {
    const notesStr = parseItineraryNotes(it.notes)
    let extras = ''
    if (it.type === 'VUELO') {
      const airlines = (notesStr.airlines ?? []).filter(Boolean)
      const stops = (notesStr.stops ?? []).filter(Boolean)
      if (airlines.length) extras += `Aero: ${airlines.join(', ')}. `
      if (stops.length) extras += `Escala: ${stops.join(', ')}. `
    }
    const r = wsItinerario.addRow({
      date: it.date,
      start: it.start_time || '--:--',
      end: it.end_time || '--:--',
      type: it.type,
      title: it.title,
      extras: extras.trim() || 'N/A',
      notes: notesStr.note || 'N/A'
    })
    r.height = 18
    r.getCell('date').alignment = { horizontal: 'center' }
    r.getCell('start').alignment = { horizontal: 'center' }
    r.getCell('end').alignment = { horizontal: 'center' }
    if (i % 2 === 1) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_CELL_BG_ALT } }
  })

  // --------------------------------------------------------
  // HOJA 4: AGENDA DE ACTIVIDADES
  // --------------------------------------------------------
  const wsActividades = wb.addWorksheet('🎪 Agenda Diaria')
  wsActividades.columns = [
    { header: '📅 Fecha', key: 'date', width: 14 },
    { header: '🕒 Inicio', key: 'start', width: 12 },
    { header: '🕒 Fin', key: 'end', width: 12 },
    { header: '🎭 Tipo', key: 'type', width: 18 },
    { header: '🎫 Título', key: 'title', width: 40 },
    { header: '📍 Ubicación', key: 'location', width: 30 },
    { header: '🎟️ Reserva', key: 'refs', width: 20 },
    { header: '📋 Notas', key: 'notes', width: 40 }
  ]
  formatDataSheet(wsActividades)

  const actOrdenadas = [...actividades].sort((a, b) => {
    const d = a.date.localeCompare(b.date); return d === 0 ? (a.start_time||'').localeCompare(b.start_time||'') : d
  })
  actOrdenadas.forEach((ac, i) => {
    const r = wsActividades.addRow({
      date: ac.date,
      start: ac.start_time || '--:--',
      end: ac.end_time || '--:--',
      type: ac.type,
      title: ac.title,
      location: ac.location || 'N/A',
      refs: ac.booking_refs || 'N/A',
      notes: ac.notes || 'N/A'
    })
    r.height = 18
    r.getCell('date').alignment = { horizontal: 'center' }
    r.getCell('start').alignment = { horizontal: 'center' }
    r.getCell('end').alignment = { horizontal: 'center' }
    if (i % 2 === 1) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_CELL_BG_ALT } }
  })

  // Escribir Buffer y Guardar
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `Reporte_de_viaje_${safeTripName}_${getReportDate()}.xlsx`)
}

/** 
 * Exporta el reporte ejecutivo en formato PDF 
 */
export async function exportExecutivePdf(data: TripExportData) {
  const { tripId, countries } = data

  const [gastos, categorias, presupuestos, trip] = await Promise.all([
    db.gastos.where('trip_id').equals(tripId).filter((e) => e.deleted_at == null).toArray(),
    db.categorias.filter((c) => c.deleted_at == null).toArray(),
    db.presupuestos.where('trip_id').equals(tripId).filter((b) => b.deleted_at == null && b.stage === 'GLOBAL').toArray(),
    db.viajes.get(tripId)
  ])

  const tripName = trip?.name || 'Viaje'
  const safeTripName = tripName.replace(/[^a-z0-9]/gi, '_').toLowerCase()

  const categoryById = new Map<string, AppCategory>(categorias.map(c => [c.id, c]))
  const stageNameByCode = new Map<string, string>(countries.map(c => [c.code, c.name]))

  const budgetTotal = presupuestos[0]?.amount_cop ?? 0
  const spentTotal = gastos.reduce((acc, e) => acc + (e.amount_cop ?? 0), 0)
  const remainingTotal = Math.max(0, budgetTotal - spentTotal)

  const spentByStageDet = new Map<string, { cop: number; orig: number; currency: string }>()
  for (const e of gastos) {
    const sn = stageNameByCode.get(e.stage) || e.stage
    if (!spentByStageDet.has(sn)) {
      spentByStageDet.set(sn, { cop: 0, orig: 0, currency: e.currency })
    }
    const bucket = spentByStageDet.get(sn)!
    bucket.cop += e.amount_cop
    if (bucket.currency === e.currency) {
      bucket.orig += e.amount_original
    }
  }

  const spentByKind = new Map<CategoryKind, number>()
  for (const e of gastos) {
    const cat = categoryById.get(e.category_id)
    if (!cat) continue
    spentByKind.set(cat.kind, (spentByKind.get(cat.kind) ?? 0) + e.amount_cop)
  }

  const doc = new jsPDF()

  // Cabecera Principal
  doc.setFillColor(14, 165, 233) // sky-500
  doc.rect(0, 0, 210, 30, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text(`REPORTE DE VIAJE: ${tripName.toUpperCase()}`, 14, 20)

  doc.setTextColor(50, 50, 50)
  doc.setFontSize(10)
  doc.text(`Generado el: ${getReportDate()}`, 14, 40)

  // Autotable: Resumen General
  autoTable(doc, {
    startY: 45,
    head: [['Indicador', 'Monto COP']],
    body: [
      ['Presupuesto Global', `$ ${budgetTotal.toLocaleString('es-CO')}`],
      ['Total Gastado', `$ ${spentTotal.toLocaleString('es-CO')}`],
      ['Disponible', `$ ${remainingTotal.toLocaleString('es-CO')}`]
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] }, // slate-800
    styles: { fontSize: 11, cellPadding: 4 }
  })

  // Autotable: Gasto por País
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [['País / Etapa', 'Moneda Local', 'Total Gastado (COP)']],
    body: Array.from(spentByStageDet.entries()).map(([k, bucket]) => [
      k, 
      `${bucket.orig.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${bucket.currency}`,
      `$ ${bucket.cop.toLocaleString('es-CO')}`
    ]),
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 10 }
  })

  // Autotable: Gasto por Categoría
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [['Categoría General', 'Total Gastado (COP)']],
    body: Array.from(spentByKind.entries()).map(([k, v]) => [CATEGORY_KIND_LABEL[k], `$ ${v.toLocaleString('es-CO')}`]),
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 10 }
  })

  doc.save(`Reporte_de_viaje_${safeTripName}_${getReportDate()}.pdf`)
}
