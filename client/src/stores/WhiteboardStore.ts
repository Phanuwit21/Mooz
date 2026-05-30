import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'
import { buildWhiteboardUrl } from '../util/whiteboard'

interface WhiteboardState {
  whiteboardDialogOpen: boolean
  whiteboardId: null | string
  whiteboardUrl: null | string
  urls: Map<string, string>
}

const initialState: WhiteboardState = {
  whiteboardDialogOpen: false,
  whiteboardId: null,
  whiteboardUrl: null,
  urls: new Map(),
}

export const whiteboardSlice = createSlice({
  name: 'whiteboard',
  initialState,
  reducers: {
    openWhiteboardDialog: (state, action: PayloadAction<string>) => {
      state.whiteboardDialogOpen = true
      state.whiteboardId = action.payload
      const game = phaserGame.scene.keys.game as Game
      const whiteboard = game.network?.room?.state?.whiteboards?.get(action.payload)
      const playerName = game.myPlayer?.playerName?.text
      if (whiteboard?.roomId) {
        state.whiteboardUrl = buildWhiteboardUrl(whiteboard.roomId, playerName)
      } else {
        state.whiteboardUrl = state.urls.get(action.payload) ?? null
      }
      game.disableKeys()
    },
    closeWhiteboardDialog: (state) => {
      const game = phaserGame.scene.keys.game as Game
      game.enableKeys()
      game.network.disconnectFromWhiteboard(state.whiteboardId!)
      state.whiteboardDialogOpen = false
      state.whiteboardId = null
      state.whiteboardUrl = null
    },
    setWhiteboardUrls: (state, action: PayloadAction<{ whiteboardId: string; roomId: string }>) => {
      const game = phaserGame.scene.keys.game as Game | undefined
      const playerName = game?.myPlayer?.playerName?.text
      const url = buildWhiteboardUrl(action.payload.roomId, playerName)
      state.urls.set(action.payload.whiteboardId, url)
      if (
        state.whiteboardDialogOpen &&
        state.whiteboardId === action.payload.whiteboardId
      ) {
        state.whiteboardUrl = url
      }
    },
  },
})

export const { openWhiteboardDialog, closeWhiteboardDialog, setWhiteboardUrls } =
  whiteboardSlice.actions

export default whiteboardSlice.reducer
