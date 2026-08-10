import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'

import { canEditContracts, requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { BUSINESS_LINES, RFM_STATUSES } from '@/lib/domain'
import type { BusinessLine, RfmStatus } from '@/lib/domain'

export const metadata = { title: 'Kontrak Baru — G-CME' }

/**
 * Creates the customer and its contract together. They are 1:1 in the source data, so
 * there is one form and one action rather than an onboarding flow.
 *
 * ponytail: validation is the database's — the customer-id format, the tarif/cost
 * relationship and the target range are all check constraints, and `required` plus
 * `pattern` on the inputs stop the ordinary mistakes before the round trip.
 */
const createContract = async (formData: FormData): Promise<void> => {
  'use server'

  const supabase = await createClient()
  const customerId = String(formData.get('customer_id') ?? '').trim()
  const endDate = String(formData.get('contract_end_date') ?? '')

  const { error: customerError } = await supabase.from('customers').insert({
    customer_id: customerId,
    nama: String(formData.get('nama') ?? '').trim(),
    rfm_status: formData.get('rfm_status') as RfmStatus,
  })
  if (customerError) redirect(`/kontrak/baru?galat=${encodeURIComponent(customerError.message)}`)

  const { error: contractError } = await supabase.from('contracts').insert({
    customer_id: customerId,
    business_line: formData.get('business_line') as BusinessLine,
    service_type: String(formData.get('service_type') ?? '').trim(),
    contract_end_date: endDate,
    // No workbook row behind a contract created here, so its own start is the source.
    source_end_date: endDate,
    tarif: Number(formData.get('tarif')),
    cost: Number(formData.get('cost')),
    min_gpm_target: Number(formData.get('min_gpm_target')) / 100,
  })
  if (contractError) {
    // Do not leave a customer with no contract behind a failed insert.
    await supabase.from('customers').delete().eq('customer_id', customerId)
    redirect(`/kontrak/baru?galat=${encodeURIComponent(contractError.message)}`)
  }

  redirect('/kontrak')
}

const FIELD = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'
const LABEL = 'mb-1.5 block text-xs font-semibold text-gray-700'

export default async function KontrakBaruPage({
  searchParams,
}: {
  searchParams: Promise<{ galat?: string }>
}) {
  const profile = await requireProfile()
  // A VP monitors; the insert policy would refuse them regardless of what is shown.
  if (!canEditContracts(profile)) redirect('/kontrak')

  const { galat } = await searchParams

  return (
    <div className="space-y-5">
      <Link
        href="/kontrak"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-primary"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Kembali ke daftar kontrak
      </Link>

      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-gray-900 sm:text-2xl">
          <Plus className="text-primary" size={22} aria-hidden="true" />
          Kontrak Baru
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Pelanggan dan kontraknya dibuat bersama — satu pelanggan, satu kontrak.
        </p>
      </header>

      {galat ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Gagal menyimpan: {galat}
        </p>
      ) : null}

      <form action={createContract} className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="customer_id" className={LABEL}>
              ID Pelanggan
            </label>
            <input
              id="customer_id"
              name="customer_id"
              required
              pattern="CUST-[A-Z]{2}-[0-9]{3}"
              placeholder="CUST-GH-021"
              title="Format: CUST-XX-NNN, mis. CUST-GH-021"
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="nama" className={LABEL}>
              Nama Pelanggan
            </label>
            <input id="nama" name="nama" required className={FIELD} />
          </div>
          <div>
            <label htmlFor="rfm_status" className={LABEL}>
              Standing RFM
            </label>
            <select id="rfm_status" name="rfm_status" required className={FIELD}>
              {RFM_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="business_line" className={LABEL}>
              Lini Bisnis
            </label>
            <select id="business_line" name="business_line" required className={FIELD}>
              {(profile.business_line ? [profile.business_line] : BUSINESS_LINES).map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="service_type" className={LABEL}>
              Jenis Layanan
            </label>
            <input id="service_type" name="service_type" required className={FIELD} />
          </div>
          <div>
            <label htmlFor="contract_end_date" className={LABEL}>
              Tanggal Berakhir
            </label>
            <input
              id="contract_end_date"
              name="contract_end_date"
              type="date"
              required
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="tarif" className={LABEL}>
              Tarif (Rp)
            </label>
            <input id="tarif" name="tarif" type="number" min="1" step="1" required className={FIELD} />
          </div>
          <div>
            <label htmlFor="cost" className={LABEL}>
              Cost (Rp) — harus lebih kecil dari tarif
            </label>
            <input id="cost" name="cost" type="number" min="0" step="1" required className={FIELD} />
          </div>
          <div>
            <label htmlFor="min_gpm_target" className={LABEL}>
              Target GPM (%)
            </label>
            <input
              id="min_gpm_target"
              name="min_gpm_target"
              type="number"
              min="1"
              max="99"
              step="1"
              defaultValue={25}
              required
              className={FIELD}
            />
          </div>
        </div>

        <button
          type="submit"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
        >
          <Plus size={15} aria-hidden="true" />
          Simpan Kontrak
        </button>
      </form>
    </div>
  )
}
