import Phaser from 'phaser'

// import { debugDraw } from '../utils/debug'
import { createCharacterAnims } from '../anims/CharacterAnims'

import Item from '../items/Item'
import Computer from '../items/Computer'
import Whiteboard from '../items/Whiteboard'
import '../characters/MyPlayer'
import '../characters/OtherPlayer'
import MyPlayer from '../characters/MyPlayer'
import OtherPlayer, { VIDEO_PROXIMITY_RADIUS } from '../characters/OtherPlayer'
import PlayerSelector from '../characters/PlayerSelector'
import Network from '../services/Network'
import PrivateAreaManager from '../services/PrivateAreaManager'
import SpotlightAreaManager from '../services/SpotlightAreaManager'
import DeskAreaManager from '../services/DeskAreaManager'
import { proximityStrength } from '../util/proximity'
import { clearProximityShareStreams } from '../stores/ProximityShareStore'
import { IPlayer } from '../../../types/IOfficeState'
import { ItemType } from '../../../types/Items'
import { OPEN_OFFICE_AREA_ID, OPEN_OFFICE_AREA_NAME } from '../../../types/PrivateArea'

import store from '../stores'
import { setFocused, setShowChat } from '../stores/ChatStore'
import { NavKeys, Keyboard } from '../../../types/KeyboardState'
import { PlayerPresence } from '../../../types/PlayerPresence'
import { Event, phaserEvents } from '../events/EventCenter'

/** Must match server/rooms/SkyOffice.ts slot counts (one zone per tile cluster). */
const SERVER_COMPUTER_SLOTS = 11
const SERVER_WHITEBOARD_SLOTS = 2

export default class Game extends Phaser.Scene {
  network!: Network
  private cursors!: NavKeys
  private keyE!: Phaser.Input.Keyboard.Key
  private keyR!: Phaser.Input.Keyboard.Key
  private map!: Phaser.Tilemaps.Tilemap
  myPlayer!: MyPlayer
  private playerSelector!: PlayerSelector
  private otherPlayers!: Phaser.Physics.Arcade.Group
  private otherPlayerMap = new Map<string, OtherPlayer>()
  computerMap = new Map<string, Computer>()
  private whiteboardMap = new Map<string, Whiteboard>()
  private privateAreaManager!: PrivateAreaManager
  private spotlightManager!: SpotlightAreaManager
  private deskManager!: DeskAreaManager
  private deskLabels: Phaser.GameObjects.Text[] = []
  private computersGroup!: Phaser.Physics.Arcade.StaticGroup
  private whiteboardsGroup!: Phaser.Physics.Arcade.StaticGroup
  private followTargetId: string | null = null
  private lastVideoSyncAt = 0

  constructor() {
    super('game')
  }

  registerKeys() {
    this.cursors = {
      ...this.input.keyboard.createCursorKeys(),
      ...(this.input.keyboard.addKeys('W,S,A,D') as Keyboard),
    }

    // maybe we can have a dedicated method for adding keys if more keys are needed in the future
    this.keyE = this.input.keyboard.addKey('E')
    this.keyR = this.input.keyboard.addKey('R')
    this.input.keyboard.disableGlobalCapture()
    this.input.keyboard.on('keydown-ENTER', (event) => {
      store.dispatch(setShowChat(true))
      store.dispatch(setFocused(true))
    })
    this.input.keyboard.on('keydown-ESC', (event) => {
      store.dispatch(setShowChat(false))
    })
  }

  disableKeys() {
    this.input.keyboard.enabled = false
  }

  enableKeys() {
    this.input.keyboard.enabled = true
  }

