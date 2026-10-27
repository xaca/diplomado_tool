import { createInterface } from 'node:readline/promises'
import { Command, Option } from 'commander'
import { formatBytes } from '@/features/storage/analysis'
import {
  archiveBoard,
  backupBoard,
  boardCounts,
  cleanupBoard,
  listBoards,
  purgeBoard,
  restoreBoard,
} from './boards.ts'
import { cloudinaryUsage } from './cloudinary.ts'
import { projectId } from './firebase.ts'
import { addStaff, listStaff, removeStaff, setupAdmin } from './staff.ts'

// Admin CLI — `npm run admin -- <command>`. See PLAN.md → "Admin CLI".

const program = new Command()
  .name('admin')
  .description(`diplomado_pbl admin tasks (project: ${projectId})`)

program
  .command('setup')
  .description(
    'First-run setup: make this email the admin (teacher). Run once.',
  )
  .requiredOption('--email <email>', 'your Gmail')
  .option('--name <name>', 'display name', 'Admin')
  .action(async ({ email, name }: { email: string; name: string }) => {
    const saved = await setupAdmin(email, name)
    console.log(
      `✔ ${saved} is now admin of ${projectId}. Sign in with this Google account to open the teacher dashboard.`,
    )
  })

const staff = program
  .command('staff')
  .description('Manage the teacher list (staffEmails)')

staff
  .command('list')
  .description('List teachers and admins')
  .action(async () => {
    const rows = await listStaff()
    if (rows.length === 0)
      console.log(
        'No teachers yet. Run: npm run admin -- setup --email <your gmail>',
      )
    else
      console.table(
        rows.map(({ email, role, displayName }) => ({
          email,
          role,
          displayName,
        })),
      )
  })

staff
  .command('add <email>')
  .description('Add a teacher (or admin) by email')
  .addOption(
    new Option('--role <role>', 'role')
      .choices(['teacher', 'admin'])
      .default('teacher'),
  )
  .option('--name <name>', 'display name', '')
  .action(
    async (
      email: string,
      { role, name }: { role: 'teacher' | 'admin'; name: string },
    ) => {
      const saved = await addStaff(email, role, name, 'cli')
      console.log(`✔ ${saved} added as ${role}`)
    },
  )

staff
  .command('remove <email>')
  .description('Remove a teacher by email (the last admin cannot be removed)')
  .action(async (email: string) => {
    const removed = await removeStaff(email)
    console.log(`✔ ${removed} removed`)
  })

// ---------- M7: lifecycle, cleanup, backups, usage ----------

const board = program
  .command('board')
  .description('Board lifecycle: archive, restore, purge')

board
  .command('archive <boardId>')
  .description('Archive now: read-only, listed under "Proyectos archivados"')
  .action(async (boardId: string) => {
    await archiveBoard(boardId)
    console.log(`✔ ${boardId} archived`)
  })

board
  .command('restore <boardId>')
  .description('Back to active (counts as activity)')
  .action(async (boardId: string) => {
    await restoreBoard(boardId)
    console.log(`✔ ${boardId} restored`)
  })

board
  .command('purge <boardId>')
  .description(
    'Delete an ARCHIVED board forever: writes a backup to backups/ first, then images and data',
  )
  .option('--yes', 'skip the confirmation (scripts and tests)')
  .option('--backup-dir <dir>', 'where to write the backup')
  .action(
    async (
      boardId: string,
      { yes, backupDir }: { yes?: boolean; backupDir?: string },
    ) => {
      const [info] = (await listBoards()).filter((b) => b.id === boardId)
      if (!info) throw new Error(`Board not found: ${boardId}`)
      if (!yes) {
        const prompt = createInterface({
          input: process.stdin,
          output: process.stdout,
        })
        const answer = await prompt.question(
          `Type the board title to purge "${info.title}" forever: `,
        )
        prompt.close()
        if (answer.trim() !== info.title)
          throw new Error('Title does not match: nothing was deleted')
      }
      const result = await purgeBoard(boardId, backupDir)
      console.log(`✔ Backup: ${result.backup}`)
      console.log(
        `✔ ${boardId} purged: ${result.images} images, ${result.documents} documents`,
      )
    },
  )

program
  .command('backup <boardId>')
  .description(
    'Write the board backup (JSON, same as the dashboard) to backups/',
  )
  .option('--dir <dir>', 'output folder')
  .action(async (boardId: string, { dir }: { dir?: string }) => {
    console.log(`✔ ${await backupBoard(boardId, dir)}`)
  })

program
  .command('cleanup')
  .description(
    'Delete unused images (not in any slide or cover, older than 24 h)',
  )
  .option('--board <boardId>', 'one board')
  .option('--all', 'every board')
  .option('--dry-run', 'only list what would be deleted')
  .action(
    async ({
      board: boardId,
      all,
      dryRun = false,
    }: {
      board?: string
      all?: boolean
      dryRun?: boolean
    }) => {
      if (!boardId === !all) throw new Error('Use --board <id> or --all')
      const ids = all ? (await listBoards()).map((b) => b.id) : [boardId!]
      for (const id of ids) {
        const { unused, deleted } = await cleanupBoard(id, dryRun)
        const bytes = unused.reduce((sum, asset) => sum + asset.bytes, 0)
        if (dryRun) {
          console.log(
            `${id}: ${unused.length} unused images (${formatBytes(bytes, 'en')})`,
          )
          for (const asset of unused)
            console.log(
              `  - ${asset.publicId} (${asset.kind}, ${asset.status})`,
            )
        } else {
          console.log(
            `✔ ${id}: ${deleted} of ${unused.length} unused images deleted`,
          )
        }
      }
    },
  )

program
  .command('usage')
  .description('Cloudinary credits this month + Firestore documents per board')
  .action(async () => {
    try {
      const usage = await cloudinaryUsage()
      console.log(
        `Cloudinary: ${usage.used} of ${usage.limit} credits (${Math.round(usage.percent)} %), ` +
          `${formatBytes(usage.storageBytes, 'en')} stored, ${formatBytes(usage.bandwidthBytes, 'en')} served`,
      )
    } catch (error) {
      console.log(
        `Cloudinary: unavailable (${error instanceof Error ? error.message : String(error)})`,
      )
    }
    console.table(await boardCounts())
  })

program.parseAsync().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
