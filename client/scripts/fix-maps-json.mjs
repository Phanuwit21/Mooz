/**

 * Sanitize Maps.json: inline external .tsx tilesets, strip per-tile properties.

 * Preserves duplicate tilesets (second Interiors / Modern) required by layer GIDs.

 */

import fs from 'fs'

import path from 'path'

import { fileURLToPath } from 'url'



const __dirname = path.dirname(fileURLToPath(import.meta.url))

const mapDir = path.join(__dirname, '../public/assets/map')

const mapPath = path.join(mapDir, 'Maps.json')



const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'))



function parseTsxTileset(tsxPath) {

  const xml = fs.readFileSync(tsxPath, 'utf8')

  const name = xml.match(/name="([^"]+)"/)?.[1]

  const tilewidth = Number(xml.match(/tilewidth="(\d+)"/)?.[1])

  const tileheight = Number(xml.match(/tileheight="(\d+)"/)?.[1])

  const tilecount = Number(xml.match(/tilecount="(\d+)"/)?.[1])

  const columns = Number(xml.match(/columns="(\d+)"/)?.[1])

  const imageMatch = xml.match(/<image source="([^"]+)" width="(\d+)" height="(\d+)"/)

  if (!imageMatch) throw new Error(`No image in ${tsxPath}`)



  const imageSource = imageMatch[1].replace(/\\/g, '/')

  const imageAbs = path.resolve(path.dirname(tsxPath), imageSource)

  const imageInMap = path.relative(mapDir, imageAbs).replace(/\\/g, '/')



  return {

    columns,

    image: imageInMap.startsWith('..') ? imageInMap : `../${imageInMap}`,

    imageheight: Number(imageMatch[2]),

    imagewidth: Number(imageMatch[3]),

    margin: 0,

    name,

    spacing: 0,

    tilecount,

    tileheight,

    tilewidth,

  }

}



for (let i = 0; i < map.tilesets.length; i++) {

  const ts = map.tilesets[i]

  if (!ts.source) continue



  const tsxPath = path.join(mapDir, ts.source)

  if (!fs.existsSync(tsxPath)) {

    console.error(`Missing external tileset: ${tsxPath}`)

    process.exit(1)

  }



  const embedded = parseTsxTileset(tsxPath)

  map.tilesets[i] = { firstgid: ts.firstgid, ...embedded }

  console.log(`Inlined ${ts.source} at firstgid ${ts.firstgid}`)

}



for (const ts of map.tilesets) {

  delete ts.tiles

}



function calcTotal(ts) {

  if (ts.tilecount) return ts.tilecount

  const tw = ts.tilewidth || map.tilewidth

  const th = ts.tileheight || map.tileheight

  const margin = ts.margin || 0

  const spacing = ts.spacing || 0

  const rows = Math.floor((ts.imageheight - margin * 2 + spacing) / (th + spacing))

  const cols = Math.floor((ts.imagewidth - margin * 2 + spacing) / (tw + spacing))

  return rows * cols

}



const tiles = []

map.tilesets.forEach((set, i) => {

  const total = calcTotal(set)

  for (let t = set.firstgid; t < set.firstgid + total; t++) {

    tiles[t] = i

  }

})



const missing = []

for (const layer of map.layers) {

  if (!layer.data) continue

  for (const raw of layer.data) {

    if (!raw) continue

    const gid = raw & ~0xe0000000

    if (tiles[gid] === undefined) missing.push({ layer: layer.name, gid })

  }

}



if (missing.length) {

  console.error('GID validation failed — re-export from Tiled with embedded tilesets:', missing.slice(0, 10))

  process.exit(1)

}



fs.writeFileSync(mapPath, JSON.stringify(map))

console.log(`Wrote ${mapPath} (${map.tilesets.length} tilesets, ${missing.length} missing gids)`)


