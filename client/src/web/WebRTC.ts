import Peer from 'peerjs'
import Network from '../services/Network'
import store from '../stores'
import { setVideoConnected } from '../stores/UserStore'
import { sanitizeId } from '../util'

type VideoEntry = {
  call: Peer.MediaConnection
  wrapper: HTMLDivElement
}

export default class WebRTC {
  private myPeer: Peer
  private peers = new Map<string, VideoEntry>()
  private onCalledPeers = new Map<string, VideoEntry>()
  private peersRow = document.querySelector('.video-peers-row')
  private localPip = document.querySelector('.video-local-pip')
  private buttonGrid = document.querySelector('.button-grid')
  private myVideo = document.createElement('video')
  private myStream?: MediaStream
  private network: Network

  constructor(userId: string, network: Network) {
    const sanitizedId = this.replaceInvalidId(userId)
    this.myPeer = new Peer(sanitizedId)
    this.network = network
    this.myPeer.on('error', (err) => {
      console.error(err)
    })

    this.myVideo.muted = true
    this.initialize()
  }

  private replaceInvalidId(userId: string) {
    return sanitizeId(userId)
  }

  private getDisplayName(peerId: string) {
    return store.getState().user.playerNameMap.get(peerId) || 'Guest'
  }

  initialize() {
    this.myPeer.on('call', (call) => {
      if (!this.onCalledPeers.has(call.peer)) {
        call.answer(this.myStream)
        const { wrapper } = this.createVideoCard(call.peer, this.getDisplayName(call.peer))
        this.onCalledPeers.set(call.peer, { call, wrapper })

        call.on('stream', (userVideoStream) => {
          this.attachStream(wrapper, userVideoStream)
        })
      }
    })
  }

  checkPreviousPermission() {
    const permissionName = 'microphone' as PermissionName
    navigator.permissions?.query({ name: permissionName }).then((result) => {
      if (result.state === 'granted') this.getUserMedia(false)
    })
  }

  getUserMedia(alertOnError = true) {
    navigator.mediaDevices
      ?.getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        this.myStream = stream
        const myId = sanitizeId(this.network.mySessionId)
        const { wrapper } = this.createVideoCard(myId, 'You', true)
        this.attachStream(wrapper, this.myStream)
        this.setUpButtons()
        store.dispatch(setVideoConnected(true))
        this.network.videoConnected()
      })
      .catch(() => {
        if (alertOnError) window.alert('No webcam or microphone found, or permission is blocked')
      })
  }

  connectToNewUser(userId: string) {
    if (!this.myStream) return

    const sanitizedId = this.replaceInvalidId(userId)
    if (this.peers.has(sanitizedId)) return

    const call = this.myPeer.call(sanitizedId, this.myStream)
    const { wrapper } = this.createVideoCard(sanitizedId, this.getDisplayName(sanitizedId))
    this.peers.set(sanitizedId, { call, wrapper })

    call.on('stream', (userVideoStream) => {
      this.attachStream(wrapper, userVideoStream)
    })
  }

  private createVideoCard(peerId: string, displayName: string, local = false) {
    const wrapper = document.createElement('div')
    wrapper.className = local ? 'video-card video-card--local' : 'video-card video-card--peer'
    wrapper.dataset.peerId = peerId

    const video = document.createElement('video')
    video.playsInline = true
    video.muted = local

    const label = document.createElement('div')
    label.className = 'video-card__label'
    label.textContent = displayName

    wrapper.appendChild(video)
    wrapper.appendChild(label)

    const container = local ? this.localPip : this.peersRow
    container?.appendChild(wrapper)

    return { wrapper, video }
  }

  private attachStream(wrapper: HTMLDivElement, stream: MediaStream) {
    const video = wrapper.querySelector('video')
    if (!video) return

    video.srcObject = stream
    video.addEventListener('loadedmetadata', () => {
      video.play()
    })
  }

  deleteVideoStream(userId: string) {
    const sanitizedId = this.replaceInvalidId(userId)
    const peer = this.peers.get(sanitizedId)
    if (!peer) return
    peer.call.close()
    peer.wrapper.remove()
    this.peers.delete(sanitizedId)
  }

  deleteOnCalledVideoStream(userId: string) {
    const sanitizedId = this.replaceInvalidId(userId)
    const onCalledPeer = this.onCalledPeers.get(sanitizedId)
    if (!onCalledPeer) return
    onCalledPeer.call.close()
    onCalledPeer.wrapper.remove()
    this.onCalledPeers.delete(sanitizedId)
  }

  setPeerVolume(userId: string, volume: number) {
    const sanitizedId = this.replaceInvalidId(userId)
    const entry = this.peers.get(sanitizedId) ?? this.onCalledPeers.get(sanitizedId)
    if (!entry) return

    const clamped = Math.max(0, Math.min(1, volume))
    const video = entry.wrapper.querySelector('video')
    if (video) {
      video.volume = clamped
    }
    entry.wrapper.style.opacity = String(0.25 + 0.75 * clamped)
  }

  isAudioEnabled(): boolean {
    return this.myStream?.getAudioTracks()[0]?.enabled ?? false
  }

  isVideoEnabled(): boolean {
    return this.myStream?.getVideoTracks()[0]?.enabled ?? false
  }

  toggleAudio(): void {
    const track = this.myStream?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
  }

  toggleVideo(): void {
    const track = this.myStream?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
  }

  /** Media UI is React MediaControlBar — clear legacy DOM slot. */
  setUpButtons() {
    if (this.buttonGrid) this.buttonGrid.replaceChildren()
  }
}
