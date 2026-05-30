import Phaser from 'phaser'

export interface IDeskZone {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
}

export default class DeskAreaManager {
  private desks: IDeskZone[] = []

  constructor(map: Phaser.Tilemaps.Tilemap) {
    const layer = map.getObjectLayer('Desks')
    if (layer?.objects?.length) {
      layer.objects.forEach((obj, index) => {
        if (obj.width == null || obj.height == null) return
        this.desks.push({
          id: String(obj.id ?? `desk-${index}`),
          name: obj.name || `Desk ${index + 1}`,
          x: obj.x ?? 0,
          y: obj.y ?? 0,
          width: obj.width,
          height: obj.height,
        })
      })
    }
  }

  hasDesks() {
    return this.desks.length > 0
  }

  getDeskAt(x: number, y: number): IDeskZone | null {
    for (const desk of this.desks) {
      if (x >= desk.x && x <= desk.x + desk.width && y >= desk.y && y <= desk.y + desk.height) {
        return desk
      }
    }
    return null
  }

  getDeskById(deskId: string): IDeskZone | null {
    return this.desks.find((d) => d.id === deskId) ?? null
  }

  getDesks(): IDeskZone[] {
    return this.desks
  }
}
