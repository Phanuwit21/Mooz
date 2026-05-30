import Phaser from 'phaser'

import PlayerSelector from './PlayerSelector'
import Player from './Player'
import Network from '../services/Network'
import { phaserEvents, Event } from '../events/EventCenter'
import store from '../stores'
import { pushPlayerJoinedMessage } from '../stores/ChatStore'
import { ItemType } from '../../../types/Items'
import { NavKeys } from '../../../types/KeyboardState'
import { JoystickMovement } from '../components/Joystick'
import { openURL } from '../utils/helpers'

export default class MyPlayer extends Player {
  private playContainerBody: Phaser.Physics.Arcade.Body
  private lastNetworkSync = 0
  private wasMoving = false

  public joystickMovement?: JoystickMovement

  handRaised = false
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
    frame?: string | number
  ) {
    super(scene, x, y, texture, id, frame)
    this.playContainerBody = this.playerContainer.body as Phaser.Physics.Arcade.Body
  }

  setPlayerName(name: string) {
    super.setPlayerName(name)
    phaserEvents.emit(Event.MY_PLAYER_NAME_CHANGE, name)
    store.dispatch(pushPlayerJoinedMessage(name))
  }

  syncParticipantList(network: Network) {
    network.syncMyParticipant(
      this.playerName.text,
      this.playerPresence,
      this.areaId,
      this.areaName,
      this.deskId,
      this.deskName,
      this.handRaised,
      this.screenSharing,
      this.inMeeting
    )
  }

  setPlayerTexture(texture: string) {
    this.playerTexture = texture
    this.anims.play(`${this.playerTexture}_idle_down`, true)
    phaserEvents.emit(Event.MY_PLAYER_TEXTURE_CHANGE, this.x, this.y, this.anims.currentAnim.key)
  }

  handleJoystickMovement(movement: JoystickMovement) {
    this.joystickMovement = movement
  }

  update(
    playerSelector: PlayerSelector,
    cursors: NavKeys,
    keyE: Phaser.Input.Keyboard.Key,
    keyR: Phaser.Input.Keyboard.Key,
    network: Network,
    followTarget: { x: number; y: number } | null = null
  ): boolean {
    if (!cursors) return false

    if (keyR && Phaser.Input.Keyboard.JustDown(keyR)) {
      const item = playerSelector.selectedItem
      if (item?.itemType === ItemType.VENDINGMACHINE) {
        openURL('https://www.buymeacoffee.com/skyoffice')
      }
    }

    const speed = 200
    let vx = 0
    let vy = 0

    let joystickLeft = false
    let joystickRight = false
    let joystickUp = false
    let joystickDown = false

    if (this.joystickMovement?.isMoving) {
      joystickLeft = this.joystickMovement.direction.left
      joystickRight = this.joystickMovement.direction.right
      joystickUp = this.joystickMovement.direction.up
      joystickDown = this.joystickMovement.direction.down
    }

    const manualInput =
      cursors.left?.isDown ||
      cursors.A?.isDown ||
      cursors.right?.isDown ||
      cursors.D?.isDown ||
      cursors.up?.isDown ||
      cursors.W?.isDown ||
      cursors.down?.isDown ||
      cursors.S?.isDown ||
      joystickLeft ||
      joystickRight ||
      joystickUp ||
      joystickDown

    if (manualInput && followTarget) {
      return true
    }

    if (followTarget && !manualInput) {
      const dx = followTarget.x - this.x
      const dy = followTarget.y - this.y
      const dist = Math.hypot(dx, dy)
      const stopDist = 64

      if (dist > stopDist) {
        vx = (dx / dist) * speed
        vy = (dy / dist) * speed
      }
    } else if (cursors.left?.isDown || cursors.A?.isDown || joystickLeft) {
      vx -= speed
    } else if (cursors.right?.isDown || cursors.D?.isDown || joystickRight) {
      vx += speed
    }

    if (!followTarget || manualInput) {
      if (cursors.up?.isDown || cursors.W?.isDown || joystickUp) {
        vy -= speed
      } else if (cursors.down?.isDown || cursors.S?.isDown || joystickDown) {
        vy += speed
      }
    }

    this.setVelocity(vx, vy)
    this.playContainerBody.setVelocity(vx, vy)

    const moving = vx !== 0 || vy !== 0
    const animKey = this.anims.currentAnim?.key ?? `${this.playerTexture}_idle_down`

    if (moving) {
      const parts = animKey.split('_')
      parts[1] = 'run'
      if (vx < 0) {
        parts[2] = 'left'
      } else if (vx > 0) {
        parts[2] = 'right'
      } else if (vy < 0) {
        parts[2] = 'up'
      } else if (vy > 0) {
        parts[2] = 'down'
      }
      const newAnim = parts.join('_')
      if (animKey !== newAnim) {
        this.play(newAnim, true)
      }
    } else {
      const parts = animKey.split('_')
      parts[1] = 'idle'
      const newAnim = parts.join('_')
      if (animKey !== newAnim) {
        this.play(newAnim, true)
      }
    }

    const now = this.scene.time.now
    const currentAnim = this.anims.currentAnim?.key ?? animKey
    if (moving && now - this.lastNetworkSync >= 50) {
      network.updatePlayer(this.x, this.y, currentAnim)
      this.lastNetworkSync = now
    } else if (!moving && this.wasMoving) {
      network.updatePlayer(this.x, this.y, currentAnim)
      this.lastNetworkSync = now
    }
    this.wasMoving = moving
    return false
  }
}

declare global {
  namespace Phaser.GameObjects {
    interface GameObjectFactory {
      myPlayer(x: number, y: number, texture: string, id: string, frame?: string | number): MyPlayer
    }
  }
}

Phaser.GameObjects.GameObjectFactory.register(
  'myPlayer',
  function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    texture: string,
    id: string,
    frame?: string | number
  ) {
    const sprite = new MyPlayer(this.scene, x, y, texture, id, frame)

    this.displayList.add(sprite)
    this.updateList.add(sprite)

    this.scene.physics.world.enableBody(sprite, Phaser.Physics.Arcade.DYNAMIC_BODY)

    const collisionScale = [0.5, 0.2]
    sprite.body
      .setSize(sprite.width * collisionScale[0], sprite.height * collisionScale[1])
      .setOffset(
        sprite.width * (1 - collisionScale[0]) * 0.5,
        sprite.height * (1 - collisionScale[1])
      )

    return sprite
  }
)
