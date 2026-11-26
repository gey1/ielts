import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const table = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  table[n] = c
}

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([length, typeBuf, data, crc])
}

function inRound(x, y, left, top, right, bottom, radius) {
  if (x < left || y < top || x > right || y > bottom) return false
  const dx = x < left + radius ? left + radius - x : x > right - radius ? x - (right - radius) : 0
  const dy = y < top + radius ? top + radius - y : y > bottom - radius ? y - (bottom - radius) : 0
  return dx * dx + dy * dy <= radius * radius
}

function png(size, maskable) {
  const pixels = Buffer.alloc(size * size * 4)
  const green = [0x1e, 0x6b, 0x52, 255]
  const paper = [0xf7, 0xf3, 0xea, 255]
  const outer = Math.round(size * (maskable ? 0.18 : 0.22))
  const cardPad = Math.round(size * (maskable ? 0.3 : 0.24))
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4
      const onPlate = inRound(x, y, 0, 0, size - 1, size - 1, outer)
      const onCard = inRound(x, y, cardPad, cardPad + size * 0.02, size - 1 - cardPad, size - 1 - cardPad, size * 0.06)
      let color = onPlate ? green : [0x1e, 0x6b, 0x52, 255]
      if (!maskable && !onPlate) color = [0, 0, 0, 0]
      if (onCard && onPlate) color = paper
      const line = (ratio, width) => {
        const yLine = size * ratio
        const half = Math.max(2, size * 0.012)
        return Math.abs(y - yLine) <= half && x > cardPad + size * 0.08 && x < cardPad + size * width
      }
      if (onCard && (line(0.46, 0.42) || line(0.53, 0.34) || line(0.6, 0.26))) color = green
      pixels[i] = color[0]
      pixels[i + 1] = color[1]
      pixels[i + 2] = color[2]
      pixels[i + 3] = color[3]
    }
  }
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', png(192, false))
writeFileSync('public/icons/icon-512.png', png(512, false))
writeFileSync('public/icons/icon-maskable-512.png', png(512, true))
writeFileSync('public/apple-touch-icon.png', png(180, true))
console.log('icons written')
