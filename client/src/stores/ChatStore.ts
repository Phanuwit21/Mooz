import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IChatMessage } from '../../../types/IOfficeState'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

export enum MessageType {
  PLAYER_JOINED,
  PLAYER_LEFT,
  REGULAR_MESSAGE,
  DM_MESSAGE,
}

export type ChatTarget = 'everyone' | string

export interface DmChatMessage {
  author: string
  authorId: string
  recipientId: string
  content: string
  createdAt: number
}

export const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    chatMessages: new Array<{ messageType: MessageType; chatMessage: IChatMessage }>(),
    dmMessages: [] as DmChatMessage[],
    chatTarget: 'everyone' as ChatTarget,
    focused: false,
    showChat: true,
  },
  reducers: {
    pushChatMessage: (state, action: PayloadAction<IChatMessage>) => {
      state.chatMessages.push({
        messageType: MessageType.REGULAR_MESSAGE,
        chatMessage: action.payload,
      })
    },
    pushDmMessage: (state, action: PayloadAction<DmChatMessage>) => {
      state.dmMessages.push(action.payload)
      if (state.dmMessages.length > 200) {
        state.dmMessages.shift()
      }
    },
    setChatTarget: (state, action: PayloadAction<ChatTarget>) => {
      state.chatTarget = action.payload
    },
    pushPlayerJoinedMessage: (state, action: PayloadAction<string>) => {
      state.chatMessages.push({
        messageType: MessageType.PLAYER_JOINED,
        chatMessage: {
          createdAt: new Date().getTime(),
          author: action.payload,
          authorId: '',
          recipientId: '',
          content: 'joined the lobby',
        } as IChatMessage,
      })
    },
    pushPlayerLeftMessage: (state, action: PayloadAction<string>) => {
      state.chatMessages.push({
        messageType: MessageType.PLAYER_LEFT,
        chatMessage: {
          createdAt: new Date().getTime(),
          author: action.payload,
          authorId: '',
          recipientId: '',
          content: 'left the lobby',
        } as IChatMessage,
      })
    },
    setFocused: (state, action: PayloadAction<boolean>) => {
      const game = phaserGame.scene.keys.game as Game
      if (game?.disableKeys) {
        action.payload ? game.disableKeys() : game.enableKeys()
      }
      state.focused = action.payload
    },
    setShowChat: (state, action: PayloadAction<boolean>) => {
      state.showChat = action.payload
    },
  },
})

export const {
  pushChatMessage,
  pushDmMessage,
  setChatTarget,
  pushPlayerJoinedMessage,
  pushPlayerLeftMessage,
  setFocused,
  setShowChat,
} = chatSlice.actions

export default chatSlice.reducer
