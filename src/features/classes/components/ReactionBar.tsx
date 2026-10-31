import { useTranslation } from 'react-i18next'
import { SmilePlus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { reactionCounts } from '@/features/classes/wall'
import { cn } from '@/lib/utils'
import { REACTIONS, type NoteReactions, type Reaction } from '@/model'

/**
 * A note's reactions (M10, D81): one chip per emoji with its count (hover: who), mine
 * highlighted; tapping a chip or the picker toggles mine. Read-only when `onReact` is missing.
 */
export function ReactionBar({
  reactions,
  uid,
  authorName,
  onReact,
  size = 'wall',
  label,
}: {
  reactions: NoteReactions | undefined
  uid: string | undefined
  authorName: string
  onReact?: (emoji: Reaction) => void
  size?: 'wall' | 'list'
  /** The picker's accessible name (default: "react to {author}'s note") */
  label?: string
}) {
  const { t } = useTranslation()
  const counts = reactionCounts(reactions, uid)
  const chip =
    size === 'wall'
      ? 'h-[clamp(16px,1.5cqw,24px)] px-[clamp(3px,0.4cqw,6px)] text-[clamp(9px,0.9cqw,13px)]'
      : 'h-6 px-1.5 text-xs'

  return (
    <div
      className="flex flex-wrap items-center gap-0.5"
      data-testid="reactions"
    >
      {counts.map((item) => (
        <button
          key={item.emoji}
          type="button"
          disabled={!onReact}
          onClick={() => onReact?.(item.emoji)}
          title={t('classes.reactedBy', {
            emoji: item.emoji,
            names: item.names.join(', '),
          })}
          aria-pressed={item.mine}
          aria-label={`${item.emoji} ${item.count}`}
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full border border-black/10 bg-white/70 leading-none tabular-nums',
            chip,
            item.mine && 'border-sky-500 bg-sky-100',
            onReact && 'hover:bg-white',
          )}
          data-testid="reaction"
          data-emoji={item.emoji}
        >
          <span aria-hidden>{item.emoji}</span>
          {item.count}
        </button>
      ))}
      {onReact && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'inline-flex items-center justify-center rounded-full text-black/50 hover:bg-white/70 hover:text-black/80',
              chip,
            )}
            aria-label={label ?? t('classes.react', { name: authorName })}
            data-testid="react"
          >
            <SmilePlus className="size-[1.1em]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="flex w-max min-w-0 gap-0.5 p-1">
            {REACTIONS.map((emoji) => (
              <DropdownMenuItem
                key={emoji}
                className="justify-center px-1.5 text-lg"
                aria-label={t('classes.reactWith', { emoji })}
                onClick={() => onReact(emoji)}
              >
                {emoji}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
