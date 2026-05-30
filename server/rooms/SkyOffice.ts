import bcrypt from 'bcrypt'
import { Room, Client, ServerError } from 'colyseus'
import { Dispatcher } from '@colyseus/command'
import { Player, OfficeState, Computer, Whiteboard } from './schema/OfficeState'
import { Message } from '../../types/Messages'
import { IRoomData } from '../../types/Rooms'
import { whiteboardRoomIds } from './schema/OfficeState'
import PlayerUpdateCommand from './commands/PlayerUpdateCommand'
import PlayerUpdateNameCommand from './commands/PlayerUpdateNameCommand'
import {
  ComputerAddUserCommand,
  ComputerRemoveUserCommand,
} from './commands/ComputerUpdateArrayCommand'
import {
  WhiteboardAddUserCommand,
  WhiteboardRemoveUserCommand,
} from './commands/WhiteboardUpdateArrayCommand'
import ChatMessageUpdateCommand from './commands/ChatMessageUpdateCommand'

export class SkyOffice extends Room<OfficeState> {
  private dispatcher = new Dispatcher(this)
  private name: string
  private description: string
  private password: string | null = null

  async onCreate(options: IRoomData) {
    const { name, description, password, autoDispose } = options
    this.name = name
    this.description = description
    this.autoDispose = autoDispose

    let hasPassword = false
    if (password) {
      const salt = await bcrypt.genSalt(10)
      this.password = await bcrypt.hash(password, salt)
      hasPassword = true
    }
    this.setMetadata({ name, description, hasPassword })

    this.setState(new OfficeState())

    // One slot per computer / whiteboard cluster on the map
    for (let i = 0; i < 11; i++) {
      this.state.computers.set(String(i), new Computer())
    }

    for (let i = 0; i < 2; i++) {
      this.state.whiteboards.set(String(i), new Whiteboard())
    }

    // when a player connect to a computer, add to the computer connectedUser array
    this.onMessage(Message.CONNECT_TO_COMPUTER, (client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerAddUserCommand(), {
        client,
        computerId: message.computerId,
      })
    })

