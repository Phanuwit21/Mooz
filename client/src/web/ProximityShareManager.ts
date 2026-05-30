import Peer from 'peerjs'
import store from '../stores'
import {
  setProximityMyStream,
  addProximityShareStream,
  removeProximityShareStream,
} from '../stores/ProximityShareStore'
import { sanitizeId } from '../util'

const MAX_SHARE_ATTEMPTS = 8
const SHARE_RETRY_MS = 1500

function findSessionIdFromPeer(peerId: string): string | undefined {
  const map = store.getState().user.playerNameMap
  for (const sessionId of map.keys()) {
    if (`${sanitizeId(sessionId)}-pss` === peerId) {
      return sessionId
    }
  }
  if (peerId === `${sanitizeId(store.getState().user.sessionId)}-pss`) {
    return store.getState().user.sessionId
  }
  return undefined
}

function ownerNameFor(sessionId: string) {
  const map = store.getState().user.playerNameMap
  return map.get(sessionId) || map.get(sanitizeId(sessionId)) || 'Guest'
}

export default class ProximityShareManager {
  private peer: Peer
  myStream?: MediaStream
  private outboundCalls = new Map<string, Peer.MediaConnection>()
  private shareRetryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private whenPeerOpen: (() => void)[] = []
  private peerReady = false

  constructor(private userId: string) {
    this.peer = new Peer(`${sanitizeId(userId)}-pss`)
    this.peer.on('error', (err) => console.error('ProximityShare', err))

    this.peer.on('disconnected', () => {
      this.peerReady = false
      this.peer.reconnect()
    })

    this.peer.on('open', () => {
      this.peerReady = true
      this.whenPeerOpen.splice(0).forEach((fn) => fn())
    })

    this.peer.on('call', (call) => {
      call.answer(this.myStream || undefined)

      call.on('stream', (stream) => {
        const sharerId = findSessionIdFromPeer(call.peer)
        if (!sharerId) return
        store.dispatch(
          addProximityShareStream({
            id: sharerId,
            call,
            stream,
            ownerName: ownerNameFor(sharerId),
          })
        )
      })

      call.on('close', () => {
        const sharerId = findSessionIdFromPeer(call.peer)
        if (sharerId) store.dispatch(removeProximityShareStream(sharerId))
      })
    })
  }

  private runWhenPeerOpen(fn: () => void) {
    if (this.peerReady) {
      fn()
    } else {
      this.whenPeerOpen.push(fn)
    }
  }

  startShare() {
    return navigator.mediaDevices
      ?.getDisplayMedia({ video: true, audio: true })
      .then((stream) => {
        stream.getVideoTracks()[0]?.addEventListener('ended', () => this.stopShare())
        this.myStream = stream
        store.dispatch(setProximityMyStream(stream))
        return stream
      })
  }

  stopShare() {
    this.shareRetryTimers.forEach((timer) => clearTimeout(timer))
    this.shareRetryTimers.clear()
    this.outboundCalls.forEach((call) => call.close())
    this.outboundCalls.clear()
    this.myStream?.getTracks().forEach((t) => t.stop())
    this.myStream = undefined
    store.dispatch(setProximityMyStream(null))
  }

  shareToViewer(viewerSessionId: string, attempt = 0) {
    if (!this.myStream || viewerSessionId === this.userId) return

    const retryKey = `viewer:${viewerSessionId}`
    const existingTimer = this.shareRetryTimers.get(retryKey)
    if (existingTimer) clearTimeout(existingTimer)

    this.runWhenPeerOpen(() => {
      const existing = this.outboundCalls.get(viewerSessionId)
      if (existing) {
        existing.close()
        this.outboundCalls.delete(viewerSessionId)
      }

      const call = this.peer.call(`${sanitizeId(viewerSessionId)}-pss`, this.myStream!)
      this.outboundCalls.set(viewerSessionId, call)

      const scheduleRetry = () => {
        if (attempt + 1 >= MAX_SHARE_ATTEMPTS) return
        const timer = setTimeout(() => {
          this.shareRetryTimers.delete(retryKey)
          this.shareToViewer(viewerSessionId, attempt + 1)
        }, SHARE_RETRY_MS)
        this.shareRetryTimers.set(retryKey, timer)
      }

      call.on('error', (err) => {
        console.error('shareToViewer', err)
        scheduleRetry()
      })

      call.on('close', () => {
        this.outboundCalls.delete(viewerSessionId)
      })
    })
  }

  stopShareToViewer(viewerSessionId: string) {
    const retryKey = `viewer:${viewerSessionId}`
    const timer = this.shareRetryTimers.get(retryKey)
    if (timer) {
      clearTimeout(timer)
      this.shareRetryTimers.delete(retryKey)
    }
    const call = this.outboundCalls.get(viewerSessionId)
    call?.close()
    this.outboundCalls.delete(viewerSessionId)
  }
}
