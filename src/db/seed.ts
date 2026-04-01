import type { AppCategory } from '@/../shared/types'
import { db } from '@/db/appDb'
import { nowIso } from '@/utils/id'
import { CATEGORY_KIND_COLOR } from '@/utils/categoryPalette'

const SEED_KEY = 'seed_v1'

const CATEGORY_IDS = {
  HOSPEDAJE: 'c7f3c1b6-3c03-4f25-9af6-9b8e26a8f9d1',
  TRANSPORTE: '6b7d0a2f-2f9e-4f7d-9f2b-8d5e8a2c1d3f',
  VUELOS_INTERNACIONALES: 'f7d9a1d4-1b60-4b68-9a0b-3d4f0d0ee27f',
  VUELOS_INTERNOS: '9bd8c0e9-7b46-4f3d-bf5c-d9383f6253e8',
  TRANSPORTE_INTERURBANO: '2c3f2a10-2d0a-4a62-9a76-5bda0f8c9c31',
  TRANSPORTE_URBANO: '0c2b9f4e-14c1-4c1c-8b2a-ecf1a0f2b17c',
  COMIDA: '3b0b2d6f-9a9a-4f0a-a7d6-7d6c0a2b8a40',

  SOUVENIRES: 'd2f4a6c1-1a2b-4c3d-9e0f-7a6b5c4d3e2f',
  SOUV_ROPA: 'b0a2d57e-7e4c-4c2f-8c0e-2a2f2f8e3b31',
  SOUV_DULCES: 'e3b1c7a4-2f6d-4b0d-9ac2-7e8b4d1c5a9f',
  SOUV_TECNO: '4f2d9c18-7b6a-4e31-9c0e-1a2b3c4d5e6f',
  SOUV_ARTES: '2a9d4c1e-0b7c-4e8c-9f10-6b5a4d3c2b1a',
  SOUV_COMIDA: '7c1e2d3a-9b5f-4c2d-8e1a-5f6b7c8d9e0a',
  SOUV_HOGAR: '1b2c3d4e-5a6f-4b3c-9d8e-0a1b2c3d4e5a',
  OT_EQUIPAJE: '5b6c7d8e-9f10-4a1b-8c2d-3e4f5a6b7c8d',
  OTROS: 'a1b2c3d4-5e6f-4a5b-9c8d-7e6f5a4b3c2d',
  OT_ENVIO: '8d7c6b5a-4f3e-4d2c-8b1a-0f9e8d7c6b5a',
  OT_CANDADOS: '0f1e2d3c-4b5a-4c6d-8e9f-0a1b2c3d4e5f',
  OT_IMPREV: '9f8e7d6c-5b4a-4a3b-2c1d-0e9f8e7d6c5b',
} as const


function baseCategory(
  id: string,
  params: Pick<AppCategory, 'kind' | 'subkind' | 'name' | 'icon'>,
): AppCategory {
  const ts = nowIso()
  return {
    id,
    user_id: null,
    kind: params.kind,
    subkind: params.subkind,
    name: params.name,
    icon: params.icon,
    color: CATEGORY_KIND_COLOR[params.kind],
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  }
}

