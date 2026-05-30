import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mapPath = path.join(__dirname, '../public/assets/map/Maps.json')
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'))

const pa = map.layers.find((l) => l.name === 'PrivateAreas')
if (pa) {
  pa.objects = [
    {
      id: 1,
      name: 'Lounge',
      type: 'private',
      x: 32,
      y: 96,
      width: 544,
      height: 576,
      rotation: 0,
      visible: true,
    },
    {
      id: 2,
      name: 'Meeting Room',
      type: 'private',
      x: 608,
      y: 96,
      width: 800,
      height: 576,
      rotation: 0,
      visible: true,
    },
    {
      id: 3,
      name: 'Private Office',
      type: 'private',
      x: 1440,
      y: 96,
      width: 416,
      height: 544,
      rotation: 0,
      visible: true,
    },
    {
      id: 99,
      name: 'Entrance',
      type: 'spawn',
      x: 896,
      y: 1376,
      width: 128,
      height: 96,
      rotation: 0,
      visible: true,
      properties: [{ name: 'type', type: 'string', value: 'spawn' }],
    },
  ]
}

fs.writeFileSync(mapPath, JSON.stringify(map))
console.log('Updated PrivateAreas + spawn in Maps.json')
