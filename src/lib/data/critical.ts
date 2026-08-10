import type { ContractView } from '@/lib/data/contracts'
import { formatPercent, formatRupiah, minimumTarifForTarget } from '@/lib/domain'

/**
 * The renewal queue: why each contract needs attention, and what to do about it.
 *
 * The reason and the action are derived rather than authored, so the queue tells the
 * user what to do rather than only what is wrong — and cannot go stale against the
 * figures it is describing.
 */
export interface CriticalEntry {
  contract: ContractView
  /** Why this contract is in the queue. */
  alasan: string
  /** What to do about it next. */
  tindakan: string
}

const reasonFor = (contract: ContractView): string => {
  const parts: string[] = []

  if (contract.daysLeft < 0) {
    parts.push(`Kontrak sudah lewat tempo ${Math.abs(contract.daysLeft)} hari`)
  } else if (contract.daysLeft === 0) {
    parts.push('Kontrak berakhir hari ini')
  } else {
    parts.push(`Kontrak berakhir dalam ${contract.daysLeft} hari`)
  }

  if (!contract.margin.meetsTarget) {
    parts.push(
      `GPM ${formatPercent(contract.margin.gpm)} di bawah target ${formatPercent(contract.minGpmTarget)}`,
    )
  }
  if (contract.openCaseCount > 0) {
    parts.push(
      `${contract.openCaseCount} kasus layanan masih terbuka`,
    )
  }
  if (contract.rfmStatus === 'HIGH') {
    parts.push('pelanggan bernilai tinggi')
  }

  return `${parts.join(', ')}.`
}

const actionFor = (contract: ContractView): string => {
  if (contract.daysLeft < 0) {
    return contract.rfmStatus === 'HIGH'
      ? 'Hubungi pelanggan hari ini untuk perpanjangan retroaktif — nilai pelanggan tinggi, prioritas pemulihan.'
      : 'Konfirmasi apakah layanan masih berjalan, lalu ajukan perpanjangan atau tutup kontrak secara resmi.'
  }

  if (!contract.margin.meetsTarget) {
    const floor = minimumTarifForTarget(contract.cost, contract.minGpmTarget)
    return `Buka simulator dan ajukan tarif minimal ${formatRupiah(floor)} agar memenuhi target ${formatPercent(contract.minGpmTarget)}.`
  }

  if (contract.openCaseCount > 0) {
    return 'Selesaikan kasus layanan yang terbuka sebelum membuka negosiasi perpanjangan.'
  }

  if (contract.daysLeft <= 14) {
    return 'Siapkan proposal perpanjangan dan jadwalkan pertemuan minggu ini.'
  }

  return 'Susun proposal perpanjangan dan kirim reminder ke PIC terkait.'
}

export interface CriticalQueue {
  /** Past the end date — shown apart so they do not crowd out what can still be saved. */
  nonaktif: CriticalEntry[]
  kritis: CriticalEntry[]
  perluPerhatian: CriticalEntry[]
}

const toEntry = (contract: ContractView): CriticalEntry => ({
  contract,
  alasan: reasonFor(contract),
  tindakan: actionFor(contract),
})

export const buildCriticalQueue = (contracts: ContractView[]): CriticalQueue => {
  const inBand = (band: ContractView['status']) =>
    contracts
      .filter((contract) => contract.status === band)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .map(toEntry)

  return {
    nonaktif: inBand('Nonaktif'),
    kritis: inBand('Kritis'),
    perluPerhatian: inBand('Perlu Perhatian'),
  }
}
