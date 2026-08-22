'use server'

import { getEntityDetail, type EntityDetail, type EntityKind } from '@/lib/data/detail'

/** Backs every drill-down dialog in the app — one action, dispatched by entity kind. */
export const fetchDetail = async (kind: EntityKind, id: string): Promise<EntityDetail> => getEntityDetail(kind, id)