export async function initializeLocalApp() {
  await db.open()

  const existingCount = await db.categorias.count()
  const seeded = await db.meta.get(SEED_KEY)
  if (seeded?.value === '1' && existingCount > 0) return

  const categories: AppCategory[] = [
    baseCategory(CATEGORY_IDS.HOSPEDAJE, { kind: 'HOSPEDAJE', subkind: null, name: 'Hospedaje', icon: 'Hotel' }),

    baseCategory(CATEGORY_IDS.TRANSPORTE, { kind: 'TRANSPORTE', subkind: null, name: 'Transporte', icon: 'Train' }),

    baseCategory(CATEGORY_IDS.VUELOS_INTERNACIONALES, { kind: 'TRANSPORTE', subkind: 'VUELOS_INTERNACIONALES', name: 'Vuelos internacionales', icon: 'Plane' }),
    baseCategory(CATEGORY_IDS.VUELOS_INTERNOS, { kind: 'TRANSPORTE', subkind: 'VUELOS_INTERNOS', name: 'Vuelos internos', icon: 'PlaneTakeoff' }),
    baseCategory(CATEGORY_IDS.TRANSPORTE_INTERURBANO, { kind: 'TRANSPORTE', subkind: 'TRANSPORTE_INTERURBANO', name: 'Transporte interurbano', icon: 'Train' }),
    baseCategory(CATEGORY_IDS.TRANSPORTE_URBANO, { kind: 'TRANSPORTE', subkind: 'TRANSPORTE_URBANO', name: 'Transporte urbano', icon: 'Bus' }),

    baseCategory(CATEGORY_IDS.COMIDA, { kind: 'COMIDA', subkind: null, name: 'Comida', icon: 'Utensils' }),

    baseCategory(CATEGORY_IDS.SOUVENIRES, { kind: 'SOUVENIRES', subkind: null, name: 'Souvenires', icon: 'Gift' }),

    baseCategory(CATEGORY_IDS.SOUV_ROPA, { kind: 'SOUVENIRES', subkind: 'ROPA', name: 'Souvenires — Ropa', icon: 'Shirt' }),
    baseCategory(CATEGORY_IDS.SOUV_DULCES, { kind: 'SOUVENIRES', subkind: 'DULCES_SNACKS', name: 'Souvenires — Dulces/Snacks', icon: 'Candy' }),
    baseCategory(CATEGORY_IDS.SOUV_TECNO, { kind: 'SOUVENIRES', subkind: 'TECNOLOGIA', name: 'Souvenires — Tecnología', icon: 'Smartphone' }),
    baseCategory(CATEGORY_IDS.SOUV_ARTES, { kind: 'SOUVENIRES', subkind: 'ARTESANIAS', name: 'Souvenires — Artesanías', icon: 'Gift' }),
    baseCategory(CATEGORY_IDS.SOUV_COMIDA, { kind: 'SOUVENIRES', subkind: 'COMIDA', name: 'Souvenires — Comida', icon: 'ShoppingBag' }),
    baseCategory(CATEGORY_IDS.SOUV_HOGAR, { kind: 'SOUVENIRES', subkind: 'HOGAR', name: 'Souvenires — Hogar', icon: 'Home' }),

    baseCategory(CATEGORY_IDS.OTROS, { kind: 'OTROS', subkind: null, name: 'Otros', icon: 'TriangleAlert' }),

    baseCategory(CATEGORY_IDS.OT_EQUIPAJE, { kind: 'OTROS', subkind: 'EQUIPAJE_EXTRA', name: 'Otros — Equipaje extra', icon: 'Luggage' }),
    baseCategory(CATEGORY_IDS.OT_ENVIO, { kind: 'OTROS', subkind: 'ENVIO_EQUIPAJE', name: 'Otros — Envío de equipaje', icon: 'Package' }),
    baseCategory(CATEGORY_IDS.OT_CANDADOS, { kind: 'OTROS', subkind: 'CANDADOS', name: 'Otros — Candados', icon: 'Lock' }),
    baseCategory(CATEGORY_IDS.OT_IMPREV, { kind: 'OTROS', subkind: 'IMPREVISTOS', name: 'Otros — Imprevistos', icon: 'TriangleAlert' }),
  ]

  await db.transaction('rw', db.categorias, db.meta, async () => {
    const requiredIds = categories.map((c) => c.id)
    const existing = await db.categorias.where('id').anyOf(requiredIds).toArray()
    const existingIds = new Set(existing.map((c) => c.id))
    const missing = categories.filter((c) => !existingIds.has(c.id))
    if (missing.length > 0) {
      await db.categorias.bulkPut(missing)
    }
    await db.meta.put({ key: SEED_KEY, value: '1' })
  })
}
