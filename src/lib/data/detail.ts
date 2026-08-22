import { createClient } from '@/lib/supabase/server'
import { getContract, listCasesForCustomer } from '@/lib/data/contracts'
import { listScenariosForContract } from '@/lib/data/scenarios'
import {
  formatPercent,
  formatRupiah,
  formatSisaHari,
  formatTanggal,
  formatTarget,
} from '@/lib/domain'

/**
 * Generic drill-down detail for any clickable data point in the app.
 *
 * One shape for every entity kind, so one dialog component can render all of them.
 * `refs` are how a detail links to another entity by id — contract → customer,
 * penalty → contract, etc. — the "join across sheets" the drill-down chains through.
 */
export type EntityKind =
  | 'contract'
  | 'customer'
  | 'penalty'
  | 'receivable'
  | 'case'
  | 'scenario'
  | 'notification'

export interface DetailField {
  label: string
  value: string
}

export interface DetailRef {
  kind: EntityKind
  id: string
  label: string
}

export interface DetailSection {
  title: string
  fields?: DetailField[]
  refs?: DetailRef[]
}

export interface EntityDetail {
  title: string
  subtitle?: string
  sections: DetailSection[]
}

const NOT_SET = '—'
const rp = (value: number | null) => (value == null ? NOT_SET : formatRupiah(value))
const tgl = (value: string | null) => (value == null ? NOT_SET : formatTanggal(value))

const getContractDetail = async (id: string): Promise<EntityDetail> => {
  const contract = await getContract(id)
  if (!contract) return { title: 'Kontrak tidak ditemukan', sections: [] }

  const supabase = await createClient()
  const [scenarios, notifications, decisions] = await Promise.all([
    listScenariosForContract(id),
    supabase.from('notifications').select('id, title, milestone_key, created_at, read').eq('contract_id', id),
    supabase.from('contract_decisions').select('id, keputusan, alasan, pada').eq('contract_id', id),
  ])

  return {
    title: `Kontrak ${contract.contractNo ?? contract.id.slice(0, 8)}`,
    subtitle: contract.customerName,
    sections: [
      {
        title: 'Kontrak',
        fields: [
          { label: 'Status', value: contract.status },
          { label: 'Lini bisnis', value: contract.businessLine },
          { label: 'Cabang', value: contract.cabang ?? 'Semua stasiun' },
          { label: 'Jenis layanan', value: contract.serviceType ?? NOT_SET },
          { label: 'Mulai', value: tgl(contract.contractStartDate) },
          { label: 'Berakhir', value: `${tgl(contract.contractEndDate)} (${formatSisaHari(contract.daysLeft)})` },
          { label: 'Tarif', value: rp(contract.tarif) },
          { label: 'Cost', value: rp(contract.cost) },
          { label: 'Volume', value: contract.volume == null ? NOT_SET : String(contract.volume) },
          { label: 'Revenue', value: rp(contract.revenue) },
          { label: 'Gross profit', value: rp(contract.grossProfitTotal) },
          {
            label: 'GPM vs target',
            value:
              contract.margin.gpm == null
                ? NOT_SET
                : `${formatPercent(contract.margin.gpm)} — target ${formatTarget(contract.minGpmTarget)}`,
          },
          { label: 'PIC', value: [contract.picNama, contract.picTelepon, contract.picEmail].filter(Boolean).join(' · ') || NOT_SET },
          { label: 'Catatan', value: contract.remarks ?? NOT_SET },
        ],
        refs: [{ kind: 'customer', id: contract.customerId, label: `Pelanggan: ${contract.customerName}` }],
      },
      {
        title: `Skenario (${scenarios.length})`,
        refs: scenarios.map((s) => ({
          kind: 'scenario',
          id: s.id,
          label: `${s.status} — diajukan ${formatTanggal(s.created_at)} oleh ${s.authorName}`,
        })),
      },
      {
        title: `Keputusan (${decisions.data?.length ?? 0})`,
        fields: (decisions.data ?? []).map((d) => ({
          label: formatTanggal(d.pada),
          value: `${d.keputusan} — ${d.alasan}`,
        })),
      },
      {
        title: `Notifikasi (${notifications.data?.length ?? 0})`,
        fields: (notifications.data ?? []).map((n) => ({
          label: formatTanggal(n.created_at),
          value: `${n.title} · ${n.milestone_key ?? NOT_SET}${n.read ? '' : ' (belum dibaca)'}`,
        })),
      },
    ],
  }
}

