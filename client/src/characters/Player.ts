import Phaser from 'phaser'
import { PlayerBehavior } from '../../../types/PlayerBehavior'
import { PlayerPresence } from '../../../types/PlayerPresence'

/**
 * shifting distance for sitting animation
 * format: direction: [xShift, yShift, depthShift]
 */
/** Offsets from chair foot position (origin 0.5, 1): [x, y, depthDelta] */
export const sittingShiftData: Record<string, [number, number, number]> = {
  up: [0, 10, -8],
  down: [0, -6, 4],
  left: [10, 2, 4],
  right: [-10, 2, 4],
}

const PRESENCE_COLORS: Record<PlayerPresence, number> = {
  [PlayerPresence.ONLINE]: 0x22c55e,
  [PlayerPresence.AFK]: 0xeab308,
}

export default class Player extends Phaser.Physics.Arcade.Sprite {
  playerId: string
  playerTexture: string
  playerBehavior = PlayerBehavior.IDLE
  readyToConnect = false
  videoConnected = false
  playerPresence = PlayerPresence.ONLINE
  areaId = ''
  areaName = ''
  playerName: Phaser.GameObjects.Text
  playerContainer: Phaser.GameObjects.Container
  private playerDialogBubble: Phaser.GameObjects.Container
  private nameTagBg: Phaser.GameObjects.Graphics
  private statusDot: Phaser.GameObjects.Arc
  private handRaisedIcon?: Phaser.GameObjects.Text
  private timeoutID?: number
  handRaised = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    id: string,
    frame?: string | number
  ) {
    super(scene, x, y, texture, frame)

    this.playerId = id
    this.playerTexture = texture
    this.setDepth(this.y)

    this.anims.play(`${this.playerTexture}_idle_down`, true)

    this.playerContainer = this.scene.add.container(this.x, this.y - 30).setDepth(5000)

    this.playerDialogBubble = this.scene.add.container(0, 0).setDepth(5000)
    this.playerContainer.add(this.playerDialogBubble)

    this.nameTagBg = this.scene.add.graphics()
    this.statusDot = this.scene.add.circle(0, 0, 4, PRESENCE_COLORS[PlayerPresence.ONLINE])
    this.playerName = this.scene.add
      .text(0, 0, '')
      .setFontFamily('Arial, sans-serif')
      .setFontSize(11)
      .setColor('#ffffff')
      .setOrigin(0.5)
    this.playerContainer.add([this.nameTagBg, this.statusDot, this.playerName])

    this.scene.physics.world.enable(this.playerContainer)
    const playContainerBody = this.playerContainer.body as Phaser.Physics.Arcade.Body
    const collisionScale = [0.5, 0.2]
    playContainerBody
      .setSize(this.width * collisionScale[0], this.height * collisionScale[1])
      .setOffset(-8, this.height * (1 - collisionScale[1]) + 6)
  }

  setPlayerName(name: string) {
    this.playerName.setText(name)
    this.refreshNameTagLayout()
  }

  setPresence(presence: PlayerPresence | string) {
    const normalized =
      presence === PlayerPresence.AFK ? PlayerPresence.AFK : PlayerPresence.ONLINE
    this.playerPresence = normalized
    this.statusDot.setFillStyle(PRESENCE_COLORS[normalized])
  }

  setArea(areaId: string, areaName: string) {
    this.areaId = areaId
    this.areaName = areaName
  }

  setHandRaised(raised: boolean) {
    this.handRaised = raised
    if (raised) {
      if (!this.handRaisedIcon) {
        this.handRaisedIcon = this.scene.add.text(0, -22, '✋', { fontSize: '14px' }).setOrigin(0.5)
        this.playerContainer.add(this.handRaisedIcon)
      }
      this.handRaisedIcon.setVisible(true)
    } else {
      this.handRaisedIcon?.setVisible(false)
    }
  }

  private refreshNameTagLayout() {
    const paddingX = 8
    const paddingY = 4
    const gap = 6
    const dotR = 4
    const textW = this.playerName.width
    const textH = this.playerName.height
    const innerW = dotR * 2 + gap + textW
    const totalW = innerW + paddingX * 2
    const totalH = Math.max(dotR * 2, textH) + paddingY * 2
    const left = -totalW / 2

    this.nameTagBg.clear()
    this.nameTagBg.fillStyle(0x1e293b, 0.88)
    this.nameTagBg.fillRoundedRect(left, -totalH / 2, totalW, totalH, 6)

    this.statusDot.setPosition(left + paddingX + dotR, 0)
    this.playerName.setPosition(left + paddingX + dotR * 2 + gap + textW / 2, 0)
  }

  updateDialogBubble(content: string) {
    this.clearDialogBubble()

    const dialogBubbleText = content.length <= 70 ? content : content.substring(0, 70).concat('...')

    const innerText = this.scene.add
      .text(0, 0, dialogBubbleText, { wordWrap: { width: 165, useAdvancedWrap: true } })
      .setFontFamily('Arial')
      .setFontSize(12)
      .setColor('#000000')
      .setOrigin(0.5)

    const innerTextHeight = innerText.height
    const innerTextWidth = innerText.width

    innerText.setY(-innerTextHeight / 2 - this.playerName.height / 2 - 8)
    const dialogBoxWidth = innerTextWidth + 10
    const dialogBoxHeight = innerTextHeight + 3
    const dialogBoxX = innerText.x - innerTextWidth / 2 - 5
    const dialogBoxY = innerText.y - innerTextHeight / 2 - 2

    this.playerDialogBubble.add(
      this.scene.add
        .graphics()
        .fillStyle(0xffffff, 1)
        .fillRoundedRect(dialogBoxX, dialogBoxY, dialogBoxWidth, dialogBoxHeight, 3)
        .lineStyle(1, 0x000000, 1)
        .strokeRoundedRect(dialogBoxX, dialogBoxY, dialogBoxWidth, dialogBoxHeight, 3)
    )
    this.playerDialogBubble.add(innerText)

    this.timeoutID = window.setTimeout(() => {
      this.clearDialogBubble()
    }, 6000)
  }

  private clearDialogBubble() {
    clearTimeout(this.timeoutID)
    this.playerDialogBubble.removeAll(true)
  }
}
