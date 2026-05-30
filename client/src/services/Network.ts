import { Client, Room } from 'colyseus.js'
import { IComputer, IOfficeState, IPlayer, IWhiteboard } from '../../../types/IOfficeState'
import { Message } from '../../../types/Messages'
import { IRoomData, RoomType } from '../../../types/Rooms'
import { ItemType } from '../../../types/Items'
import WebRTC from '../web/WebRTC'
import ProximityShareManager from '../web/ProximityShareManager'
import PresenceManager from './PresenceManager'
import { PlayerPresence } from '../../../types/PlayerPresence'
import { phaserEvents, Event } from '../events/EventCenter'
import store from '../stores'
import { setSessionId, setPlayerNameMap, removePlayerNameMap } from '../stores/UserStore'
import {
  setLobbyJoined,
  setLobbyError,
  setJoinedRoomData,
  setAvailableRooms,
  addAvailableRooms,
  removeAvailableRooms,
} from '../stores/RoomStore'
import {
  pushChatMessage,
  pushDmMessage,
  pushPlayerJoinedMessage,
  pushPlayerLeftMessage,
} from '../stores/ChatStore'
import {
  upsertParticipant,
  removeParticipant,
  clearParticipants,
  participantFromServer,
} from '../stores/ParticipantStore'
import { setWhiteboardUrls } from '../stores/WhiteboardStore'

export default class Network {
  private client: Client
  private room?: Room<IOfficeState>
  private lobby!: Room
  webRTC?: WebRTC
  proximityShare?: ProximityShareManager
  private presenceManager?: PresenceManager

  mySessionId!: string

  constructor() {
    const protocol = window.location.protocol.replace('http', 'ws')
    const endpoint =
      process.env.NODE_ENV === 'production'
        ? import.meta.env.VITE_SERVER_URL
        : `${protocol}//${window.location.hostname}:2567`
    this.client = new Client(endpoint)
    this.connectLobbyWithRetry()

    phaserEvents.on(Event.MY_PLAYER_NAME_CHANGE, this.updatePlayerName, this)
    phaserEvents.on(Event.MY_PLAYER_TEXTURE_CHANGE, this.updatePlayer, this)
    phaserEvents.on(Event.PLAYER_DISCONNECTED, this.playerStreamDisconnect, this)
  }

  private async connectLobbyWithRetry(attempt = 0) {
    const maxAttempts = 8
    const delayMs = Math.min(1000 * 2 ** attempt, 8000)

    try {
      await this.joinLobbyRoom()
      store.dispatch(setLobbyJoined(true))
    } catch (err) {
      console.error('Lobby connection failed:', err)
      if (attempt + 1 >= maxAttempts) {
        store.dispatch(
          setLobbyError(
            'Cannot reach game server. Open a terminal in the project folder and run: yarn start'
          )
        )
        return
      }
      window.setTimeout(() => this.connectLobbyWithRetry(attempt + 1), delayMs)
    }
  }

  async retryLobbyConnection() {
    store.dispatch(setLobbyError(''))
    await this.connectLobbyWithRetry()
  }

  /**
   * method to join Colyseus' built-in LobbyRoom, which automatically notifies
   * connected clients whenever rooms with "realtime listing" have updates
   */
  async joinLobbyRoom() {
    this.lobby = await this.client.joinOrCreate(RoomType.LOBBY)

    this.lobby.onMessage('rooms', (rooms) => {
      store.dispatch(setAvailableRooms(rooms))
    })

    this.lobby.onMessage('+', ([roomId, room]) => {
      store.dispatch(addAvailableRooms({ roomId, room }))
    })

    this.lobby.onMessage('-', (roomId) => {
      store.dispatch(removeAvailableRooms(roomId))
    })
  }

  // method to join the public lobby
  async joinOrCreatePublic() {
    this.room = await this.client.joinOrCreate(RoomType.PUBLIC)
    this.initialize()
  }

  // method to join a custom room
  async joinCustomById(roomId: string, password: string | null) {
    this.room = await this.client.joinById(roomId, { password })
    this.initialize()
  }

  // method to create a custom room
  async createCustom(roomData: IRoomData) {
    const { name, description, password, autoDispose } = roomData
    this.room = await this.client.create(RoomType.CUSTOM, {
      name,
      description,
      password,
      autoDispose,
    })
    this.initialize()
  }

