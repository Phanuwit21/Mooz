import Phaser from 'phaser'
import Player from './Player'
import MyPlayer from './MyPlayer'
import { sittingShiftData } from './Player'
import WebRTC from '../web/WebRTC'
import { Event, phaserEvents } from '../events/EventCenter'
import { PlayerPresence } from '../../../types/PlayerPresence'

export const VIDEO_PROXIMITY_RADIUS = 120

export default class OtherPlayer extends Player {
  private targetPosition: [number, number]
  private lastUpdateTimestamp?: number
  private playContainerBody: Phaser.Physics.Arcade.Body
  videoCallConnected = false
  screenSharing = false
  inMeeting = false
  deskId = ''
  deskName = ''

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    id: string,
    name: string,
    frame?: string | number
  ) {
    super(scene, x, y, texture, id, frame)
    this.targetPosition = [x, y]

    this.setPlayerName(name)
    this.playContainerBody = this.playerContainer.body as Phaser.Physics.Arcade.Body
  }

  tryConnect(myPlayer: MyPlayer, webRTC: WebRTC) {
    if (
      this.videoCallConnected ||
      !myPlayer.readyToConnect ||
      !this.readyToConnect ||
      !myPlayer.videoConnected ||
      !this.videoConnected ||
      myPlayer.playerId <= this.playerId
    ) {
      return
    }

    webRTC.connectToNewUser(this.playerId)
    this.videoCallConnected = true
  }

  disconnectVideoCall() {
    if (!this.videoCallConnected) return
    this.videoCallConnected = false
    phaserEvents.emit(Event.PLAYER_DISCONNECTED, this.playerId)
  }

  updateOtherPlayer(field: string, value: number | string | boolean) {
    switch (field) {
      case 'name':
        if (typeof value === 'string') {
          this.setPlayerName(value)
        }
        break

      case 'presence':
        if (typeof value === 'string') {
          this.setPresence(value)
        }
        break

      case 'areaId':
        if (typeof value === 'string') {
          this.areaId = value
        }
        break

      case 'areaName':
        if (typeof value === 'string') {
          this.areaName = value
        }
        break

      case 'x':
        if (typeof value === 'number') {
          this.targetPosition[0] = value
        }
        break

      case 'y':
        if (typeof value === 'number') {
          this.targetPosition[1] = value
        }
        break

      case 'anim':
        if (typeof value === 'string') {
          this.anims.play(value, true)
        }
        break

      case 'readyToConnect':
        if (typeof value === 'boolean') {
          this.readyToConnect = value
        }
        break

      case 'videoConnected':
        if (typeof value === 'boolean') {
          this.videoConnected = value
        }
        break

      case 'handRaised':
        if (typeof value === 'boolean') {
          this.setHandRaised(value)
        }
        break

      case 'screenSharing':
        if (typeof value === 'boolean') {
          this.screenSharing = value
        }
        break

      case 'inMeeting':
        if (typeof value === 'boolean') {
          this.inMeeting = value
        }
        break

      case 'deskId':
        if (typeof value === 'string') {
          this.deskId = value
        }
        break

      case 'deskName':
        if (typeof value === 'string') {
          this.deskName = value
        }
        break
    }
  }

  destroy(fromScene?: boolean) {
    this.playerContainer.destroy()

    super.destroy(fromScene)
  }

  /** preUpdate is called every frame for every game object. */
  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt)

    if (this.lastUpdateTimestamp && t - this.lastUpdateTimestamp > 1200) {
      this.lastUpdateTimestamp = t
      this.x = this.targetPosition[0]
      this.y = this.targetPosition[1]
      this.playerContainer.x = this.targetPosition[0]
      this.playerContainer.y = this.targetPosition[1] - 30
      return
    }

    this.lastUpdateTimestamp = t
    this.setDepth(this.y)
    const animParts = this.anims.currentAnim.key.split('_')
    const animState = animParts[1]
    if (animState === 'sit') {
      const animDir = animParts[2]
      const sittingShift = sittingShiftData[animDir]
      if (sittingShift) {
        this.setDepth(this.depth + sittingShiftData[animDir][2])
      }
    }

    const speed = 320
    const delta = (speed / 1000) * dt
    let dx = this.targetPosition[0] - this.x
    let dy = this.targetPosition[1] - this.y

    if (Math.abs(dx) < delta) {
      this.x = this.targetPosition[0]
      this.playerContainer.x = this.targetPosition[0]
      dx = 0
    }
    if (Math.abs(dy) < delta) {
      this.y = this.targetPosition[1]
      this.playerContainer.y = this.targetPosition[1] - 30
      dy = 0
    }

    let vx = 0
    let vy = 0
    if (dx > 0) vx += speed
    else if (dx < 0) vx -= speed
    if (dy > 0) vy += speed
    else if (dy < 0) vy -= speed

    this.setVelocity(vx, vy)
    this.body.velocity.setLength(speed)
    this.playContainerBody.setVelocity(vx, vy)
    this.playContainerBody.velocity.setLength(speed)
  }
}

declare global {
  namespace Phaser.GameObjects {
    interface GameObjectFactory {
      otherPlayer(
        x: number,
        y: number,
        texture: string,
        id: string,
        name: string,
        frame?: string | number
      ): OtherPlayer
    }
  }
}

Phaser.GameObjects.GameObjectFactory.register(
  'otherPlayer',
  function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    texture: string,
    id: string,
    name: string,
    frame?: string | number
  ) {
    const sprite = new OtherPlayer(this.scene, x, y, texture, id, name, frame)

    this.displayList.add(sprite)
    this.updateList.add(sprite)

    this.scene.physics.world.enableBody(sprite, Phaser.Physics.Arcade.DYNAMIC_BODY)

    const collisionScale = [6, 4]
    sprite.body
      .setSize(sprite.width * collisionScale[0], sprite.height * collisionScale[1])
      .setOffset(
        sprite.width * (1 - collisionScale[0]) * 0.5,
        sprite.height * (1 - collisionScale[1]) * 0.5 + 17
      )

    return sprite
  }
)
