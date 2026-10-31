import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cheerOn } from '@/features/fun/cheer'
import { saveCheer } from '@/features/profile/api'
import type { UserDoc } from '@/model'
import { useAuth } from '@/providers/auth-context'

/** "Mensajes de ánimo" on /me (M20): on unless the student turns it off. */
export function CheerSwitch({ profile }: { profile: UserDoc | null }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('fun.switch')}</CardTitle>
        <CardDescription>{t('fun.switchHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Label className="flex items-center gap-2 font-normal">
          <Switch
            checked={cheerOn(profile)}
            data-testid="cheer-switch"
            onCheckedChange={(next) => {
              if (!user) return
              saveCheer(user.uid, next).catch(() =>
                toast.error(t('errors.generic')),
              )
            }}
          />
          {t('fun.switch')}
        </Label>
      </CardContent>
    </Card>
  )
}
