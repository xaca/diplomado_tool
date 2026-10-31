import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ImageUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { ACCEPTED_TYPES, checkFile } from '@/features/assets/prepare-image'
import { logUploadFailure, UploadError } from '@/features/assets/upload'
import { useLanguage } from '@/features/auth/hooks'
import {
  cardPhoto,
  displayNameOf,
  photoSourceOf,
  saveProfile,
} from '@/features/profile/api'
import { removeAvatar, uploadAvatar } from '@/features/profile/avatar'
import { AvatarCropDialog } from '@/features/profile/components/AvatarCropDialog'
import { useProfile } from '@/features/profile/hooks'
import { StageAvatar } from '@/features/stages/components/StageAvatar'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { userProfileSchema, type PhotoSource, type UserDoc } from '@/model'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

export function ProfilePage() {
  const { t } = useTranslation()
  const profile = useProfile()
  const navigate = useNavigate()
  // Opened from the menu → back where I was; opened directly (new tab, reload) → home
  const fromInsideApp = useLocation().key !== 'default'

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <button
        type="button"
        onClick={() => (fromInsideApp ? navigate(-1) : navigate('/'))}
        className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t('common.back')}
      </button>
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
  const [photoSource, setPhotoSource] = useState<PhotoSource>(
    photoSourceOf(profile),
  )
  const [saving, setSaving] = useState(false)
  const [cropping, setCropping] = useState<ImageBitmap | null>(null)
  const [uploading, setUploading] = useState<number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  if (!user) return null
  const avatar = profile?.avatar ?? null
  const valid = userProfileSchema.safeParse({ name, photoSource }).success
  const shownName = name.trim() || displayNameOf(user, null)
  const preview = cardPhoto(user, { photoSource, avatar })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!user || !valid) return
    setSaving(true)
    try {
      const { skipped } = await saveProfile(user, { name, photoSource })
      toast.success(t('profile.saved'))
      if (skipped > 0) toast.info(t('profile.skipped', { count: skipped }))
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return
    if (checkFile(file)) return void toast.error(t('profile.uploadFailed'))
    try {
      setCropping(await createImageBitmap(file))
    } catch {
      toast.error(t('profile.uploadFailed'))
    }
  }

  function closeCrop() {
    cropping?.close()
    setCropping(null)
    setUploading(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function upload(photo: Blob) {
    if (!user) return
    setUploading(0)
    try {
      await uploadAvatar(user, photo, isTeacherRole(role), setUploading)
      setPhotoSource('upload')
      toast.success(t('profile.uploaded'))
      closeCrop()
    } catch (error) {
      logUploadFailure(error)
      toast.error(
        error instanceof UploadError && error.reason === 'forbidden'
          ? t('profile.uploadForbidden')
          : t('profile.uploadFailed'),
      )
      setUploading(null)
    }
  }

  async function remove() {
    if (!user) return
    setSaving(true)
    try {
      await removeAvatar(user)
      if (photoSource === 'upload') setPhotoSource('google')
      toast.success(t('profile.removed'))
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  const sources: { value: PhotoSource; label: string }[] = [
    { value: 'google', label: t('profile.photoGoogle') },
    { value: 'upload', label: t('profile.photoUpload') },
    { value: 'initials', label: t('profile.photoInitials') },
  ]

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
            <StageAvatar
              name={shownName}
              photoURL={preview}
              teacher={isTeacherRole(role)}
              size={48}
            />
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

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              {t('profile.photo')}
            </legend>
            <div
              role="radiogroup"
              aria-label={t('profile.photo')}
              className="flex flex-wrap gap-2"
            >
              {sources.map((source) => (
                <Button
                  key={source.value}
                  type="button"
                  role="radio"
                  aria-checked={photoSource === source.value}
                  variant={photoSource === source.value ? 'default' : 'outline'}
                  onClick={() =>
                    source.value === 'upload' && !avatar
                      ? fileInput.current?.click()
                      : setPhotoSource(source.value)
                  }
                >
                  {source.label}
                </Button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {t('profile.photoHint')}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={() => fileInput.current?.click()}
              >
                <ImageUp />
                {avatar ? t('profile.change') : t('profile.upload')}
              </Button>
              {avatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => void remove()}
                >
                  <Trash2 />
                  {t('profile.remove')}
                </Button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="hidden"
              data-testid="avatar-file"
              onChange={(event) => void pickFile(event.target.files?.[0])}
            />
          </fieldset>

          <Button
            type="submit"
            className="self-end"
            disabled={!valid || saving}
          >
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </form>
      </CardContent>
      {cropping && (
        <AvatarCropDialog
          bitmap={cropping}
          busy={uploading !== null}
          progress={uploading ?? 0}
          onCancel={closeCrop}
          onConfirm={(photo) => void upload(photo)}
        />
      )}
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
