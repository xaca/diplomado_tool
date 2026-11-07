import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SaveButton } from '@/components/save/SaveButton'
import { useSaveLock } from '@/components/save/use-save-lock'
import { adminTabPath } from '@/features/boards/admin-tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createBoard } from '@/features/boards/api'
import { boardInputSchema } from '@/model'
import { useAuth } from '@/providers/auth-context'

export function CreateBoardDialog() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const lock = useSaveLock()

  const valid = boardInputSchema.safeParse({ title, description }).success

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const email = user?.email
    if (!email || !valid) return
    await lock.run(async () => {
      try {
        const boardId = await createBoard(email, { title, description })
        toast.success(t('boards.created'))
        setOpen(false)
        setTitle('')
        setDescription('')
        // A new board starts empty: open it where students are added (M24)
        navigate(adminTabPath(boardId, 'students'))
      } catch {
        toast.error(t('errors.generic'))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        {t('boards.new')}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('boards.new')}</DialogTitle>
            <DialogDescription>{t('boards.newHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="board-title">{t('boards.title')}</Label>
            <Input
              id="board-title"
              value={title}
              maxLength={120}
              placeholder={t('boards.titlePlaceholder')}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="board-description">{t('boards.description')}</Label>
            <Textarea
              id="board-description"
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <SaveButton type="submit" lock={lock} disabled={!valid}>
              {t('boards.create')}
            </SaveButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
