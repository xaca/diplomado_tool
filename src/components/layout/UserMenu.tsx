import { useTranslation } from 'react-i18next'
import { LogOut, RefreshCw } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'
import { initials } from '@/lib/initials'
import { useAuth } from '@/providers/auth-context'

export function UserMenu() {
  const { t } = useTranslation()
  const { user, role } = useAuth()
  const { signOut, switchAccount } = useAuthActions()
  const { language, setLanguage } = useLanguage()

  if (!user) return null

  const fallback = initials(user.displayName ?? user.email ?? '')

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
        <Avatar>
          <AvatarImage
            src={user.photoURL ?? undefined}
            alt=""
            referrerPolicy="no-referrer"
          />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-xs font-normal text-muted-foreground">
              {t('auth.signedInAs')}
            </span>
            <span className="truncate">{user.email}</span>
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
