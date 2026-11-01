import type { Page } from '@playwright/test'
import { PNG_1x1 } from './media-fakes.ts'

// YouTube faked at the network level (M23): the IFrame API script is replaced by a small player
// that knows the playlists below. The tests never call YouTube. Change `lists` between page loads
// to make a playlist "grow" (each load fetches the script again).

export type FakeVideo = { title: string; seconds: number; playable?: boolean }
export type FakeYouTube = {
  lists: Record<string, string[]>
  videos: Record<string, FakeVideo>
}

const PLAYER = String.raw`
(function () {
  var data = __DATA__
  var players = []
  window.__ytFake = { players: players }
  function info(id) { return data.videos[id] || null }
  function Player(element, options) {
    var self = this
    var vars = options.playerVars || {}
    this.events = options.events || {}
    this.list = vars.list ? data.lists[vars.list] || [] : null
    this.id = options.videoId || (this.list && this.list[0]) || null
    this.state = -1
    this.rate = 1
    this.base = Number(vars.start || 0)
    this.startedAt = null
    var frame = document.createElement('div')
    frame.className = 'yt-fake'
    frame.style.cssText = 'width:100%;height:100%;background:#111'
    element.replaceWith(frame)
    this.frame = frame
    players.push(this)
    this.timer = setInterval(function () {
      if (self.state === 1 && self.getCurrentTime() >= self.getDuration()) {
        self.base = self.getDuration()
        self.startedAt = null
        self.setState(0)
      }
    }, 100)
    setTimeout(function () {
      if (self.events.onReady) self.events.onReady({ target: self })
      self.checkPlayable()
    }, 30)
  }
  var P = Player.prototype
  P.setState = function (state) {
    this.state = state
    if (this.events.onStateChange) this.events.onStateChange({ data: state, target: this })
  }
  P.checkPlayable = function () {
    var self = this
    var video = info(this.id)
    if (this.id && (!video || video.playable === false))
      setTimeout(function () {
        if (self.events.onError) self.events.onError({ data: 150, target: self })
      }, 10)
  }
  P.getPlaylist = function () { return this.list }
  P.cueVideoById = function (options) {
    this.id = options.videoId
    this.base = options.startSeconds || 0
    this.startedAt = null
    this.setState(5)
    this.checkPlayable()
  }
  P.loadVideoById = function (options) {
    this.cueVideoById(options)
    if (info(this.id) && info(this.id).playable !== false) this.playVideo()
  }
  P.getVideoData = function () {
    var video = info(this.id)
    return video ? { video_id: this.id, title: video.title, isPlayable: video.playable !== false } : { video_id: this.id }
  }
  P.getDuration = function () { var video = info(this.id); return video ? video.seconds : 0 }
  P.getCurrentTime = function () {
    var at = this.base + (this.startedAt ? ((Date.now() - this.startedAt) / 1000) * this.rate : 0)
    return Math.min(at, this.getDuration())
  }
  P.playVideo = function () { this.startedAt = Date.now(); this.setState(1) }
  P.pauseVideo = function () { this.base = this.getCurrentTime(); this.startedAt = null; this.setState(2) }
  P.seekTo = function (seconds) { this.base = seconds; if (this.startedAt) this.startedAt = Date.now() }
  P.setPlaybackRate = function (rate) {
    this.base = this.getCurrentTime()
    if (this.startedAt) this.startedAt = Date.now()
    this.rate = rate
    if (this.events.onPlaybackRateChange) this.events.onPlaybackRateChange({ data: rate })
  }
  P.getPlaybackRate = function () { return this.rate }
  P.getPlayerState = function () { return this.state }
  P.getIframe = function () { return this.frame }
  P.destroy = function () { clearInterval(this.timer); this.frame.remove() }
  window.YT = { Player: Player, loaded: 1 }
  setTimeout(function () { if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady() }, 0)
})()
`

export async function fakeYouTube(page: Page, youtube: FakeYouTube) {
  await page.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: PLAYER.replace('__DATA__', JSON.stringify(youtube)),
    }),
  )
  // thumbnails
  await page.route('https://i.ytimg.com/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PNG_1x1 }),
  )
}
