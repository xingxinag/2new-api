import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import {
  createInvitationCode,
  deleteInvitationCode,
  updateInvitationCode,
} from './api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingCode?: any
}

export function InvitationCodeDialog({ open, onOpenChange, editingCode }: Props) {
  const { t } = useTranslation()
  const isEdit = !!editingCode
  const [code, setCode] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [expiredAt, setExpiredAt] = useState('')
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editingCode) {
      setCode(editingCode.code)
      setMaxUses(editingCode.max_uses === 0 ? '' : String(editingCode.max_uses))
      setExpiredAt(
        editingCode.expired_at === 0
          ? ''
          : new Date(editingCode.expired_at * 1000).toISOString().slice(0, 10)
      )
      setRemark(editingCode.remark || '')
    } else {
      setCode('')
      setMaxUses('')
      setExpiredAt('')
      setRemark('')
    }
  }, [open, editingCode])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const payload: any = {
        max_uses: maxUses ? Number(maxUses) : 0,
        expired_at: expiredAt
          ? Math.floor(new Date(expiredAt).getTime() / 1000)
          : 0,
        remark,
      }
      if (code) payload.code = code
      if (isEdit) {
        await updateInvitationCode(editingCode.id, payload)
      } else {
        await createInvitationCode(payload)
      }
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!editingCode) return
    setSubmitting(true)
    try {
      await deleteInvitationCode(editingCode.id)
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('Edit Invitation Code') : t('Create Invitation Code')}
          </DialogTitle>
        </DialogHeader>

        <div className='grid gap-4 py-4'>
          <div className='grid gap-2'>
            <Label>{t('Code')}</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('Leave empty to auto-generate')}
              disabled={isEdit}
            />
          </div>
          <div className='grid gap-2'>
            <Label>{t('Max Uses (0 = unlimited)')}</Label>
            <Input
              type='number'
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder='0'
              min='0'
            />
          </div>
          <div className='grid gap-2'>
            <Label>{t('Expiration Date')}</Label>
            <Input
              type='date'
              value={expiredAt}
              onChange={(e) => setExpiredAt(e.target.value)}
              placeholder={t('Leave empty for no expiration')}
            />
          </div>
          <div className='grid gap-2'>
            <Label>{t('Remark')}</Label>
            <Textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              placeholder={t('Optional note')}
            />
          </div>
        </div>

        <DialogFooter>
          {isEdit && (
            <Button
              variant='destructive'
              onClick={handleDelete}
              disabled={submitting}
            >
              {t('Delete')}
            </Button>
          )}
          <div className='flex-1' />
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {isEdit ? t('Save') : t('Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
