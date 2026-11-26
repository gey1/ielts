const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/

export function isStableId(value: string): boolean {
  return ID_PATTERN.test(value)
}

export function normalizeFront(front: string): string {
  return front.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function frontKey(type: string, front: string): string {
  return `${type.trim().toLowerCase()}\n${normalizeFront(front)}`
}

export function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function deriveCardId(type: string, front: string): string {
  return `card-${cyrb53(frontKey(type, front))}`
}

export function deriveCollectionId(name: string): string {
  const slug = slugify(name)
  if (slug) return `col-${slug}`.slice(0, 80)
  return `col-${cyrb53(name.trim().toLowerCase())}`
}

export function deriveTagId(name: string): string {
  const slug = slugify(name)
  if (slug) return `tag-${slug}`.slice(0, 80)
  return `tag-${cyrb53(name.trim().toLowerCase())}`
}

export function linkId(cardId: string, otherId: string): string {
  return `${cardId}:${otherId}`
}

export function srsId(cardId: string, skill: string): string {
  return `${cardId}:${skill}`
}

export function createId(prefix: string): string {
  const cryptoRef = globalThis.crypto
  const rand = cryptoRef?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${rand}`
}
