import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useLanguage } from '@/features/auth/hooks'
import { displayNameOf, saveProfile } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'
import { initials } from '@/lib/initials'
import { cn } from '@/lib/utils'
import { userProfileSchema, type UserDoc } from '@/model'
import { useAuth } from '@/providers/auth-context'

export function ProfilePage() {
  const { t } = useTranslation()
  const profile = useProfile()

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="font-heading text-2xl font-semibold">
        {t('profile.title')}
      </h1>
      {profile.loading ? (
        <Skeleton className="h-64" />
      ) : (
        <ProfileForm profile={profile.data} />
      )}
      <LanguageCard />
    </section>
  )
}

function ProfileForm({ profile }: { profile: UserDoc | null }) {
  const { t } = useTranslation()
  const { user, role } = useAuth()
  const [name, setName] = useState(profile?.profileName ?? '')
  const [showPhoto, setShowPhoto] = useState(profile?.showPhoto ?? true)
  const [saving, setSaving] = useState(false)

  if (!user) return null
  const valid = userProfileSchema.safeParse({ name, showPhoto }).success
  const shownName = name.trim() || displayNameOf(user, null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!user || !valid) return
    setSaving(true)
    try {
      const { skipped } = await saveProfile(user, { name, showPhoto })
      toast.success(t('profile.saved'))
      if (skipped > 0) toast.info(t('profile.skipped', { count: skipped }))
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.cardTitle')}</CardTitle>
        <CardDescription>{t('profile.hint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div
            className="flex items-center gap-3"
            data-testid="profile-preview"
          >
            <Avatar className="size-12">
              {showPhoto && (
                <AvatarImage
                  src={user.photoURL ?? undefined}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              )}
              <AvatarFallback>{initials(shownName)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{shownName}</span>
              <span className="truncate text-sm text-muted-foreground">
                {user.email}
                {role && ` · ${t(`roles.${role}`)}`}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-name">{t('profile.name')}</Label>
            <Input
              id="profile-name"
              value={name}
              maxLength={120}
              placeholder={user.displayName ?? ''}
              onChange={(event) => setName(event.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {t('profile.nameHint')}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label
              htmlFor="profile-photo"
              className="flex flex-col items-start gap-1"
            >
              <span>{t('profile.showPhoto')}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {t('profile.showPhotoHint')}
              </span>
            </Label>
            <Switch
              id="profile-photo"
              checked={showPhoto}
              onCheckedChange={setShowPhoto}
            />
          </div>

          <Button
            type="submit"
            className="self-end"
            disabled={!valid || saving}
          >
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function LanguageCard() {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('language.label')}</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        {SUPPORTED_LANGUAGES.map((lng) => (
          <Button
            key={lng}
            type="button"
            variant={language === lng ? 'default' : 'outline'}
            aria-pressed={language === lng}
            className={cn(language === lng && 'pointer-events-none')}
            onClick={() => void setLanguage(lng)}
          >
            {t(`language.${lng}`)}
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
