import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { OPEN_OFFICE_AREA_NAME } from '../../../types/PrivateArea'
import { PlayerPresence } from '../../../types/PlayerPresence'

export interface Participant {
  id: string
  name: string
  presence: string
  areaId: string
  areaName: string
  deskId: string
  deskName: string
  handRaised: boolean
  screenSharing: boolean
  inMeeting: boolean
}

export function displayAreaName(areaId: string, areaName: string) {
  return areaId ? areaName || 'Private area' : OPEN_OFFICE_AREA_NAME
}

export const participantSlice = createSlice({
  name: 'participants',
  initialState: {
    participants: new Map<string, Participant>(),
  },
  reducers: {
    upsertParticipant: (state, action: PayloadAction<Participant>) => {
      state.participants.set(action.payload.id, action.payload)
    },
    removeParticipant: (state, action: PayloadAction<string>) => {
      state.participants.delete(action.payload)
    },
    clearParticipants: (state) => {
      state.participants.clear()
    },
  },
})

export const { upsertParticipant, removeParticipant, clearParticipants } = participantSlice.actions

export function participantFromServer(
  id: string,
  name: string,
  presence?: string,
  areaId?: string,
  areaName?: string,
  deskId?: string,
  deskName?: string,
  handRaised?: boolean,
  screenSharing?: boolean,
  inMeeting?: boolean
): Participant {
  return {
    id,
    name,
    presence: presence === PlayerPresence.AFK ? PlayerPresence.AFK : PlayerPresence.ONLINE,
    areaId: areaId ?? '',
    areaName: areaName ?? '',
    deskId: deskId ?? '',
    deskName: deskName ?? '',
    handRaised: !!handRaised,
    screenSharing: !!screenSharing,
    inMeeting: !!inMeeting,
  }
}

export default participantSlice.reducer