  // set up all network listeners before the game starts
  initialize() {
    if (!this.room) return

    this.lobby.leave()
    this.mySessionId = this.room.sessionId
    store.dispatch(setSessionId(this.room.sessionId))
    this.webRTC = new WebRTC(this.mySessionId, this)
    this.proximityShare = new ProximityShareManager(this.mySessionId)
    this.presenceManager = new PresenceManager(this)
    store.dispatch(clearParticipants())

    const syncParticipant = (key: string, player: IPlayer) => {
      if (!player.name) return
      store.dispatch(
        upsertParticipant(
          participantFromServer(
            key,
            player.name,
            player.presence,
            player.areaId,
            player.areaName,
            player.deskId,
            player.deskName,
            player.handRaised,
            player.screenSharing,
            player.inMeeting
          )
        )
      )
    }

    const registerRemotePlayer = (player: IPlayer, key: string) => {
      if (key === this.mySessionId) return

      player.onChange = (changes) => {
        changes.forEach((change) => {
          const { field, value } = change
          phaserEvents.emit(Event.PLAYER_UPDATED, field, value, key)

          if (field === 'name' && value !== '') {
            const hadName = store.getState().user.playerNameMap.has(key)
            store.dispatch(setPlayerNameMap({ id: key, name: value as string }))
            syncParticipant(key, player)
            phaserEvents.emit(Event.PLAYER_JOINED, player, key)
            if (!hadName) {
              store.dispatch(pushPlayerJoinedMessage(value as string))
            }
          } else if (
            field === 'presence' ||
            field === 'areaId' ||
            field === 'areaName' ||
            field === 'deskId' ||
            field === 'deskName' ||
            field === 'handRaised' ||
            field === 'screenSharing' ||
            field === 'inMeeting'
          ) {
            syncParticipant(key, player)
          }
        })
      }

      if (player.name) {
        syncParticipant(key, player)
        store.dispatch(setPlayerNameMap({ id: key, name: player.name }))
      }
    }

    this.room.state.players.forEach((player, key) => {
      registerRemotePlayer(player, key)
    })

    this.room.state.players.onAdd = (player: IPlayer, key: string) => {
      registerRemotePlayer(player, key)
      if (player.name) {
        phaserEvents.emit(Event.PLAYER_JOINED, player, key)
        store.dispatch(pushPlayerJoinedMessage(player.name))
      }
    }

    // an instance removed from the players MapSchema
    this.room.state.players.onRemove = (player: IPlayer, key: string) => {
      phaserEvents.emit(Event.PLAYER_LEFT, key)
      this.webRTC?.deleteVideoStream(key)
      this.webRTC?.deleteOnCalledVideoStream(key)
      store.dispatch(pushPlayerLeftMessage(player.name))
      store.dispatch(removePlayerNameMap(key))
      store.dispatch(removeParticipant(key))
    }

    // new instance added to the computers MapSchema
    this.room.state.computers.onAdd = (computer: IComputer, key: string) => {
      // track changes on every child object's connectedUser
      computer.connectedUser.onAdd = (item, index) => {
        phaserEvents.emit(Event.ITEM_USER_ADDED, item, key, ItemType.COMPUTER)
      }
      computer.connectedUser.onRemove = (item, index) => {
        phaserEvents.emit(Event.ITEM_USER_REMOVED, item, key, ItemType.COMPUTER)
      }
    }

    // new instance added to the whiteboards MapSchema
    this.room.state.whiteboards.onAdd = (whiteboard: IWhiteboard, key: string) => {
      store.dispatch(
        setWhiteboardUrls({
          whiteboardId: key,
          roomId: whiteboard.roomId,
        })
      )
      // track changes on every child object's connectedUser
      whiteboard.connectedUser.onAdd = (item, index) => {
        phaserEvents.emit(Event.ITEM_USER_ADDED, item, key, ItemType.WHITEBOARD)
      }
      whiteboard.connectedUser.onRemove = (item, index) => {
        phaserEvents.emit(Event.ITEM_USER_REMOVED, item, key, ItemType.WHITEBOARD)
      }
    }

    // new instance added to the chatMessages ArraySchema (public only)
    this.room.state.chatMessages.onAdd = (item) => {
      if (!item.recipientId) {
        store.dispatch(pushChatMessage(item))
      }
    }

    this.room.onMessage(
      Message.ADD_DM_MESSAGE,
      (payload: {
        authorId: string
        author: string
        recipientId: string
        content: string
        createdAt: number
      }) => {
        store.dispatch(pushDmMessage(payload))
      }
    )

    // when the server sends room data
    this.room.onMessage(Message.SEND_ROOM_DATA, (content) => {
      store.dispatch(setJoinedRoomData(content))
    })

    // when a user sends a message
    this.room.onMessage(Message.ADD_CHAT_MESSAGE, ({ clientId, content }) => {
      phaserEvents.emit(Event.UPDATE_DIALOG_BUBBLE, clientId, content)
    })

    // when a peer disconnects with myPeer
    this.room.onMessage(Message.DISCONNECT_STREAM, (clientId: string) => {
      this.webRTC?.deleteOnCalledVideoStream(clientId)
    })

    // when a computer user stops sharing screen
    this.room.onMessage(Message.STOP_SCREEN_SHARE, (clientId: string) => {
      const computerState = store.getState().computer
      computerState.shareScreenManager?.onUserLeft(clientId)
    })

    this.room.onMessage(
      Message.WATCH_SCREEN_SHARE,
      (payload: { viewerId: string }) => {
        this.proximityShare?.shareToViewer(payload.viewerId)
      }
    )
  }

