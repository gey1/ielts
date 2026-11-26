export function normalizeAnswer(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function editDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0))
  for (let i = 0; i < rows; i += 1) matrix[i]![0] = i
  for (let j = 0; j < cols; j += 1) matrix[0]![j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      )
    }
  }
  return matrix[a.length]![b.length]!
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function answersMatch(expected: string, given: string): boolean {
  const a = normalizeAnswer(expected)
  const b = normalizeAnswer(given)
  if (!a || !b) return false
  if (a === b) return true
  if (a.length >= 4 && a.length <= 60 && new RegExp(`(?:^|\\s)${escapeRegExp(a)}(?:\\s|$)`).test(b)) return true
  if (a.length <= 60 && b.length <= 80) {
    const distance = editDistance(a, b)
    return distance <= 2 && distance / Math.max(a.length, 1) <= 0.25
  }
  const words = a.split(' ').filter((word) => word.length > 3)
  if (words.length === 0) return false
  const givenWords = new Set(b.split(' '))
  const hits = words.filter((word) => givenWords.has(word)).length
  return hits / words.length >= 0.8
}

export function makeCloze(sentence: string, target: string): { prompt: string; answer: string } | null {
  const lemma = target.trim()
  if (!lemma) return null
  const forms = [lemma]
  if (lemma.length > 2 && !lemma.includes(' ')) {
    forms.push(lemma + 's', lemma + 'es', lemma + 'ed', lemma + 'd', lemma + 'ing')
    if (/e$/i.test(lemma)) forms.push(`${lemma.slice(0, -1)}ing`)
  }
  const lower = sentence.toLowerCase()
  for (const form of forms) {
    const needle = form.toLowerCase()
    let from = 0
    while (from < lower.length) {
      const index = lower.indexOf(needle, from)
      if (index < 0) break
      const before = index === 0 ? '' : sentence[index - 1] ?? ''
      const after = sentence[index + form.length] ?? ''
      if ((!before || !/[a-z]/i.test(before)) && (!after || !/[a-z]/i.test(after))) {
        return {
          prompt: `${sentence.slice(0, index)}______${sentence.slice(index + form.length)}`,
          answer: sentence.slice(index, index + form.length),
        }
      }
      from = index + needle.length
    }
  }
  return null
}
