import { api } from '@/lib/api'

export interface InvitationCode {
  id: number
  code: string
  max_uses: number
  used_count: number
  expired_at: number
  status: number
  created_by: number
  remark: string
  created_at: number
  updated_at: number
}

export interface InvitationCodeListResponse {
  success: boolean
  data: {
    items: InvitationCode[]
    total: number
  }
}

export async function getInvitationCodes(
  page = 0,
  pageSize = 10,
  keyword?: string
) {
  const params: Record<string, string | number> = { p: page, page_size: pageSize }
  if (keyword) params.keyword = keyword
  const url = keyword
    ? '/api/invitation-code/search'
    : '/api/invitation-code/'
  const res = await api.get<InvitationCodeListResponse>(url, { params })
  return res.data
}

export async function createInvitationCode(data: {
  code?: string
  max_uses?: number
  expired_at?: number
  remark?: string
}) {
  const res = await api.post('/api/invitation-code/', data)
  return res.data
}

export async function updateInvitationCode(
  id: number,
  data: {
    code?: string
    max_uses?: number
    expired_at?: number
    status?: number
    remark?: string
  }
) {
  const res = await api.put(`/api/invitation-code/${id}`, data)
  return res.data
}

export async function deleteInvitationCode(id: number) {
  const res = await api.delete(`/api/invitation-code/${id}`)
  return res.data
}