const getCustomerDetail = async (id: string): Promise<EntityDetail> => {
  const supabase = await createClient()
  const [customer, contracts, receivable, penalties, cases] = await Promise.all([
    supabase.from('customers').select('nama, rfm_status').eq('customer_id', id).maybeSingle(),
    supabase
      .from('contracts')
      .select('id, contract_no, business_line, cabang, contract_end_date')
      .eq('customer_id', id),
    supabase.from('receivables').select('total, status').eq('customer_id', id).maybeSingle(),
    supabase.from('penalties').select('id, deskripsi, nilai, tahap').eq('customer_id', id),
    listCasesForCustomer(id),
  ])

  return {
    title: customer.data?.nama ?? id,
    subtitle: `RFM: ${customer.data?.rfm_status ?? NOT_SET}`,
    sections: [
      {
        title: `Kontrak (${contracts.data?.length ?? 0})`,
        refs: (contracts.data ?? []).map((c) => ({
          kind: 'contract',
          id: c.id,
          label: `${c.contract_no ?? c.id.slice(0, 8)} — ${c.business_line} · berakhir ${formatTanggal(c.contract_end_date)}`,
        })),
      },
      {
        title: 'Piutang',
        fields: receivable.data
          ? [
              { label: 'Total', value: rp(Number(receivable.data.total)) },
              { label: 'Status', value: receivable.data.status },
            ]
          : [{ label: 'Piutang', value: 'Tidak ada catatan' }],
      },
      {
        title: `Penalty (${penalties.data?.length ?? 0})`,
        refs: (penalties.data ?? []).map((p) => ({
          kind: 'penalty',
          id: p.id,
          label: `${p.deskripsi} — ${p.tahap}${p.nilai == null ? '' : ` · ${rp(Number(p.nilai))}`}`,
        })),
      },
      {
        title: `Irregularities (${cases.length})`,
        refs: cases.map((k) => ({ kind: 'case', id: k.id, label: `${k.description} — ${k.status}` })),
      },
    ],
  }
}

const getPenaltyDetail = async (id: string): Promise<EntityDetail> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('penalties')
    .select('*, customers(nama)')
    .eq('id', id)
    .maybeSingle()
  if (!data) return { title: 'Penalty tidak ditemukan', sections: [] }

  return {
    title: data.deskripsi,
    subtitle: `Penalty · ${data.tahap}`,
    sections: [
      {
        title: 'Penalty',
        fields: [
          { label: 'Nilai', value: data.nilai == null ? NOT_SET : rp(Number(data.nilai)) },
          { label: 'Tahap', value: data.tahap },
          { label: 'Cabang asal', value: data.cabang_asal ?? NOT_SET },
          { label: 'Dilaporkan', value: tgl(data.dilaporkan_pada) },
          { label: 'Divalidasi', value: tgl(data.validated_at) },
        ],
        refs: [
          {
            kind: 'customer',
            id: data.customer_id,
            label: `Pelanggan: ${(data.customers as { nama: string } | null)?.nama ?? data.customer_id}`,
          },
        ],
      },
    ],
  }
}

const getReceivableDetail = async (id: string): Promise<EntityDetail> => {
  const supabase = await createClient()
  const { data } = await supabase.from('receivables').select('*, customers(nama)').eq('customer_id', id).maybeSingle()
  if (!data) return { title: 'Piutang tidak ditemukan', sections: [] }

  return {
    title: (data.customers as { nama: string } | null)?.nama ?? id,
    subtitle: `Piutang · ${data.status}`,
    sections: [
      {
        title: 'Aging',
        fields: [
          { label: 'Total', value: rp(Number(data.total)) },
          { label: '0–30', value: rp(Number(data.d0_30)) },
          { label: '31–60', value: rp(Number(data.d31_60)) },
          { label: '61–90', value: rp(Number(data.d61_90)) },
          { label: '91–120', value: rp(Number(data.d91_120)) },
          { label: '121–150', value: rp(Number(data.d121_150)) },
          { label: '151–180', value: rp(Number(data.d151_180)) },
          { label: '181–360', value: rp(Number(data.d181_360)) },
          { label: '>360', value: rp(Number(data.d360_plus)) },
        ],
        refs: [{ kind: 'customer', id: data.customer_id, label: 'Lihat pelanggan' }],
      },
    ],
  }
}