    // when a player disconnect from a computer, remove from the computer connectedUser array
    this.onMessage(Message.DISCONNECT_FROM_COMPUTER, (client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerRemoveUserCommand(), {
        client,
        computerId: message.computerId,
      })
    })

    // when a player stop sharing screen
    this.onMessage(Message.STOP_SCREEN_SHARE, (client, message: { computerId: string }) => {
      const computer = this.state.computers.get(message.computerId)
      computer.connectedUser.forEach((id) => {
        this.clients.forEach((cli) => {
          if (cli.sessionId === id && cli.sessionId !== client.sessionId) {
            cli.send(Message.STOP_SCREEN_SHARE, client.sessionId)
          }
        })
      })
    })

    // when a player connect to a whiteboard, add to the whiteboard connectedUser array
    this.onMessage(Message.CONNECT_TO_WHITEBOARD, (client, message: { whiteboardId: string }) => {
      this.dispatcher.dispatch(new WhiteboardAddUserCommand(), {
        client,
        whiteboardId: message.whiteboardId,
      })
    })

    // when a player disconnect from a whiteboard, remove from the whiteboard connectedUser array
    this.onMessage(
      Message.DISCONNECT_FROM_WHITEBOARD,
      (client, message: { whiteboardId: string }) => {
        this.dispatcher.dispatch(new WhiteboardRemoveUserCommand(), {
          client,
          whiteboardId: message.whiteboardId,
        })
      }
    )

    // when receiving updatePlayer message, call the PlayerUpdateCommand
    this.onMessage(
      Message.UPDATE_PLAYER,
      (client, message: { x: number; y: number; anim: string }) => {
        this.dispatcher.dispatch(new PlayerUpdateCommand(), {
          client,
          x: message.x,
          y: message.y,
          anim: message.anim,
        })
      }
    )

    // when receiving updatePlayerName message, call the PlayerUpdateNameCommand
    this.onMessage(Message.UPDATE_PLAYER_NAME, (client, message: { name: string }) => {
      this.dispatcher.dispatch(new PlayerUpdateNameCommand(), {
        client,
        name: message.name,
      })
    })

    this.onMessage(Message.UPDATE_PRESENCE, (client, message: { presence: string }) => {
      const player = this.state.players.get(client.sessionId)
      if (player && (message.presence === 'online' || message.presence === 'afk')) {
        player.presence = message.presence
      }
    })

    this.onMessage(
      Message.UPDATE_PLAYER_AREA,
      (client, message: { areaId: string; areaName: string }) => {
        const player = this.state.players.get(client.sessionId)
        if (!player) return
        player.areaId = message.areaId ?? ''
        player.areaName = message.areaName ?? ''
      }
    )

    this.onMessage(
      Message.CLAIM_DESK,
      (client, message: { deskId: string; deskName: string }) => {
        const player = this.state.players.get(client.sessionId)
        if (!player) return

        this.state.players.forEach((p, id) => {
          if (p.deskId === message.deskId && id !== client.sessionId) {
            p.deskId = ''
            p.deskName = ''
          }
        })

        player.deskId = message.deskId
        player.deskName = message.deskName
      }
    )

    this.onMessage(Message.RELEASE_DESK, (client) => {
      const player = this.state.players.get(client.sessionId)
      if (!player) return
      player.deskId = ''
      player.deskName = ''
    })

    this.onMessage(Message.SET_HAND_RAISED, (client, message: { raised: boolean }) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.handRaised = message.raised
    })

    this.onMessage(Message.SET_SCREEN_SHARING, (client, message: { sharing: boolean }) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.screenSharing = message.sharing
    })

    this.onMessage(Message.SET_IN_MEETING, (client, message: { inMeeting: boolean }) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.inMeeting = message.inMeeting
    })

    // when a player is ready to connect, call the PlayerReadyToConnectCommand
    this.onMessage(Message.READY_TO_CONNECT, (client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.readyToConnect = true
    })

    // when a player is ready to connect, call the PlayerReadyToConnectCommand
    this.onMessage(Message.VIDEO_CONNECTED, (client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.videoConnected = true
    })

    this.onMessage(
      Message.REQUEST_WATCH_SCREEN_SHARE,
      (client, message: { targetId: string }) => {
        const sharer = this.clients.find((c) => c.sessionId === message.targetId)
        if (!sharer) return
        sharer.send(Message.WATCH_SCREEN_SHARE, { viewerId: client.sessionId })
      }
    )

    // when a player disconnect a stream, broadcast the signal to the other player connected to the stream
    this.onMessage(Message.DISCONNECT_STREAM, (client, message: { clientId: string }) => {
      this.clients.forEach((cli) => {
        if (cli.sessionId === message.clientId) {
          cli.send(Message.DISCONNECT_STREAM, client.sessionId)
        }
      })
    })

    // when a player send a chat message, update the message array and broadcast to all connected clients except the sender
    this.onMessage(Message.ADD_CHAT_MESSAGE, (client, message: { content: string }) => {
      this.dispatcher.dispatch(new ChatMessageUpdateCommand(), {
        client,
        content: message.content,
        recipientId: '',
      })

      this.broadcast(
        Message.ADD_CHAT_MESSAGE,
        { clientId: client.sessionId, content: message.content },
        { except: client }
      )
    })

    this.onMessage(
      Message.ADD_DM_MESSAGE,
      (client, message: { content: string; recipientId: string }) => {
        const player = this.state.players.get(client.sessionId)
        const recipient = this.clients.find((c) => c.sessionId === message.recipientId)
        if (!player?.name || !recipient) return

        const payload = {
          authorId: client.sessionId,
          author: player.name,
          recipientId: message.recipientId,
          content: message.content,
          createdAt: Date.now(),
        }

        client.send(Message.ADD_DM_MESSAGE, payload)
        recipient.send(Message.ADD_DM_MESSAGE, payload)

        recipient.send(Message.ADD_CHAT_MESSAGE, {
          clientId: client.sessionId,
          content: message.content,
        })
      }
    )
  }

  async onAuth(client: Client, options: { password: string | null }) {
    if (this.password) {
      const validPassword = await bcrypt.compare(options.password, this.password)
      if (!validPassword) {
        throw new ServerError(403, 'Password is incorrect!')
      }
    }
    return true
  }

  onJoin(client: Client, options: any) {
    this.state.players.set(client.sessionId, new Player())
    client.send(Message.SEND_ROOM_DATA, {
      id: this.roomId,
      name: this.name,
      description: this.description,
    })
  }

  onLeave(client: Client, consented: boolean) {
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId)
    }
    this.state.computers.forEach((computer) => {
      if (computer.connectedUser.has(client.sessionId)) {
        computer.connectedUser.delete(client.sessionId)
      }
    })
    this.state.whiteboards.forEach((whiteboard) => {
      if (whiteboard.connectedUser.has(client.sessionId)) {
        whiteboard.connectedUser.delete(client.sessionId)
      }
    })
  }

  onDispose() {
    this.state.whiteboards.forEach((whiteboard) => {
      if (whiteboardRoomIds.has(whiteboard.roomId)) whiteboardRoomIds.delete(whiteboard.roomId)
    })

    console.log('room', this.roomId, 'disposing...')
    this.dispatcher.stop()
  }
}
