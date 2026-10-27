import { execFileSync } from 'node:child_process'

// On Windows, `firebase emulators:exec` sometimes leaves the Java Firestore emulator running after
// it exits, and the next run fails with "port taken". This stops ONLY leftover Firebase emulator
// processes on the emulator ports; any other program on those ports is reported, never killed.

// 8788 = the Worker started by tests/integration/worker.ts (your own `wrangler dev` uses 8787)
const PORTS = [8080, 9099, 4000, 4400, 4500, 9150, 8788]
const EMULATOR_HINTS = [
  'cloud-firestore-emulator',
  'firebase-tools',
  'firebase\\emulators',
  'firebase/emulators',
  'workerd',
]

function listeners(): { port: number; pid: number; command: string }[] {
  if (process.platform === 'win32') {
    const script = `Get-NetTCPConnection -State Listen -LocalPort ${PORTS.join(',')} -ErrorAction SilentlyContinue | ForEach-Object { $c = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)").CommandLine; "$($_.LocalPort)|$($_.OwningProcess)|$c" }; exit 0`
    const output = execFileSync(
      'powershell',
      ['-NoProfile', '-Command', script],
      { encoding: 'utf8' },
    )
    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [port, pid, ...command] = line.split('|')
        return {
          port: Number(port),
          pid: Number(pid),
          command: command.join('|'),
        }
      })
  }
  try {
    const output = execFileSync(
      'lsof',
      [
        '-nP',
        ...PORTS.flatMap((port) => ['-iTCP:' + port]),
        '-sTCP:LISTEN',
        '-Fpn',
      ],
      {
        encoding: 'utf8',
      },
    )
    const pids = [...output.matchAll(/^p(\d+)/gm)].map((match) =>
      Number(match[1]),
    )
    return pids.map((pid) => ({
      port: 0,
      pid,
      command: execFileSync('ps', ['-o', 'command=', '-p', String(pid)], {
        encoding: 'utf8',
      }),
    }))
  } catch {
    return [] // lsof exits 1 when nothing is listening
  }
}

const seen = new Set<number>()
for (const { port, pid, command } of listeners()) {
  if (seen.has(pid)) continue
  seen.add(pid)
  if (EMULATOR_HINTS.some((hint) => command.toLowerCase().includes(hint))) {
    process.kill(pid)
    console.log(
      `✔ stopped leftover emulator/test process (pid ${pid}, port ${port})`,
    )
  } else {
    console.warn(
      `! port ${port} is used by another program (pid ${pid}); not touching it`,
    )
  }
}
