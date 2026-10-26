import { Command, Option } from 'commander'
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

program.parseAsync().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
