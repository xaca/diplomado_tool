import { describe, expect, it } from 'vitest'
import {
  formatTime,
  isWatched,
  mergePlaylist,
  missingInfo,
  nextProgress,
  nextUnwatched,
  parsePlaylistLink,
  progressPercent,
  resumeAt,
  sameVideos,
  shouldSave,
  shownVideos,
  watchedCounts,
} from '@/features/recordings/recordings'
import type { RecordingVideo } from '@/model'

const video = (
  id: string,
  overrides: Partial<RecordingVideo> = {},
): RecordingVideo => ({
  id,
  title: `Clase ${id}`,
  seconds: 3600,
  playable: true,
  ...overrides,
})

describe('parsePlaylistLink', () => {
  it('finds the list in playlist links, video links, youtu.be links and bare ids', () => {
    const id = 'PLO2HxDUbp3FU'
    for (const input of [
      `https://www.youtube.com/playlist?list=${id}`,
      `https://www.youtube.com/watch?v=VB-lKjtbZk8&list=${id}`,
      `https://www.youtube.com/watch?v=VB-lKjtbZk8&list=${id}&index=7`,
      `youtube.com/playlist?list=${id}`,
      `https://m.youtube.com/playlist?list=${id}`,
      `https://youtu.be/VB-lKjtbZk8?list=${id}`,
      `  ${id}  `,
    ])
      expect(parsePlaylistLink(input)).toEqual({ ok: true, listId: id })
  })

  it('refuses empty text, links without a list, other sites, and personal or generated lists', () => {
    expect(parsePlaylistLink(' ')).toEqual({ ok: false, reason: 'empty' })
    expect(
      parsePlaylistLink('https://www.youtube.com/watch?v=VB-lKjtbZk8'),
    ).toEqual({ ok: false, reason: 'noList' })
    expect(parsePlaylistLink('https://vimeo.com/x?list=PLO2HxDUbp3FU')).toEqual(
      { ok: false, reason: 'noList' },
    )
    expect(parsePlaylistLink('hola mundo')).toEqual({
      ok: false,
      reason: 'noList',
    })
    for (const list of ['WL', 'LL', 'RDOFDzN91VJwY'])
      expect(
        parsePlaylistLink(`https://www.youtube.com/watch?v=x&list=${list}`).ok,
      ).toBe(false)
  })
})

describe('mergePlaylist', () => {
  it("follows YouTube's order, keeps what was known, adds new videos and drops removed ones", () => {
    const saved = [video('a'), video('b'), video('c')]
    const merged = mergePlaylist(
      saved,
      ['a', 'c', 'd'],
      new Map([['d', video('d', { title: 'Nueva', seconds: 100 })]]),
    )
    expect(merged.map((v) => v.id)).toEqual(['a', 'c', 'd'])
    expect(merged[2]).toEqual(video('d', { title: 'Nueva', seconds: 100 }))
    expect(merged[0]).toEqual(video('a'))
  })

  it('a new video not read yet waits with no title; repeated ids appear once', () => {
    const merged = mergePlaylist([], ['x', 'x'])
    expect(merged).toEqual([{ id: 'x', title: '', seconds: 0, playable: true }])
  })

  it('missingInfo: new videos and ones without a title or length', () => {
    const saved = [video('a'), video('b', { seconds: 0 })]
    expect(missingInfo(saved, ['a', 'b', 'c'])).toEqual(['b', 'c'])
  })

  it('sameVideos compares the lists field by field', () => {
    expect(sameVideos([video('a')], [video('a')])).toBe(true)
    expect(sameVideos([video('a')], [video('a', { seconds: 1 })])).toBe(false)
    expect(sameVideos([video('a')], [])).toBe(false)
  })
})

describe('shownVideos', () => {
  const recording = { titles: { b: 'Clase 2: Personas' }, hidden: ['c'] }
  const videos = [video('a'), video('b'), video('c')]

  it("uses the teacher's titles, numbers in playlist order, hides hidden ones", () => {
    const shown = shownVideos(recording, videos)
    expect(shown.map((v) => [v.id, v.number, v.title])).toEqual([
      ['a', 1, 'Clase a'],
      ['b', 2, 'Clase 2: Personas'],
    ])
  })

  it('the teacher can see the hidden ones too', () => {
    const shown = shownVideos(recording, videos, true)
    expect(shown.map((v) => [v.id, v.hidden])).toEqual([
      ['a', false],
      ['b', false],
      ['c', true],
    ])
  })
})

describe('time and progress', () => {
  it('formats times with or without hours', () => {
    expect(formatTime(42)).toBe('0:42')
    expect(formatTime(23 * 60 + 10)).toBe('23:10')
    expect(formatTime(13693)).toBe('3:48:13')
    expect(formatTime(-3)).toBe('0:00')
  })

  it('watched at 90 %, never with an unknown length', () => {
    expect(isWatched(899, 1000)).toBe(false)
    expect(isWatched(900, 1000)).toBe(true)
    expect(isWatched(900, 0)).toBe(false)
  })

  it('resumes where I left off, except near the start or the end', () => {
    expect(resumeAt(undefined)).toBe(0)
    expect(resumeAt({ at: 3, seconds: 1000, watched: false })).toBe(0)
    expect(resumeAt({ at: 610.7, seconds: 1000, watched: false })).toBe(610)
    expect(resumeAt({ at: 980, seconds: 1000, watched: true })).toBe(0)
  })

  it('"watched" never goes back; the length is kept when YouTube does not give it', () => {
    const done = nextProgress(undefined, 950, 1000)
    expect(done).toEqual({ at: 950, seconds: 1000, watched: true })
    expect(nextProgress(done, 10, 0)).toEqual({
      at: 10,
      seconds: 1000,
      watched: true,
    })
  })

  it('percent for the bar', () => {
    expect(progressPercent(undefined)).toBe(0)
    expect(progressPercent({ at: 250, seconds: 1000, watched: false })).toBe(25)
    expect(progressPercent({ at: 10, seconds: 1000, watched: true })).toBe(100)
    expect(progressPercent({ at: 10, seconds: 0, watched: false })).toBe(0)
  })

  it('saves on pause, end and leave; while playing once a minute', () => {
    expect(shouldSave('tick', 0, 59_000)).toBe(false)
    expect(shouldSave('tick', 0, 60_000)).toBe(true)
    expect(shouldSave('pause', 0, 1)).toBe(true)
    expect(shouldSave('leave', 0, 1)).toBe(true)
    expect(shouldSave('end', 0, 1)).toBe(true)
  })
})

describe('next and counts', () => {
  const videos = [video('a'), video('b', { playable: false }), video('c')]
  const progress = { a: { at: 3600, seconds: 3600, watched: true } }

  it('the next unwatched, playable video', () => {
    expect(nextUnwatched(videos, progress)?.id).toBe('c')
    expect(nextUnwatched(videos, undefined)?.id).toBe('a')
    expect(nextUnwatched(videos, progress, 'c')).toBeNull()
  })

  it('how many watched each video', () => {
    const counts = watchedCounts([
      { videos: progress },
      {
        videos: {
          a: { at: 3500, seconds: 3600, watched: true },
          c: { at: 10, seconds: 3600, watched: false },
        },
      },
      {},
    ])
    expect(counts.get('a')).toBe(2)
    expect(counts.get('c')).toBeUndefined()
  })
})
