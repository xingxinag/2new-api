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
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { z } from 'zod'

import { Dialog } from '@/components/dialog'
import { PasswordInput } from '@/components/password-input'
import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  register,
  verifyInvitationCode,
  verifyRedemptionCode,
  wechatLoginByCode,
} from '@/features/auth/api'
import { LegalConsent } from '@/features/auth/components/legal-consent'
import { OAuthProviders } from '@/features/auth/components/oauth-providers'
import { registerFormSchema } from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useEmailVerification } from '@/features/auth/hooks/use-email-verification'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import {
  getAffiliateCode,
  saveAffiliateCode,
} from '@/features/auth/lib/storage'
import { useStatus } from '@/hooks/use-status'
import { isAuthBundle } from '@/lib/api'
import { getServerErrorMessageKey } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

export function SignUpForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [agreedToLegal, setAgreedToLegal] = useState(false)
  const [wechatCode, setWeChatCode] = useState('')
  const [isWeChatDialogOpen, setIsWeChatDialogOpen] = useState(false)
  const [isWeChatSubmitting, setIsWeChatSubmitting] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  const legalConsentErrorMessage = t('Please agree to the legal terms first')
  // 邀请码门禁状态
  const [invitationCode, setInvitationCode] = useState('')
  const [isInvitationVerified, setIsInvitationVerified] = useState(false)
  const [isVerifyingInvitation, setIsVerifyingInvitation] = useState(false)
  const [isInvitationFromUrl, setIsInvitationFromUrl] = useState(false)
  // 兑换码门禁状态
  const [redemptionCode, setRedemptionCode] = useState('')
  const [isRedemptionVerified, setIsRedemptionVerified] = useState(false)
  const [isVerifyingRedemption, setIsVerifyingRedemption] = useState(false)

  const { status } = useStatus()
  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const { redirectToLogin, handleLoginSuccess } = useAuthRedirect()
  const {
    isSending: isSendingCode,
    secondsLeft,
    isActive,
    sendCode,
  } = useEmailVerification({
    turnstileToken,
    validateTurnstile,
  })

  const form = useForm<z.infer<typeof registerFormSchema>>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const emailValue = form.watch('email')
  const emailVerificationRequired = !!status?.email_verification
  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)
  const requiresLegalConsent = hasUserAgreement || hasPrivacyPolicy
  const oauthRegisterEnabled =
    status?.oauth_register_enabled ??
    status?.data?.oauth_register_enabled ??
    true
  const hasWeChatLogin = Boolean(status?.wechat_login)
  const turnstileReady = !isTurnstileEnabled || Boolean(turnstileToken)
  const invitationCodeRequired =
    status?.invitation_code_required ??
    status?.data?.invitation_code_required ??
    false
  const redemptionCodeRequired =
    status?.redemption_code_required ??
    status?.data?.redemption_code_required ??
    false
  const needsAnyGate = invitationCodeRequired || redemptionCodeRequired
  // 门禁是否显示：需要门禁时，且对应码未通过验证
  const showGate =
    needsAnyGate &&
    ((invitationCodeRequired && !isInvitationVerified) ||
      (redemptionCodeRequired && !isRedemptionVerified))
  // 当前应该显示哪个门禁（顺序：先邀请码，再兑换码）
  const activeGateType =
    invitationCodeRequired && !isInvitationVerified
      ? 'invitation'
      : redemptionCodeRequired && !isRedemptionVerified
        ? 'redemption'
        : null

  const wechatQrCodeUrl = useMemo(() => {
    return (
      status?.wechat_qrcode ||
      status?.wechat_qr_code ||
      status?.wechat_qrcode_image_url ||
      status?.wechat_qr_code_image_url ||
      status?.wechat_account_qrcode_image_url ||
      status?.WeChatAccountQRCodeImageURL ||
      status?.data?.wechat_qrcode ||
      status?.data?.WeChatAccountQRCodeImageURL ||
      ''
    )
  }, [status])

  useEffect(() => {
    if (requiresLegalConsent) {
      setAgreedToLegal(false)
    } else {
      setAgreedToLegal(true)
    }
  }, [requiresLegalConsent])

  useEffect(() => {
    const aff = new URLSearchParams(window.location.search).get('aff')?.trim()
    if (aff) {
      saveAffiliateCode(aff)
      setInvitationCode(aff)
      setIsInvitationFromUrl(true)
      // URL 有邀请码时自动选择邀请码门禁
      if (invitationCodeRequired) {
        setIsInvitationFromUrl(true)
      }
    }
    // URL 有 redemption 参数时自动选择兑换码门禁
    const redemption = new URLSearchParams(window.location.search).get('redemption')?.trim()
    if (redemption) {
      setRedemptionCode(redemption)
      if (redemptionCodeRequired) setGateType('redemption')
    }
  }, [])

  // URL 自动预验证
  useEffect(() => {
    if (activeGateType !== 'invitation' || isInvitationVerified || !isInvitationFromUrl) return
    const code = invitationCode.trim()
    if (!code) return
    setIsVerifyingInvitation(true)
    verifyInvitationCode(code)
      .then((res) => {
        if (res?.data?.valid) {
          setIsInvitationVerified(true)
          toast.success(t('Invitation code verified'))
        }
      })
      .catch(() => {})
      .finally(() => setIsVerifyingInvitation(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGateType, invitationCode, isInvitationFromUrl])

  async function handleVerifyInvitation() {
    const code = invitationCode.trim()
    if (!code) {
      toast.error(t('Invitation code is required'))
      return
    }
    setIsVerifyingInvitation(true)
    try {
      const res = await verifyInvitationCode(code)
      if (res?.data?.valid) {
        setIsInvitationVerified(true)
        toast.success(t('Invitation code verified'))
      } else {
        const msg = res?.data?.error_msg || t('Invalid invitation code')
        toast.error(msg)
      }
    } catch {
      toast.error(t('Invalid invitation code'))
    } finally {
      setIsVerifyingInvitation(false)
    }
  }

  async function handleVerifyRedemption() {
    const key = redemptionCode.trim()
    if (!key) {
      toast.error(t('Redemption code is required'))
      return
    }
    setIsVerifyingRedemption(true)
    try {
      const res = await verifyRedemptionCode(key)
      if (res?.data?.valid) {
        setIsRedemptionVerified(true)
        toast.success(t('Redemption code verified'))
      } else {
        toast.error(t('Invalid redemption code'))
      }
    } catch {
      toast.error(t('Invalid redemption code'))
    } finally {
      setIsVerifyingRedemption(false)
    }
  }

  async function onSubmit(data: z.infer<typeof registerFormSchema>) {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }

    // Validate email verification if required
    if (emailVerificationRequired) {
      if (!data.email) {
        toast.error(t('Please enter your email'))
        return
      }
      if (!verificationCode) {
        toast.error(t('Please enter the verification code'))
        return
      }
    }

    if (!validateTurnstile()) return

    setIsLoading(true)
    try {
      const res = await register({
        username: data.username,
        password: data.password,
        email: data.email || undefined,
        verification_code: verificationCode || undefined,
        aff_code: getAffiliateCode() || undefined,
        invitation_code: isInvitationVerified ? invitationCode.trim() || undefined : undefined,
        redemption_code: isRedemptionVerified ? redemptionCode.trim() || undefined : undefined,
        turnstile: turnstileToken,
      })

      if (res?.success) {
        toast.success(t('Account created! Please sign in'))
        redirectToLogin()
      } else {
        toast.error(res?.message || t('Failed to create account'))
      }
    } catch {
      // Errors are handled by global interceptor
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSendVerificationCode() {
    if (await sendCode(emailValue || '')) {
      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    }
  }

  const handleOpenWeChatDialog = () => {
    if (requiresLegalConsent && !agreedToLegal) {
      toast.error(legalConsentErrorMessage)
      return
    }

    setIsWeChatDialogOpen(true)
  }

  const handleWeChatDialogChange = (open: boolean) => {
    setIsWeChatDialogOpen(open)
    if (!open) {
      setWeChatCode('')
      setIsWeChatSubmitting(false)
    }
  }

  async function handleWeChatLogin() {
    if (!wechatCode.trim()) {
      toast.error(t('Please enter the verification code'))
      return
    }

    setIsWeChatSubmitting(true)
    try {
      const res = await wechatLoginByCode(wechatCode)
      if (res?.success && isAuthBundle(res.data)) {
        await handleLoginSuccess(res.data)
        toast.success(t('Signed in via WeChat'))
        handleWeChatDialogChange(false)
      } else {
        if (getServerErrorMessageKey(res)) return
        toast.error(res?.message || t('Login failed'))
      }
    } catch (error: unknown) {
      if (getServerErrorMessageKey(error)) return
      toast.error(t('Login failed'))
    } finally {
      setIsWeChatSubmitting(false)
    }
  }

  let verificationCodeAction: ReactNode = t('Send code')
  if (isActive) {
    verificationCodeAction = t('Resend ({{seconds}}s)', {
      seconds: secondsLeft,
    })
  } else if (isSendingCode) {
    verificationCodeAction = <Loader2 className='h-4 w-4 animate-spin' />
  }

  return (
    <Form {...form}>
      {needsAnyGate && showGate ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (activeGateType === 'invitation') handleVerifyInvitation()
            else handleVerifyRedemption()
          }}
          className={cn('grid gap-4', className)}
          {...props}
        >
          {/* 当两个都开启时，顺序提示：先邀请码再兑换码 */}
          {invitationCodeRequired && redemptionCodeRequired && (
            <div className='flex gap-2'>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isInvitationVerified ? 'bg-green-100 text-green-800' : activeGateType === 'invitation' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                {t('Invitation Code')} {isInvitationVerified ? '✓' : ''}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isRedemptionVerified ? 'bg-green-100 text-green-800' : activeGateType === 'redemption' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                {t('Redemption Code')} {isRedemptionVerified ? '✓' : ''}
              </span>
            </div>
          )}

          {activeGateType === 'invitation' ? (
            <>
              <div className='space-y-2'>
                <FormLabel>{t('Invitation code required')}</FormLabel>
                <p className='text-muted-foreground text-sm'>
                  {t('This site requires an invitation code to register')}
                </p>
              </div>
              <Input
                placeholder={t('Please enter your invitation code')}
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                autoComplete='off'
                autoFocus
              />
              <Button
                type='submit'
                className='mt-2 w-full justify-center gap-2'
                disabled={isVerifyingInvitation || !invitationCode.trim()}
              >
                {isVerifyingInvitation ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : null}
                {t('Verify')}
              </Button>
            </>
          ) : (
            <>
              <div className='space-y-2'>
                <FormLabel>{t('Redemption code required')}</FormLabel>
                <p className='text-muted-foreground text-sm'>
                  {t('This site requires a redemption code to register')}
                </p>
              </div>
              <Input
                placeholder={t('Please enter your redemption code')}
                value={redemptionCode}
                onChange={(e) => setRedemptionCode(e.target.value)}
                autoComplete='off'
                autoFocus
              />
              <Button
                type='submit'
                className='mt-2 w-full justify-center gap-2'
                disabled={isVerifyingRedemption || !redemptionCode.trim()}
              >
                {isVerifyingRedemption ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : null}
                {t('Verify')}
              </Button>
            </>
          )}
        </form>
      ) : (
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn('grid gap-4', className)}
          {...props}
        >
        {/* Username Field */}
        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Username')}</FormLabel>
              <FormControl>
                <Input placeholder={t('Enter your username')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password Field */}
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Password')}</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder={t('Enter password (8-20 characters)')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Confirm Password Field */}
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Confirm password')}</FormLabel>
              <FormControl>
                <PasswordInput placeholder={t('Confirm password')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email Verification Section */}
        {emailVerificationRequired && (
          <>
            {/* Email Field */}
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('Email (required for verification)')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('name@example.com')}
                      type='email'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Verification Code Field */}
            <div className='flex items-end gap-2'>
              <div className='flex-1'>
                <Input
                  placeholder={t('Verification code')}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>
              <Button
                variant='outline'
                type='button'
                disabled={
                  isLoading ||
                  isSendingCode ||
                  isActive ||
                  !emailValue ||
                  !turnstileReady
                }
                onClick={handleSendVerificationCode}
              >
                {verificationCodeAction}
              </Button>
            </div>
          </>
        )}

        {/* Turnstile */}
        {isTurnstileEnabled && (
          <div className='mt-2'>
            <Turnstile
              key={turnstileWidgetKey}
              siteKey={turnstileSiteKey}
              onVerify={setTurnstileToken}
            />
          </div>
        )}

        <LegalConsent
          status={status}
          checked={agreedToLegal}
          onCheckedChange={setAgreedToLegal}
          className='mt-1'
        />

        {/* Submit Button */}
        <Button
          type='submit'
          className='mt-2 w-full justify-center gap-2'
          disabled={
            isLoading ||
            (requiresLegalConsent && !agreedToLegal) ||
            !turnstileReady
          }
        >
          {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
          {t('Create account')}
        </Button>

        {oauthRegisterEnabled && (
          <OAuthProviders
            status={status}
            disabled={isLoading || (requiresLegalConsent && !agreedToLegal)}
            onWeChatLogin={hasWeChatLogin ? handleOpenWeChatDialog : undefined}
            isWeChatLoading={isWeChatSubmitting}
            className='pt-2'
          />
        )}
        </form>
      )}

      {hasWeChatLogin && (
        <Dialog
          open={isWeChatDialogOpen}
          onOpenChange={handleWeChatDialogChange}
          title={t('WeChat sign in')}
          description={t(
            'Scan the QR code to follow the official account and reply with “验证码” to receive your verification code.'
          )}
          contentClassName='max-w-sm'
          headerClassName='text-left'
          contentHeight='auto'
          bodyClassName='space-y-4'
          footer={
            <>
              <Button
                type='button'
                variant='outline'
                onClick={() => handleWeChatDialogChange(false)}
                disabled={isWeChatSubmitting}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='button'
                onClick={handleWeChatLogin}
                disabled={
                  isWeChatSubmitting ||
                  !wechatCode.trim() ||
                  (requiresLegalConsent && !agreedToLegal)
                }
                className='gap-2'
              >
                {isWeChatSubmitting ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : null}
                {t('Confirm')}
              </Button>
            </>
          }
        >
          {wechatQrCodeUrl ? (
            <div className='flex justify-center'>
              <img
                src={wechatQrCodeUrl}
                alt={t('WeChat login QR code')}
                className='h-40 w-40 rounded-md border object-contain'
              />
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('QR code is not configured. Please contact support.')}
            </p>
          )}
          <div className='grid gap-2'>
            <Label htmlFor='wechat-code'>{t('Verification code')}</Label>
            <Input
              id='wechat-code'
              placeholder={t('Enter the verification code')}
              value={wechatCode}
              onChange={(event) => setWeChatCode(event.target.value)}
              autoComplete='one-time-code'
            />
          </div>
        </Dialog>
      )}
    </Form>
  )
}
