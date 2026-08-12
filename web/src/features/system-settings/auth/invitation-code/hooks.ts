import { useQuery } from '@tanstack/react-query'

import { getInvitationCodes, type InvitationCode } from './api'

export function useInvitationCodes(
  page = 0,
  pageSize = 10,
  keyword?: string
) {
  return useQuery({
    queryKey: ['invitation-codes', page, pageSize, keyword],
    queryFn: async () => {
      const res = await getInvitationCodes(page, pageSize, keyword)
      return {
        items: (res.data?.items as InvitationCode[]) ?? [],
        total: res.data?.total ?? 0,
      }
    },
  })
}
