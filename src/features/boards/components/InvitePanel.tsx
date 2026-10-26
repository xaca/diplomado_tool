import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { inviteUrl, setInviteEnabled } from '@/features/boards/api'
import type { WithId } from '@/lib/firestore-hooks'
import type { BoardDoc } from '@/model'

export function InvitePanel({ board }: { board: WithId<BoardDoc> }) {
  const { t } = useTranslation()
  const url = inviteUrl(board.joinCode)

  async function copy() {
    await navigator.clipboard.writeText(url)
    toast.success(t('invite.copied'))
  }

  async function toggle(enabled: boolean) {
    try {
      await setInviteEnabled(board.id, enabled)
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('invite.title')}</CardTitle>
        <CardDescription>{t('invite.hint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="invite-enabled"
            checked={board.joinCodeEnabled}
            onCheckedChange={(value) => void toggle(value)}
          />
          <Label htmlFor="invite-enabled">
            {board.joinCodeEnabled ? t('invite.enabled') : t('invite.disabled')}
          </Label>
        </div>
        {board.joinCodeEnabled && (
          <div className="flex gap-2">
            <Input
              readOnly
              value={url}
              aria-label={t('invite.link')}
              data-testid="invite-url"
            />
            <Button variant="outline" onClick={() => void copy()}>
              <Copy />
              {t('invite.copy')}
            </Button>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {t('invite.code')}:{' '}
          <span className="font-mono font-semibold tracking-widest">
            {board.joinCode}
          </span>
        </p>
      </CardContent>
    </Card>
  )
}
