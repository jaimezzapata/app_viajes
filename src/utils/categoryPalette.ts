import type { CategoryKind } from '@/../shared/types'

export const CATEGORY_KIND_LABEL: Record<CategoryKind, string> = {
  HOSPEDAJE: 'Hospedaje',
  TRANSPORTE: 'Transporte',
  COMIDA: 'Comida',
  SOUVENIRES: 'Souvenires',
  ENTRETENIMIENTO: 'Entretenimiento',
  OTROS: 'Otros',
}

export const CATEGORY_KIND_COLOR: Record<CategoryKind, string> = {
  HOSPEDAJE: '#0ea5e9',
  TRANSPORTE: '#a855f7',
  COMIDA: '#22c55e',
  SOUVENIRES: '#f59e0b',
  ENTRETENIMIENTO: '#ec4899', // Pink
  OTROS: '#f43f5e',
}
