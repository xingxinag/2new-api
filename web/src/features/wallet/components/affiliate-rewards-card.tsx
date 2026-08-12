/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Share2, KeyRound, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatQuota } from '@/lib/format'

import {
  getInvitationCodes,
  createInvitationCode,
  deleteInvitationCode,
} from '@/features/system-settings/auth/invitation-code/api'
import type { InvitationCode } from '@/features/system-settings/auth/invitation-code/api'

import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onTransfer: () => void
  complianceConfirmed?: boolean
  loading?: boolean
  userRole?: number
}

export function AffiliateRewardsCard({
  user,
  affiliateLink,
  onTransfer,
  complianceConfirmed = true,
  loading,
  userRole = 2,
}: AffiliateRewardsCardProps) {
  const { t } = useTranslation()
  const isAdmin = userRole >= 10 // RoleAdminUser=10, RoleRootUser=100
  const [codeDialogOpen, setCodeDialogOpen] = useState(false)
  const [codes, setCodes] = useState<InvitationCode[]>([])
  const [codesLoading, setCodesLoading] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newRemark, setNewRemark] = useState('')
  const [creating, setCreating] = useState(false)
  if (loading) {
    return (
      <Card data-card-hover='false' className='bg-muted/20 py-0'>
        <CardContent className='grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,0.72fr)_minmax(320px,1.15fr)] lg:items-center'>
          <div>
            <Skeleton className='h-5 w-32' />
            <Skeleton className='mt-2 h-4 w-48' />
          </div>
          <Skeleton className='h-14 rounded-lg' />
          <Skeleton className='h-10 rounded-lg' />
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (user?.aff_quota ?? 0) > 0

  return (
    <Card data-card-hover='false' className='bg-muted/20 py-0'>
      <CardContent className='grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(200px,1fr)_minmax(180px,0.65fr)_minmax(280px,1fr)] lg:items-center'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <IconBadge tone='chart-3'>
            <Share2 />
          </IconBadge>
          <div className='min-w-0'>
            <h3 className='truncate text-sm font-semibold'>
              {t('Referral Program')}
            </h3>
            <p className='text-muted-foreground line-clamp-1 text-xs'>
              {t(
                'Earn rewards when users join through your referral link. Transfer accumulated rewards to your balance anytime.'
              )}
            </p>
          </div>
        </div>

        <div className='grid grid-cols-3 gap-1.5 text-center'>
          {[
            [t('Pending'), formatQuota(user?.aff_quota ?? 0)],
            [t('Total Earned'), formatQuota(user?.aff_history_quota ?? 0)],
            [t('Invites'), String(user?.aff_count ?? 0)],
          ].map(([label, value]) => (
            <div key={label}>
              <div className='text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase'>
                {label}
              </div>
              <div className='mt-0.5 truncate text-sm font-semibold tabular-nums'>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className='flex items-center gap-2'>
          <Input
            value={affiliateLink}
            readOnly
            className='border-muted bg-background/70 h-9 min-w-0 flex-1 font-mono text-xs'
          />
          <CopyButton
            value={affiliateLink}
            variant='outline'
            className='bg-background size-9 shrink-0'
            iconClassName='size-4'
            tooltip={t('Copy referral link')}
            aria-label={t('Copy referral link')}
          />
          {hasRewards && (
            <Button
              onClick={onTransfer}
              disabled={!complianceConfirmed}
              className='h-9 shrink-0 px-3'
              size='sm'
            >
              {t('Transfer to Balance')}
            </Button>
          )}
        </div>
        {!complianceConfirmed ? (
          <p className='text-muted-foreground text-xs lg:col-span-3'>
            {t(
              'Referral reward transfer is disabled until the administrator confirms compliance terms.'
            )}
          </p>
        ) : null}

        {/* 管理员专属：邀请码管理入口 */}
        {isAdmin && (
          <div className='lg:col-span-3'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                setCodeDialogOpen(true)
                setCodesLoading(true)
                getInvitationCodes(0, 50)
                  .then((res) => setCodes((res.data?.items as any[]) ?? []))
                  .catch(() => setCodes([]))
                  .finally(() => setCodesLoading(false))
              }}
              className='gap-1.5'
            >
              <KeyRound className='h-3.5 w-3.5' />
              {t('Invitation Codes')}
            </Button>
          </div>
        )}

        {/* 邀请码管理弹窗 */}
        {isAdmin && (
          <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
            <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
              <DialogHeader>
                <DialogTitle>{t('Invitation Codes')}</DialogTitle>
              </DialogHeader>
              <div className='space-y-3'>
                <div className='flex gap-2'>
                  <Input
                    placeholder={t('Leave empty to auto-generate')}
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className='max-w-xs'
                  />
                  <Input
                    placeholder={t('Remark')}
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value)}
                    className='max-w-xs'
                  />
                  <Button
                    size='sm'
                    disabled={creating}
                    onClick={async () => {
                      setCreating(true)
                      try {
                        await createInvitationCode({
                          code: newCode || undefined,
                          remark: newRemark || undefined,
                        })
                        setNewCode('')
                        setNewRemark('')
                        const res = await getInvitationCodes(0, 50)
                        setCodes((res.data?.items as any[]) ?? [])
                      } finally {
                        setCreating(false)
                      }
                    }}
                  >
                    {creating ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Plus className='h-3.5 w-3.5' />}
                    {t('Create')}
                  </Button>
                </div>
                {codesLoading ? (
                  <div className='py-8 text-center text-sm text-muted-foreground'>{t('Loading...')}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Code')}</TableHead>
                        <TableHead>{t('Used')}</TableHead>
                        <TableHead>{t('Remark')}</TableHead>
                        <TableHead>{t('Actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {codes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className='text-center text-muted-foreground text-sm'>
                            {t('No invitation codes yet.')}
                          </TableCell>
                        </TableRow>
                      ) : codes.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className='font-mono text-xs'>
                            <span className='inline-flex items-center gap-1'>
                              {item.code}
                              <CopyButton value={item.code} size='icon' className='h-5 w-5' />
                            </span>
                          </TableCell>
                          <TableCell className='text-xs'>
                            {item.used_count} / {item.max_uses === 0 ? '∞' : item.max_uses}
                          </TableCell>
                          <TableCell className='text-xs text-muted-foreground truncate max-w-[150px]'>
                            {item.remark || '—'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant='ghost' size='sm' className='h-7 w-7 p-0 text-destructive'
                              onClick={async () => {
                                await deleteInvitationCode(item.id)
                                const res = await getInvitationCodes(0, 50)
                                setCodes((res.data?.items as any[]) ?? [])
                              }}
                            >
                              <Trash2 className='h-3.5 w-3.5' />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  )
}
