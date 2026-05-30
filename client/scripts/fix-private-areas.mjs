import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Private zones aligned to wall layout: left / center / right wings (rows 3–20). */
const areas = [
  { id: 1, name: 'Lounge', x: 32, y: 96, width: 544, height: 576 },
  { id: 2, name: 'Meeting Room', x: 608, y: 96, width: 800, height: 576 },
  { id: 3, name: 'Private Office', x: 1440, y: 96, width: 416, height: 544 },
]

const jsonPath = path.join(__dirname, '../public/assets/map/Maps.json')
const map = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
const pa = map.layers.find((l) => l.name === 'PrivateAreas')
if (pa) {
  pa.objects = areas.map((a) => ({
    id: a.id,
    name: a.name,
    type: 'private',
    x: a.x,
    y: a.y,
    width: a.width,
    height: a.height,
    rotation: 0,
    visible: true,
  }))
  fs.writeFileSync(jsonPath, JSON.stringify(map))
  console.log('Updated Maps.json PrivateAreas')
}

const tmxPath = path.join(__dirname, '../public/assets/map/Maps.tmx')
let tmx = fs.readFileSync(tmxPath, 'utf8')
const objXml = areas
  .map(
    (a) =>
      `  <object id="${a.id}" name="${a.name}" type="private" x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}"/>`
  )
  .join('\n')
tmx = tmx.replace(
  /<objectgroup id="14" name="PrivateAreas">[\s\S]*?<\/objectgroup>/,
  `<objectgroup id="14" name="PrivateAreas">\n${objXml}\n </objectgroup>`
)
fs.writeFileSync(tmxPath, tmx)
console.log('Updated Maps.tmx PrivateAreas')
