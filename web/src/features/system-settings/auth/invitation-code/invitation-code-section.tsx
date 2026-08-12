import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { SettingsSection } from '../../components/settings-section'
import { useInvitationCodes } from './hooks'
import { InvitationCodeDialog } from './invitation-code-dialog'

export function InvitationCodeSection() {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<any>(null)
  const { data, isLoading } = useInvitationCodes(page, 10, keyword || undefined)

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const handleCreate = () => {
    setEditingCode(null)
    setDialogOpen(true)
  }

  const handleEdit = (code: any) => {
    setEditingCode(code)
    setDialogOpen(true)
  }

  return (
    <SettingsSection title={t('Invitation Codes')}>
      <div className='mb-4 flex items-center gap-2'>
        <Input
          placeholder={t('Search')}
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            setPage(0)
          }}
          className='max-w-xs'
        />
        <Button onClick={handleCreate}>{t('Create')}</Button>
      </div>

      {isLoading ? (
        <div className='text-muted-foreground py-8 text-center text-sm'>
          {t('Loading...')}
        </div>
      ) : (
        <div className='space-y-2'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Code')}</TableHead>
                <TableHead>{t('Used')}</TableHead>
                <TableHead>{t('Max Uses')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Remark')}</TableHead>
                <TableHead>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-muted-foreground py-8 text-center text-sm'>
                    {t('No invitation codes yet.')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className='font-mono'>
                      <span className='inline-flex items-center gap-1'>
                        {item.code}
                        <CopyButton value={item.code} size='icon' className='size-5' />
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.used_count} / {item.max_uses === 0 ? '∞' : item.max_uses}
                    </TableCell>
                    <TableCell>{item.max_uses === 0 ? '∞' : item.max_uses}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === 1 ? 'default' : 'destructive'}>
                        {item.status === 1 ? t('Active') : t('Disabled')}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-muted-foreground max-w-[200px] truncate'>
                      {item.remark || '—'}
                    </TableCell>
                    <TableCell>
                      <div className='flex gap-1'>
                        <Button variant='ghost' size='sm' onClick={() => handleEdit(item)}>
                          {t('Edit')}
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='text-destructive'
                          onClick={() => handleEdit(item)}
                        >
                          {t('Delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {total > 10 && (
            <div className='flex justify-end gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t('Previous')}
              </Button>
              <span className='text-muted-foreground flex items-center text-sm'>
                {page + 1} / {Math.ceil(total / 10)}
              </span>
              <Button
                variant='outline'
                size='sm'
                disabled={(page + 1) * 10 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('Next')}
              </Button>
            </div>
          )}
        </div>
      )}

      <InvitationCodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingCode={editingCode}
      />
    </SettingsSection>
  )
}
