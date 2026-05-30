import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'
import store from '../stores'
import { sanitizeId } from '../util'

/** Build WBO embed URL. Public WBO assigns random in-board names; we pass skyName for our UI. */
export function buildWhiteboardUrl(roomId: string, playerName?: string) {
  const base = `https://wbo.ophir.dev/boards/sky-office-${roomId}`
  const params = new URLSearchParams()
  params.set('lang', 'en')
  if (playerName?.trim()) {
    params.set('skyName', playerName.trim())
  }
  return `${base}?${params.toString()}`
}

export function getWhiteboardOccupants(whiteboardId: string | null | undefined) {
  if (!whiteboardId) return []

  const game = phaserGame.scene.keys.game as Game | undefined
  const whiteboard = game?.network?.room?.state?.whiteboards?.get(whiteboardId)
  if (!whiteboard) return []

  const sessionId = store.getState().user.sessionId
  const participants = store.getState().participants.participants
  const nameMap = store.getState().user.playerNameMap

  return Array.from(whiteboard.connectedUser).map((id) => ({
    id,
    name: participants.get(id)?.name ?? nameMap.get(sanitizeId(id)) ?? 'Guest',
    isSelf: id === sessionId,
  }))
}