  /** Spawn Phaser avatars for everyone already in the room (call after Game scene is ready). */
  syncPlayersToScene() {
    if (!this.room) return
    this.room.state.players.forEach((player, key) => {
      if (key === this.mySessionId || !player.name) return
      phaserEvents.emit(Event.PLAYER_JOINED, player, key)
    })
  }

  private watchRetryTimers = new Map<string, number>()

  requestWatchScreenShare(sharerSessionId: string) {
    this.room?.send(Message.REQUEST_WATCH_SCREEN_SHARE, { targetId: sharerSessionId })
  }

  startWatchScreenShareRetry(sharerSessionId: string) {
    this.stopWatchScreenShareRetry(sharerSessionId)
    let attempts = 0

    const tick = () => {
      attempts++
      this.requestWatchScreenShare(sharerSessionId)
      if (attempts < 8) {
        const timer = window.setTimeout(tick, 1500)
        this.watchRetryTimers.set(sharerSessionId, timer)
      }
    }

    tick()
  }

  stopWatchScreenShareRetry(sharerSessionId: string) {
    const timer = this.watchRetryTimers.get(sharerSessionId)
    if (timer) {
      window.clearTimeout(timer)
      this.watchRetryTimers.delete(sharerSessionId)
    }
  }

  // method to register event listener and call back function when a item user added
  onChatMessageAdded(callback: (playerId: string, content: string) => void, context?: any) {
    phaserEvents.on(Event.UPDATE_DIALOG_BUBBLE, callback, context)
  }

  // method to register event listener and call back function when a item user added
  onItemUserAdded(
    callback: (playerId: string, key: string, itemType: ItemType) => void,
    context?: any
  ) {
    phaserEvents.on(Event.ITEM_USER_ADDED, callback, context)
  }

  // method to register event listener and call back function when a item user removed
  onItemUserRemoved(
    callback: (playerId: string, key: string, itemType: ItemType) => void,
    context?: any
  ) {
    phaserEvents.on(Event.ITEM_USER_REMOVED, callback, context)
  }

  // method to register event listener and call back function when a player joined
  onPlayerJoined(callback: (Player: IPlayer, key: string) => void, context?: any) {
    phaserEvents.on(Event.PLAYER_JOINED, callback, context)
  }

  // method to register event listener and call back function when a player left
  onPlayerLeft(callback: (key: string) => void, context?: any) {
    phaserEvents.on(Event.PLAYER_LEFT, callback, context)
  }

  // method to register event listener and call back function when myPlayer is ready to connect
  onMyPlayerReady(callback: (key: string) => void, context?: any) {
    phaserEvents.on(Event.MY_PLAYER_READY, callback, context)
  }

  // method to register event listener and call back function when my video is connected
  onMyPlayerVideoConnected(callback: (key: string) => void, context?: any) {
    phaserEvents.on(Event.MY_PLAYER_VIDEO_CONNECTED, callback, context)
  }

  // method to register event listener and call back function when a player updated
  onPlayerUpdated(
    callback: (field: string, value: number | string, key: string) => void,
    context?: any
  ) {
    phaserEvents.on(Event.PLAYER_UPDATED, callback, context)
  }

