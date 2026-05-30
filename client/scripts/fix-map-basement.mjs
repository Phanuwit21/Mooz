import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const jsonPath = path.join(__dirname, '../public/assets/map/Maps.json')
const map = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
const W = 60

function clearTile(layerName, x, y) {
  const layer = map.layers.find((l) => l.name === layerName)
  if (!layer?.data) return false
  const i = y * W + x
  if (!layer.data[i]) return false
  layer.data[i] = 0
  return true
}

let cleared = 0

// Open basement doorway (cols 31–34 between upper floor and basement)
for (let y = 38; y <= 41; y++) {
  for (let x = 31; x <= 34; x++) {
    for (const layerName of [
      'Wall',
      'Objects',
      'ObjectsOnCollide',
      'GenericObjectsOnCollide',
      'GenericObjectsCollide',
    ]) {
      if (clearTile(layerName, x, y)) cleared++
    }
  }
}

// Remove narrow collision in the doorway on row 41
for (const x of [30]) {
  if (clearTile('ObjectsOnCollide', x, 41)) cleared++
}

fs.writeFileSync(jsonPath, JSON.stringify(map))
console.log(`Cleared ${cleared} blocking tiles for basement doorway in Maps.json`)
