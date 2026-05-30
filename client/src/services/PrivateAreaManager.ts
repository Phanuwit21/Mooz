import Phaser from 'phaser'
import { IPrivateArea, OPEN_OFFICE_AREA_ID } from '../../../types/PrivateArea'

/** Fallback zones when the map has no PrivateAreas object layer yet. */
const DEFAULT_AREAS: IPrivateArea[] = [
  { id: 'lounge', name: 'Lounge', x: 32, y: 96, width: 544, height: 576 },
  { id: 'meeting', name: 'Meeting Room', x: 608, y: 96, width: 800, height: 576 },
  { id: 'office', name: 'Private Office', x: 1440, y: 96, width: 416, height: 544 },
]

export default class PrivateAreaManager {
  private areas: IPrivateArea[] = []

  constructor(map: Phaser.Tilemaps.Tilemap) {
    const layer = map.getObjectLayer('PrivateAreas')
    if (layer?.objects?.length) {
      layer.objects.forEach((obj, index) => {
        if (obj.width == null || obj.height == null) return
        const props = obj.properties as { name?: string; value?: string }[] | undefined
        const typeProp = props?.find((p) => p.name === 'type')?.value
        if (typeProp === 'spawn') return

        this.areas.push({
          id: String(obj.id ?? `area-${index}`),
          name: obj.name || `Area ${index + 1}`,
          x: obj.x ?? 0,
          y: obj.y ?? 0,
          width: obj.width,
          height: obj.height,
        })
      })
    }

    if (this.areas.length === 0) {
      this.areas = DEFAULT_AREAS
    }
  }

  getAreas(): IPrivateArea[] {
    return this.areas
  }

  getAreaAt(x: number, y: number): IPrivateArea | null {
    for (const area of this.areas) {
      if (x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height) {
        return area
      }
    }
    return null
  }

  getAreaById(areaId: string): IPrivateArea | null {
    if (!areaId || areaId === OPEN_OFFICE_AREA_ID) return null
    return this.areas.find((a) => a.id === areaId) ?? null
  }
}
