import Phaser from 'phaser'

const DEFAULT_SPAWN = { x: 960, y: 1440 }

/** Player spawn from Tiled object with type/property `spawn`. */
export function getMapSpawnPoint(map: Phaser.Tilemaps.Tilemap): { x: number; y: number } {
  for (const layerName of ['Spawn', 'PrivateAreas']) {
    const layer = map.getObjectLayer(layerName)
    if (!layer?.objects?.length) continue

    for (const obj of layer.objects) {
      const props = obj.properties as { name?: string; value?: string }[] | undefined
      const typeProp = props?.find((p) => p.name === 'type')?.value
      if (obj.type !== 'spawn' && typeProp !== 'spawn') continue

      return {
        x: (obj.x ?? 0) + (obj.width ?? 32) / 2,
        y: (obj.y ?? 0) + (obj.height ?? 32) / 2,
      }
    }
  }

  return DEFAULT_SPAWN
}
