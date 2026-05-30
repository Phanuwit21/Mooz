import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mapDir = path.join(__dirname, '../public/assets/map')

function pngSize(filePath) {
  if (!fs.existsSync(filePath)) return null
  const buf = fs.readFileSync(filePath)
  if (buf.length < 24) return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

const json = JSON.parse(fs.readFileSync(path.join(mapDir, 'Maps.json'), 'utf8'))

console.log('=== Tileset image expected vs actual ===')
for (const ts of json.tilesets) {
  const img = ts.image.replace(/^\.\.\//, '').replace(/\\/g, '/')
  const candidates = [
    path.join(mapDir, path.basename(img)),
    path.join(mapDir, img),
    path.join(__dirname, '../public/assets/tileset', path.basename(img)),
    path.join(__dirname, '../public/assets/items', path.basename(img)),
  ]
  let found = null
  for (const c of candidates) {
    const size = pngSize(c)
    if (size) {
      found = { path: c, ...size }
      break
    }
  }
  const ok =
    found &&
    found.width === ts.imagewidth &&
    found.height === ts.imageheight
  console.log(
    `${ts.name} (gid ${ts.firstgid}): need ${ts.imagewidth}x${ts.imageheight}`,
    found
      ? `→ ${path.relative(path.join(__dirname, '..'), found.path)} ${found.width}x${found.height} ${ok ? 'OK' : 'SIZE MISMATCH'}`
      : '→ MISSING'
  )
}

const tmx = fs.readFileSync(path.join(mapDir, 'Maps.tmx'), 'utf8')
const jsonGround = json.layers.find((l) => l.name === 'Ground').data
const dStart = tmx.indexOf('name="Ground"')
const csvStart = tmx.indexOf('<data encoding="csv">', dStart) + 22
const csvEnd = tmx.indexOf('</data>', csvStart)
const tmxGround = tmx
  .slice(csvStart, csvEnd)
  .replace(/\s+/g, '')
  .split(',')
  .map(Number)
let diffs = 0
for (let i = 0; i < jsonGround.length; i++) {
  if (tmxGround[i] !== jsonGround[i]) diffs++
}
console.log(`\nGround layer TMX vs JSON: ${diffs} differences / ${jsonGround.length} tiles`)
