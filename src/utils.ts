export function getDailySeed(): number {
  const now = new Date()
  return now.getFullYear() * 1000 + (now.getMonth() + 1) * 31 + now.getDate()
}

export function rotateByDailySeed<T>(items: T[], seedOffset = 0): T[] {
  if (!items || items.length === 0) return items
  const seed = getDailySeed() + seedOffset
  const shift = Math.abs(seed) % items.length
  return [...items.slice(shift), ...items.slice(0, shift)]
}
