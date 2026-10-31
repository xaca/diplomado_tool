import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LogOut, RefreshCw, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthActions, useLanguage } from '@/features/auth/hooks'
import { cardPhoto, displayNameOf } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { StageAvatar } from '@/features/stages/components/StageAvatar'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

export function UserMenu() {
  const { t } = useTranslation()
  const { user, role } = useAuth()
  const { signOut, switchAccount } = useAuthActions()
  const { language, setLanguage } = useLanguage()
  const profile = useProfile()
  const navigate = useNavigate()

  if (!user) return null

  const name = displayNameOf(user, profile.data)
  const photoURL = cardPhoto(user, profile.data)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={user.email ?? ''}
          />
        }
      >
        {/* Teachers wear the #DOCENTE ring (M12) */}
        <StageAvatar
          name={name}
          photoURL={photoURL}
          teacher={isTeacherRole(role)}
          size={32}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-xs font-normal text-muted-foreground">
              {t('auth.signedInAs')}
            </span>
            <span className="truncate">{name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
            {role && (
              <span className="text-xs font-normal text-muted-foreground">
                {t(`roles.${role}`)}
              </span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {t('language.label')}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={language}
            onValueChange={(value) => setLanguage(value as typeof language)}
          >
            {SUPPORTED_LANGUAGES.map((lng) => (
              <DropdownMenuRadioItem key={lng} value={lng}>
                {t(`language.${lng}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => void navigate('/me')}>
          <UserRound />
          {t('profile.title')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={switchAccount}>
          <RefreshCw />
          {t('auth.switchAccount')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut}>
          <LogOut />
          {t('auth.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
