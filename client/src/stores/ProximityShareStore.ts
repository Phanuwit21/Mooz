import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import Peer from 'peerjs'
import { sanitizeId } from '../util'

interface ProximityShareState {
  /** Full-screen viewer for a chosen sharer (session id) */
  focusedSharerId: string | null
  myStream: MediaStream | null
  peerStreams: Map<
    string,
    {
      stream: MediaStream
      call: Peer.MediaConnection
      ownerName: string
    }
  >
}

const initialState: ProximityShareState = {
  focusedSharerId: null,
  myStream: null,
  peerStreams: new Map(),
}

export const proximityShareSlice = createSlice({
  name: 'proximityShare',
  initialState,
  reducers: {
    setFocusedScreenShare: (state, action: PayloadAction<string | null>) => {
      state.focusedSharerId = action.payload
    },
    setProximityMyStream: (state, action: PayloadAction<MediaStream | null>) => {
      state.myStream = action.payload
    },
    addProximityShareStream: (
      state,
      action: PayloadAction<{
        id: string
        call: Peer.MediaConnection
        stream: MediaStream
        ownerName: string
      }>
    ) => {
      state.peerStreams.set(sanitizeId(action.payload.id), {
        call: action.payload.call,
        stream: action.payload.stream,
        ownerName: action.payload.ownerName,
      })
    },
    removeProximityShareStream: (state, action: PayloadAction<string>) => {
      const id = sanitizeId(action.payload)
      state.peerStreams.delete(id)
      if (state.focusedSharerId && sanitizeId(state.focusedSharerId) === id) {
        state.focusedSharerId = null
      }
    },
    clearProximityShareStreams: (state) => {
      state.peerStreams.clear()
      state.myStream = null
    },
  },
})

export const {
  setFocusedScreenShare,
  setProximityMyStream,
  addProximityShareStream,
  removeProximityShareStream,
  clearProximityShareStreams,
} = proximityShareSlice.actions

export default proximityShareSlice.reducer
