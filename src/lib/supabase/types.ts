import type { Database } from '@/lib/supabase/database.types'

/**
 * Row aliases over the generated schema.
 *
 * `database.types.ts` is generated and must not be edited by hand — regenerate with:
 *   supabase gen types typescript --local > src/lib/supabase/database.types.ts
 * Everything the application imports comes through here, so a schema change surfaces
 * as a type error at the call sites rather than as a silent shape mismatch.
 */

export type { Database }

type Tables = Database['public']['Tables']
type Enums = Database['public']['Enums']

export type ProfileRow = Tables['profiles']['Row']
export type CustomerRow = Tables['customers']['Row']
export type ContractRow = Tables['contracts']['Row']
export type CaseRow = Tables['cases']['Row']
export type ScenarioRow = Tables['scenarios']['Row']
export type NotificationRow = Tables['notifications']['Row']

export type ScenarioInsert = Tables['scenarios']['Insert']
export type ContractUpdate = Tables['contracts']['Update']

export type NotificationSeverity = Enums['notification_severity']