  create(data: { network: Network }) {
    if (!data.network) {
      throw new Error('server instance missing')
    } else {
      this.network = data.network
    }

    createCharacterAnims(this.anims)

    this.map = this.make.tilemap({ key: 'tilemap' })
    this.privateAreaManager = new PrivateAreaManager(this.map)
    this.spotlightManager = new SpotlightAreaManager(this.map)
    this.deskManager = new DeskAreaManager(this.map)
    if (this.deskManager.hasDesks()) {
      this.createDeskLabels()
    }
    const allTilesets = this.loadAllMapTilesets()

    const groundLayer = this.map.createLayer('Ground', allTilesets)
    if (groundLayer) {
      groundLayer.setCollisionBetween(1, 99999)
    }
    // debugDraw(groundLayer, this)

    this.myPlayer = this.add.myPlayer(960, 752, 'adam', this.network.mySessionId)
    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels)
    this.myPlayer.setCollideWorldBounds(true)
    ;(this.myPlayer.playerContainer.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true)
    if (groundLayer) {
      this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], groundLayer)
    }

    const wallLayer = this.map.createLayer('Wall', allTilesets)
    if (wallLayer) {
      wallLayer.setCollisionBetween(1, 99999)
      this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], wallLayer)
    }
    this.map.createLayer('Chairs', allTilesets)
    const objectsLayer = this.map.createLayer('Objects', allTilesets)
    if (objectsLayer) {
      objectsLayer.setCollisionBetween(1, 99999)
      this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], objectsLayer)
    }
    const objectsOnCollideLayer = this.map.createLayer('ObjectsOnCollide', allTilesets)
    if (objectsOnCollideLayer) {
      objectsOnCollideLayer.setCollisionBetween(1, 99999)
      this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], objectsOnCollideLayer)
    }
    this.map.createLayer('GenericObjects', allTilesets)
    const genericObjectsOnCollideLayer = this.map.createLayer('GenericObjectsOnCollide', allTilesets)
    if (genericObjectsOnCollideLayer) {
      genericObjectsOnCollideLayer.setCollisionBetween(1, 99999)
      this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], genericObjectsOnCollideLayer)
    }
    const genericObjectsCollideLayer = this.map.createLayer('GenericObjectsCollide', allTilesets)
    if (genericObjectsCollideLayer) {
      genericObjectsCollideLayer.setCollisionBetween(1, 99999)
      this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], genericObjectsCollideLayer)
    }
    const computerTileLayer = this.map.createLayer('Computer', allTilesets)
    const whiteboardTileLayer = this.map.createLayer('Whiteboard', allTilesets)
    this.map.createLayer('Basement', allTilesets)
    this.map.createLayer('VendingMachine', allTilesets)

    this.computersGroup = this.physics.add.staticGroup({ classType: Computer })
    this.whiteboardsGroup = this.physics.add.staticGroup({ classType: Whiteboard })
    if (computerTileLayer) {
      this.spawnInteractablesFromLayer(computerTileLayer, 'Computer', this.computersGroup, 'computers', (item, id) => {
        const computer = item as Computer
        computer.setDepth(computer.y + computer.height * 0.27)
        computer.id = id
        this.computerMap.set(id, computer)
      })
    }
    if (whiteboardTileLayer) {
      this.spawnInteractablesFromLayer(whiteboardTileLayer, 'Whiteboard', this.whiteboardsGroup, 'whiteboards', (item, id) => {
        const whiteboard = item as Whiteboard
        whiteboard.id = id
        this.whiteboardMap.set(id, whiteboard)
      })
    }

    this.playerSelector = new PlayerSelector(this, 0, 0, 32, 32)

    this.otherPlayers = this.physics.add.group({ classType: OtherPlayer })

    this.cameras.main.zoom = 1.5
    this.cameras.main.startFollow(this.myPlayer, true)

    // register network event listeners
    this.network.onPlayerJoined(this.handlePlayerJoined, this)
    this.network.onPlayerLeft(this.handlePlayerLeft, this)
    this.network.onMyPlayerReady(this.handleMyPlayerReady, this)
    this.network.onMyPlayerVideoConnected(this.handleMyVideoConnected, this)
    this.network.onPlayerUpdated(this.handlePlayerUpdated, this)
    this.network.onItemUserAdded(this.handleItemUserAdded, this)
    this.network.onItemUserRemoved(this.handleItemUserRemoved, this)
    this.network.onChatMessageAdded(this.handleChatMessageAdded, this)

    phaserEvents.on(Event.MY_PLAYER_PRESENCE_CHANGE, this.handleMyPresenceChange, this)

    this.network.syncPlayersToScene()
  }

  private loadAllMapTilesets(): Phaser.Tilemaps.Tileset[] {
    const imageKeyByName: Record<string, string> = {
      FloorAndGround: 'tiles_wall',
      Modern_Office_Black_Shadow: 'Modern_Office_Black_Shadow',
      Interiors_free_32x32: 'Interiors_free_32x32',
      Basement: 'Basement',
      chair: 'chair',
    }

    const tilesets: Phaser.Tilemaps.Tileset[] = []

    // Bind by tileset index — duplicate names (2× Interiors / Modern) break addTilesetImage.
    for (const tileset of this.map.tilesets) {
      const imageKey = imageKeyByName[tileset.name] ?? tileset.name
      if (!this.textures.exists(imageKey)) {
        console.warn(`Missing texture for tileset "${tileset.name}" (key: ${imageKey})`)
        continue
      }

      tileset.setImage(this.textures.get(imageKey))
      tilesets.push(tileset)
    }

    return tilesets
  }

  /** Invisible interact zones on item tile layers (map tiles stay visible). */
  private spawnInteractablesFromLayer(
    layer: Phaser.Tilemaps.TilemapLayer,
    layerId: string,
    group: Phaser.Physics.Arcade.StaticGroup,
    textureKey: string,
    configure: (item: Item, id: string) => void
  ) {
    const minSpacing = layerId === 'Computer' ? 72 : 56
    const serverSlots = layerId === 'Computer' ? SERVER_COMPUTER_SLOTS : SERVER_WHITEBOARD_SLOTS
    const centroids = this.clusterTileCentroids(layer, minSpacing, serverSlots)

    centroids.forEach((point, index) => {
      const item = group.get(point.x, point.y, textureKey, 0) as Item
      item.setAlpha(0)
      item.setDepth(point.y)

      const body = item.body as Phaser.Physics.Arcade.StaticBody | null
      if (body) {
        body.setSize(40, 40).setOffset(item.width * 0.5 - 20, item.height * 0.5 - 20)
        body.updateFromGameObject()
      }

      configure(item, String(index))
    })
  }

  private clusterTileCentroids(
    layer: Phaser.Tilemaps.TilemapLayer,
    minSpacing: number,
    maxClusters: number
  ) {
    const clusters: { x: number; y: number; count: number }[] = []

    layer.forEachTile((tile) => {
      if (!tile.index) return

      const px = tile.pixelX + this.map.tileWidth / 2
      const py = tile.pixelY + this.map.tileHeight / 2
      let merged = false

      for (const cluster of clusters) {
        if (Phaser.Math.Distance.Between(px, py, cluster.x, cluster.y) >= minSpacing) continue
        const total = cluster.count + 1
        cluster.x = (cluster.x * cluster.count + px) / total
        cluster.y = (cluster.y * cluster.count + py) / total
        cluster.count = total
        merged = true
        break
      }

      if (!merged) {
        clusters.push({ x: px, y: py, count: 1 })
      }
    })

    clusters.sort((a, b) => b.count - a.count)
    return clusters.slice(0, maxClusters).map(({ x, y }) => ({ x, y }))
  }

  getFollowTargetId() {
    return this.followTargetId
  }

  /** Toggle auto-walk follow on another player (click name in participant list). */
  setFollowTarget(sessionId: string | null) {
    if (!sessionId || sessionId === this.network?.mySessionId) {
      this.followTargetId = null
    } else if (this.followTargetId === sessionId) {
      this.followTargetId = null
    } else {
      this.followTargetId = sessionId
    }
  }

  cancelFollow() {
    this.followTargetId = null
  }

  getFollowTargetPosition(): { x: number; y: number } | null {
    if (!this.followTargetId) return null
    const target = this.otherPlayerMap.get(this.followTargetId)
    if (!target) return null
    return { x: target.x, y: target.y }
  }

  openNearbyWhiteboard() {
    const selected = this.playerSelector?.selectedItem
    if (selected?.itemType === ItemType.WHITEBOARD) {
      ;(selected as Whiteboard).openDialog(this.network)
      return
    }

    let nearest: Whiteboard | undefined
    let bestDist = Infinity
    this.whiteboardMap.forEach((wb) => {
      const dist = Phaser.Math.Distance.Between(this.myPlayer.x, this.myPlayer.y, wb.x, wb.y)
      if (dist < bestDist) {
        bestDist = dist
        nearest = wb
      }
    })

    if (nearest) {
      nearest.openDialog(this.network)
      return
    }

    this.whiteboardMap.get('0')?.openDialog(this.network)
  }

  hasDesks() {
    return this.deskManager.hasDesks()
  }

  private updateInteractableSelection() {
    const selector = this.playerSelector
    const prev = selector.selectedItem as Item | undefined
    let found: Item | undefined
    let bestDist = Infinity

    const tryOverlap = (group: Phaser.Physics.Arcade.StaticGroup) => {
      this.physics.overlap(selector, group, (_zone, obj) => {
        const item = obj as Item
        const dist = Phaser.Math.Distance.Between(selector.x, selector.y, item.x, item.y)
        if (dist < bestDist) {
          bestDist = dist
          found = item
        }
      })
    }

    tryOverlap(this.computersGroup)
    tryOverlap(this.whiteboardsGroup)

    if (prev && prev !== found) {
      prev.clearDialogBox()
    }

    selector.selectedItem = found
  }

  private createDeskLabels() {
    this.deskLabels.forEach((t) => t.destroy())
    this.deskLabels = []
    for (const desk of this.deskManager.getDesks()) {
      const label = this.add
        .text(desk.x + desk.width / 2, desk.y + desk.height / 2, desk.name, {
          fontSize: '11px',
          color: '#cbd5e1',
          backgroundColor: '#0f172acc',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(4000)
      this.deskLabels.push(label)
    }
  }

  private syncProximityShare() {
    const proximityShare = this.network.proximityShare
    if (!proximityShare || !this.myPlayer.screenSharing) return

    this.otherPlayerMap.forEach((other, id) => {
      const strength = this.getVideoConnectionStrength(other)
      if (strength > 0.02) {
        proximityShare.shareToViewer(id)
      } else {
        proximityShare.stopShareToViewer(id)
      }
    })
  }

  private refreshDeskLabels() {
    if (!this.deskManager.hasDesks()) return
    const ownerByDesk = new Map<string, string>()
    store.getState().participants.participants.forEach((p) => {
      if (p.deskId && p.name) ownerByDesk.set(p.deskId, p.name)
    })
    this.deskManager.getDesks().forEach((desk, i) => {
      const owner = ownerByDesk.get(desk.id)
      const label = this.deskLabels[i]
      if (label) {
        label.setText(owner ? `${desk.name} · ${owner}` : desk.name)
      }
    })
  }

  toggleHandRaised() {
    const next = !this.myPlayer.handRaised
    this.myPlayer.handRaised = next
    this.myPlayer.setHandRaised(next)
    this.network.setHandRaised(next)
    this.myPlayer.syncParticipantList(this.network)
  }

  async toggleProximityScreenShare() {
    if (this.myPlayer.screenSharing) {
      this.network.proximityShare?.stopShare()
      this.myPlayer.screenSharing = false
      this.network.setScreenSharing(false)
      store.dispatch(clearProximityShareStreams())
    } else {
      await this.network.proximityShare?.startShare()
      this.myPlayer.screenSharing = true
      this.network.setScreenSharing(true)
    }
    this.myPlayer.syncParticipantList(this.network)
  }

  toggleMeetingMode() {
    const next = !this.myPlayer.inMeeting
    this.myPlayer.inMeeting = next
    this.network.setInMeeting(next)
    this.myPlayer.syncParticipantList(this.network)
  }

  claimDeskAtPlayer() {
    const desk = this.deskManager.getDeskAt(this.myPlayer.x, this.myPlayer.y)
    if (!desk) return
    this.myPlayer.deskId = desk.id
    this.myPlayer.deskName = desk.name
    this.network.claimDesk(desk.id, desk.name)
    this.myPlayer.syncParticipantList(this.network)
  }

  releaseDesk() {
    this.myPlayer.deskId = ''
    this.myPlayer.deskName = ''
    this.network.releaseDesk()
    this.myPlayer.syncParticipantList(this.network)
  }

  // function to add new player to the otherPlayer group
  private handlePlayerJoined(newPlayer: IPlayer, id: string) {
    if (this.otherPlayerMap.has(id)) return

    const otherPlayer = this.add.otherPlayer(newPlayer.x, newPlayer.y, 'adam', id, newPlayer.name)
    otherPlayer.setPresence(newPlayer.presence || PlayerPresence.ONLINE)
    otherPlayer.setArea(newPlayer.areaId ?? '', newPlayer.areaName ?? '')
    this.syncOtherPlayerState(otherPlayer, newPlayer)
    this.otherPlayers.add(otherPlayer)
    this.otherPlayerMap.set(id, otherPlayer)
  }

  private syncOtherPlayerState(other: OtherPlayer, player: IPlayer) {
    if (player.x != null) other.updateOtherPlayer('x', player.x)
    if (player.y != null) other.updateOtherPlayer('y', player.y)
    if (player.anim) other.updateOtherPlayer('anim', player.anim)
    if (player.readyToConnect) other.updateOtherPlayer('readyToConnect', player.readyToConnect)
    if (player.videoConnected) other.updateOtherPlayer('videoConnected', player.videoConnected)
    if (player.handRaised) other.updateOtherPlayer('handRaised', player.handRaised)
    if (player.screenSharing) other.updateOtherPlayer('screenSharing', player.screenSharing)
    if (player.inMeeting) other.updateOtherPlayer('inMeeting', player.inMeeting)
    if (player.deskId) other.updateOtherPlayer('deskId', player.deskId)
    if (player.deskName) other.updateOtherPlayer('deskName', player.deskName)
  }

  // function to remove the player who left from the otherPlayer group
  private handlePlayerLeft(id: string) {
    if (this.followTargetId === id) {
      this.cancelFollow()
    }
    if (this.otherPlayerMap.has(id)) {
      const otherPlayer = this.otherPlayerMap.get(id)
      if (!otherPlayer) return
      this.otherPlayers.remove(otherPlayer, true, true)
      this.otherPlayerMap.delete(id)
    }
  }

  private handleMyPlayerReady() {
    this.myPlayer.readyToConnect = true
  }

  private handleMyVideoConnected() {
    this.myPlayer.videoConnected = true
  }

  // function to update target position upon receiving player updates
  private handlePlayerUpdated(field: string, value: number | string | boolean, id: string) {
    const otherPlayer = this.otherPlayerMap.get(id)
    otherPlayer?.updateOtherPlayer(field, value)
    if (field === 'deskId' || field === 'deskName') {
      this.refreshDeskLabels()
    }
  }

  private handleMyPresenceChange(presence: PlayerPresence) {
    this.myPlayer?.setPresence(presence)
    this.myPlayer?.syncParticipantList(this.network)
  }

  private syncMyPrivateArea() {
    const area = this.privateAreaManager.getAreaAt(this.myPlayer.x, this.myPlayer.y)
    const areaId = area?.id ?? OPEN_OFFICE_AREA_ID
    const areaName = area?.name ?? OPEN_OFFICE_AREA_NAME

    if (areaId !== this.myPlayer.areaId || areaName !== this.myPlayer.areaName) {
      this.myPlayer.setArea(areaId, areaName)
      this.network.updatePlayerArea(areaId, areaName)
    }
  }

  private getVideoConnectionStrength(other: OtherPlayer): number {
    if (
      !this.myPlayer.readyToConnect ||
      !other.readyToConnect ||
      !this.myPlayer.videoConnected ||
      !other.videoConnected
    ) {
      return 0
    }

    const myArea = this.myPlayer.areaId
    const otherArea = other.areaId
    const sameArea = myArea === otherArea

    const myOnSpotlight = this.spotlightManager.isOnSpotlight(this.myPlayer.x, this.myPlayer.y)
    const otherOnSpotlight = this.spotlightManager.isOnSpotlight(other.x, other.y)

    if (sameArea && (myOnSpotlight || otherOnSpotlight)) {
      return 1
    }

    if (sameArea && (this.myPlayer.inMeeting || other.inMeeting)) {
      return 1
    }

    if (myArea && sameArea) {
      return 1
    }

    if (!myArea && !otherArea) {
      const dist = Math.hypot(this.myPlayer.x - other.x, this.myPlayer.y - other.y)
      return proximityStrength(dist, VIDEO_PROXIMITY_RADIUS)
    }

    return 0
  }

  private syncVideoConnections() {
    const webRTC = this.network.webRTC
    if (!webRTC || !this.myPlayer.videoConnected) return

    this.otherPlayerMap.forEach((other) => {
      const strength = this.getVideoConnectionStrength(other)

      if (strength > 0.02) {
        other.tryConnect(this.myPlayer, webRTC)
        webRTC.setPeerVolume(other.playerId, strength)
      } else {
        if (other.videoCallConnected) {
          other.disconnectVideoCall()
        } else {
          webRTC.deleteVideoStream(other.playerId)
          webRTC.deleteOnCalledVideoStream(other.playerId)
        }
      }
    })
  }

  private handleItemUserAdded(playerId: string, itemId: string, itemType: ItemType) {
    if (itemType === ItemType.COMPUTER) {
      const computer = this.computerMap.get(itemId)
      computer?.addCurrentUser(playerId)
    } else if (itemType === ItemType.WHITEBOARD) {
      const whiteboard = this.whiteboardMap.get(itemId)
      whiteboard?.addCurrentUser(playerId)
    }
  }

  private handleItemUserRemoved(playerId: string, itemId: string, itemType: ItemType) {
    if (itemType === ItemType.COMPUTER) {
      const computer = this.computerMap.get(itemId)
      computer?.removeCurrentUser(playerId)
    } else if (itemType === ItemType.WHITEBOARD) {
      const whiteboard = this.whiteboardMap.get(itemId)
      whiteboard?.removeCurrentUser(playerId)
    }
  }

  private handleChatMessageAdded(playerId: string, content: string) {
    const otherPlayer = this.otherPlayerMap.get(playerId)
    otherPlayer?.updateDialogBubble(content)
  }

  update(t: number, dt: number) {
    if (this.myPlayer && this.network) {
      this.playerSelector.update(this.myPlayer, this.cursors)
      this.updateInteractableSelection()

      const followPos = this.getFollowTargetPosition()
      const cancelFollow = this.myPlayer.update(
        this.playerSelector,
        this.cursors,
        this.keyE,
        this.keyR,
        this.network,
        followPos
      )
      if (cancelFollow) {
        this.cancelFollow()
      }

      if (this.followTargetId && !this.otherPlayerMap.has(this.followTargetId)) {
        this.cancelFollow()
      }

      if (t - this.lastVideoSyncAt > 300) {
        this.syncMyPrivateArea()
        this.syncVideoConnections()
        this.syncProximityShare()
        this.refreshDeskLabels()
        this.lastVideoSyncAt = t
      }
    }
  }
}