  // method to send player updates to Colyseus server
  updatePlayer(currentX: number, currentY: number, currentAnim: string) {
    this.room?.send(Message.UPDATE_PLAYER, { x: currentX, y: currentY, anim: currentAnim })
  }

  // method to send player name to Colyseus server
  updatePlayerName(currentName: string) {
    this.room?.send(Message.UPDATE_PLAYER_NAME, { name: currentName })
  }

  updatePresence(presence: PlayerPresence) {
    this.room?.send(Message.UPDATE_PRESENCE, { presence })
  }

  updatePlayerArea(areaId: string, areaName: string) {
    this.room?.send(Message.UPDATE_PLAYER_AREA, { areaId, areaName })
    const me = this.room?.state.players.get(this.mySessionId)
    if (me?.name) {
      store.dispatch(
        upsertParticipant(
          participantFromServer(
            this.mySessionId,
            me.name,
            me.presence,
            areaId,
            areaName,
            me.deskId,
            me.deskName,
            me.handRaised,
            me.screenSharing,
            me.inMeeting
          )
        )
      )
    }
  }

  syncMyParticipant(
    name: string,
    presence: string,
    areaId: string,
    areaName: string,
    deskId = '',
    deskName = '',
    handRaised = false,
    screenSharing = false,
    inMeeting = false
  ) {
    store.dispatch(
      upsertParticipant(
        participantFromServer(
          this.mySessionId,
          name,
          presence,
          areaId,
          areaName,
          deskId,
          deskName,
          handRaised,
          screenSharing,
          inMeeting
        )
      )
    )
  }

  claimDesk(deskId: string, deskName: string) {
    this.room?.send(Message.CLAIM_DESK, { deskId, deskName })
  }

  releaseDesk() {
    this.room?.send(Message.RELEASE_DESK, {})
  }

  setHandRaised(raised: boolean) {
    this.room?.send(Message.SET_HAND_RAISED, { raised })
  }

  setScreenSharing(sharing: boolean) {
    this.room?.send(Message.SET_SCREEN_SHARING, { sharing })
  }

  setInMeeting(inMeeting: boolean) {
    this.room?.send(Message.SET_IN_MEETING, { inMeeting })
  }

  // method to send ready-to-connect signal to Colyseus server
  readyToConnect() {
    this.room?.send(Message.READY_TO_CONNECT)
    phaserEvents.emit(Event.MY_PLAYER_READY)
  }

  // method to send ready-to-connect signal to Colyseus server
  videoConnected() {
    this.room?.send(Message.VIDEO_CONNECTED)
    phaserEvents.emit(Event.MY_PLAYER_VIDEO_CONNECTED)
  }

  // method to send stream-disconnection signal to Colyseus server
  playerStreamDisconnect(id: string) {
    this.room?.send(Message.DISCONNECT_STREAM, { clientId: id })
    this.webRTC?.deleteVideoStream(id)
  }

  connectToComputer(id: string) {
    this.room?.send(Message.CONNECT_TO_COMPUTER, { computerId: id })
  }

  disconnectFromComputer(id: string) {
    this.room?.send(Message.DISCONNECT_FROM_COMPUTER, { computerId: id })
  }

  getWhiteboardRoomId(whiteboardId: string): string | null {
    return this.room?.state.whiteboards.get(whiteboardId)?.roomId ?? null
  }

  getWhiteboardConnectedUserIds(whiteboardId: string): string[] {
    const whiteboard = this.room?.state.whiteboards.get(whiteboardId)
    if (!whiteboard) return []
    const ids: string[] = []
    whiteboard.connectedUser.forEach((id) => ids.push(id))
    return ids
  }

  connectToWhiteboard(id: string) {
    this.room?.send(Message.CONNECT_TO_WHITEBOARD, { whiteboardId: id })
  }

  disconnectFromWhiteboard(id: string) {
    this.room?.send(Message.DISCONNECT_FROM_WHITEBOARD, { whiteboardId: id })
  }

  onStopScreenShare(id: string) {
    this.room?.send(Message.STOP_SCREEN_SHARE, { computerId: id })
  }

  addChatMessage(content: string, recipientId?: string) {
    if (recipientId) {
      this.room?.send(Message.ADD_DM_MESSAGE, { content, recipientId })
    } else {
      this.room?.send(Message.ADD_CHAT_MESSAGE, { content })
    }
  }
}
