import type { CategoryKind } from '@/../shared/types'
import type { CountryStage, CurrencyCode } from '@/../shared/types'

export type ExpenseFormState = {
  date: string
  stage: CountryStage
  stageMode: 'AUTO' | 'MANUAL'
  categoryKind: CategoryKind
  categoryId: string
  description: string
  currency: CurrencyCode
  amountOriginal: string
  fxRate: string
}
