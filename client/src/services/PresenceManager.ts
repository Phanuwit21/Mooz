import { PlayerPresence } from '../../../types/PlayerPresence'
import { phaserEvents, Event } from '../events/EventCenter'
import Network from './Network'

const AFK_IDLE_MS = 5 * 60 * 1000

export default class PresenceManager {
  private current = PlayerPresence.ONLINE
  private idleTimer?: number

  constructor(private network: Network) {
    document.addEventListener('visibilitychange', () => this.evaluate())
    window.addEventListener('mousemove', () => this.onActivity(), { passive: true })
    window.addEventListener('mousedown', () => this.onActivity())
    window.addEventListener('keydown', () => this.onActivity())
    this.resetIdleTimer()
    this.sendPresence(PlayerPresence.ONLINE)
  }

  destroy() {
    clearTimeout(this.idleTimer)
  }

  private onActivity() {
    this.resetIdleTimer()
    if (document.visibilityState === 'visible') {
      this.sendPresence(PlayerPresence.ONLINE)
    }
  }

  private evaluate() {
    if (document.visibilityState === 'hidden') {
      this.sendPresence(PlayerPresence.AFK)
    } else {
      this.resetIdleTimer()
      this.sendPresence(PlayerPresence.ONLINE)
    }
  }

  private resetIdleTimer() {
    clearTimeout(this.idleTimer)
    this.idleTimer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        this.sendPresence(PlayerPresence.AFK)
      }
    }, AFK_IDLE_MS)
  }

  private sendPresence(presence: PlayerPresence) {
    if (this.current === presence) return
    this.current = presence
    this.network.updatePresence(presence)
    phaserEvents.emit(Event.MY_PLAYER_PRESENCE_CHANGE, presence)
  }
}