const getCaseDetail = async (id: string): Promise<EntityDetail> => {
  const supabase = await createClient()
  const { data } = await supabase.from('cases').select('*, customers(nama)').eq('id', id).maybeSingle()
  if (!data) return { title: 'Kasus tidak ditemukan', sections: [] }

  return {
    title: data.description,
    subtitle: `Irregularity · ${data.status}`,
    sections: [
      {
        title: 'Kasus',
        refs: [
          {
            kind: 'customer',
            id: data.customer_id,
            label: `Pelanggan: ${(data.customers as { nama: string } | null)?.nama ?? data.customer_id}`,
          },
        ],
      },
    ],
  }
}

const getScenarioDetail = async (id: string): Promise<EntityDetail> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('scenarios')
    .select(
      '*, author:profiles_ringkas!scenarios_author_id_fkey(nama), decider:profiles_ringkas!scenarios_decided_by_fkey(nama)',
    )
    .eq('id', id)
    .maybeSingle()
  if (!data) return { title: 'Skenario tidak ditemukan', sections: [] }

  const author = data.author as { nama: string } | null
  const decider = data.decider as { nama: string } | null

  return {
    title: `Skenario — ${data.status}`,
    subtitle: `Diajukan oleh ${author?.nama ?? NOT_SET}`,
    sections: [
      {
        title: 'Skenario',
        fields: [
          { label: 'Tarif usulan', value: rp(Number(data.proposed_tarif)) },
          { label: 'Cost usulan', value: rp(Number(data.proposed_cost)) },
          { label: 'GPM usulan', value: data.gpm == null ? NOT_SET : formatPercent(Number(data.gpm)) },
          { label: 'Diajukan', value: tgl(data.created_at) },
          { label: 'Diputuskan oleh', value: decider?.nama ?? NOT_SET },
          { label: 'Diputuskan pada', value: tgl(data.decided_at) },
          { label: 'Alasan penolakan', value: data.rejection_reason ?? NOT_SET },
        ],
        refs: [{ kind: 'contract', id: data.contract_id, label: 'Lihat kontrak' }],
      },
    ],
  }
}

const getNotificationDetail = async (id: string): Promise<EntityDetail> => {
  const supabase = await createClient()
  const { data } = await supabase.from('notifications').select('*').eq('id', id).maybeSingle()
  if (!data) return { title: 'Notifikasi tidak ditemukan', sections: [] }

  return {
    title: data.title,
    subtitle: tgl(data.created_at),
    sections: [
      {
        title: 'Notifikasi',
        fields: [
          { label: 'Isi', value: data.body },
          { label: 'Tingkat', value: data.severity },
          { label: 'Dikirim', value: tgl(data.created_at) },
          { label: 'Dibaca', value: data.read ? 'Ya' : 'Belum' },
          { label: 'Terkirim email', value: data.emailed_at ? tgl(data.emailed_at) : 'Belum' },
        ],
        refs: data.contract_id ? [{ kind: 'contract', id: data.contract_id, label: 'Lihat kontrak' }] : [],
      },
    ],
  }
}

export const getEntityDetail = async (kind: EntityKind, id: string): Promise<EntityDetail> => {
  switch (kind) {
    case 'contract':
      return getContractDetail(id)
    case 'customer':
      return getCustomerDetail(id)
    case 'penalty':
      return getPenaltyDetail(id)
    case 'receivable':
      return getReceivableDetail(id)
    case 'case':
      return getCaseDetail(id)
    case 'scenario':
      return getScenarioDetail(id)
    case 'notification':
      return getNotificationDetail(id)
  }
}
