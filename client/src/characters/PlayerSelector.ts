import Phaser from 'phaser'
import MyPlayer from './MyPlayer'
import Item from '../items/Item'
import { NavKeys } from '../../../types/KeyboardState'
export default class PlayerSelector extends Phaser.GameObjects.Zone {
  selectedItem?: Item

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    super(scene, x, y, width, height)

    scene.physics.add.existing(this)
    this.setOrigin(0.5, 0.5)
  }

  update(player: MyPlayer, cursors: NavKeys) {
    const { x, y } = player
    let dx = 0
    let dy = 32

    let joystickLeft = false
    let joystickRight = false
    let joystickUp = false
    let joystickDown = false
    if (player.joystickMovement?.isMoving) {
      joystickLeft = player.joystickMovement.direction.left
      joystickRight = player.joystickMovement.direction.right
      joystickUp = player.joystickMovement.direction.up
      joystickDown = player.joystickMovement.direction.down
    }

    if (cursors) {
      if (cursors.left?.isDown || cursors.A?.isDown || joystickLeft) {
        dx = -32
        dy = 0
      } else if (cursors.right?.isDown || cursors.D?.isDown || joystickRight) {
        dx = 32
        dy = 0
      } else if (cursors.up?.isDown || cursors.W?.isDown || joystickUp) {
        dx = 0
        dy = -32
      } else if (cursors.down?.isDown || cursors.S?.isDown || joystickDown) {
        dx = 0
        dy = 32
      } else {
        const facing = this.offsetFromFacingAnim(player)
        dx = facing.dx
        dy = facing.dy
      }
    } else {
      const facing = this.offsetFromFacingAnim(player)
      dx = facing.dx
      dy = facing.dy
    }

    this.setPosition(x + dx, y + dy)
  }

  /** Tile in front of the player from current idle/walk animation. */
  private offsetFromFacingAnim(player: MyPlayer) {
    const key = player.anims.currentAnim?.key ?? 'idle_down'
    if (key.includes('left')) return { dx: -32, dy: 0 }
    if (key.includes('right')) return { dx: 32, dy: 0 }
    if (key.includes('up')) return { dx: 0, dy: -32 }
    return { dx: 0, dy: 32 }
  }
}
