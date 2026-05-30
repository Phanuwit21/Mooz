import Phaser from 'phaser'

export interface ISpotlightZone {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_SPOTLIGHTS: ISpotlightZone[] = [
  { id: 'spot-meeting', name: 'Stage', x: 640, y: 400, width: 192, height: 128 },
]

export default class SpotlightAreaManager {
  private zones: ISpotlightZone[] = []

  constructor(map: Phaser.Tilemaps.Tilemap) {
    const layer = map.getObjectLayer('Spotlight')
    if (layer?.objects?.length) {
      layer.objects.forEach((obj, index) => {
        if (obj.width == null || obj.height == null) return
        this.zones.push({
          id: String(obj.id ?? `spot-${index}`),
          name: obj.name || 'Spotlight',
          x: obj.x ?? 0,
          y: obj.y ?? 0,
          width: obj.width,
          height: obj.height,
        })
      })
    }

    if (this.zones.length === 0) {
      this.zones = DEFAULT_SPOTLIGHTS
    }
  }

  isOnSpotlight(x: number, y: number): boolean {
    return this.zones.some(
      (z) => x >= z.x && x <= z.x + z.width && y >= z.y && y <= z.y + z.height
    )
  }
}
