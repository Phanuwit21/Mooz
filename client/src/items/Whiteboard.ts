import { ItemType } from '../../../types/Items'
import store from '../stores'
import { sanitizeId } from '../util'
import Item from './Item'
import Network from '../services/Network'
import { openWhiteboardDialog } from '../stores/WhiteboardStore'

export default class Whiteboard extends Item {
  id?: string
  currentUsers = new Set<string>()

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frame?: string | number) {
    super(scene, x, y, texture, frame)

    this.itemType = ItemType.WHITEBOARD
  }

  private updateStatus() {
    if (!this.currentUsers) return
    const names = Array.from(this.currentUsers).map((userId) => {
      const participant = store.getState().participants.participants.get(userId)
      if (participant?.name) return participant.name
      return store.getState().user.playerNameMap.get(sanitizeId(userId)) ?? 'Guest'
    })

    this.clearStatusBox()
    if (names.length === 0) return
    if (names.length === 1) {
      this.setStatusBox(names[0])
    } else if (names.length === 2) {
      this.setStatusBox(names.join(', '))
    } else {
      this.setStatusBox(`${names.length} users`)
    }
  }

  addCurrentUser(userId: string) {
    if (!this.currentUsers || this.currentUsers.has(userId)) return
    this.currentUsers.add(userId)
    this.updateStatus()
  }

  removeCurrentUser(userId: string) {
    if (!this.currentUsers || !this.currentUsers.has(userId)) return
    this.currentUsers.delete(userId)
    this.updateStatus()
  }

  openDialog(network: Network) {
    if (!this.id) return
    store.dispatch(openWhiteboardDialog(this.id))
    network.connectToWhiteboard(this.id)
  }
}
