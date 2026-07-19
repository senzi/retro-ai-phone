import dictionaryText from '../data/pinyin-dict.txt?raw'

interface DictionaryRow {
  pinyin: string
  content: string
}

interface CandidateEntry {
  word: string
  pinyin: string
  frequency: number
}

const keyForLetter: Record<string, string> = {
  a: '2', b: '2', c: '2', d: '3', e: '3', f: '3',
  g: '4', h: '4', i: '4', j: '5', k: '5', l: '5',
  m: '6', n: '6', o: '6', p: '7', q: '7', r: '7', s: '7',
  t: '8', u: '8', v: '8', w: '9', x: '9', y: '9', z: '9',
}

const resultCache = new Map<string, CandidateEntry[]>()
let numericIndex: Map<string, DictionaryRow[]> | undefined

function digitsFor(pinyin: string): string {
  return [...pinyin].map((letter) => keyForLetter[letter] || '').join('')
}

function getIndex(): Map<string, DictionaryRow[]> {
  if (numericIndex) return numericIndex
  numericIndex = new Map()

  for (const line of dictionaryText.split(/\r?\n/)) {
    const separator = line.indexOf(' ')
    if (separator < 1) continue
    const pinyin = line.slice(0, separator)
    const digits = digitsFor(pinyin)
    if (!digits) continue
    const rows = numericIndex.get(digits) || []
    rows.push({ pinyin, content: line.slice(separator + 1) })
    numericIndex.set(digits, rows)
  }
  return numericIndex
}

function usageKey(sequence: string, word: string): string {
  return `${sequence}:${word}`
}

function learnedFrequency(sequence: string, word: string): number {
  try {
    return Number(localStorage.getItem(`w810-ime:${usageKey(sequence, word)}`) || 0)
  } catch {
    return 0
  }
}

function lookup(sequence: string): CandidateEntry[] {
  if (!sequence) return []
  const cached = resultCache.get(sequence)
  if (cached) return cached

  const rows = getIndex().get(sequence) || []
  const entries: CandidateEntry[] = []
  for (const row of rows) {
    const wordPattern = /(\D+?)(\d+)/g
    let match = wordPattern.exec(row.content)
    while (match) {
      entries.push({
        word: match[1],
        pinyin: row.pinyin,
        frequency: Number(match[2]) + learnedFrequency(sequence, match[1]) * 100_000,
      })
      match = wordPattern.exec(row.content)
    }
  }

  const seen = new Set<string>()
  const result = entries
    .sort((a, b) => b.frequency - a.frequency)
    .filter((entry) => {
      if (seen.has(entry.word)) return false
      seen.add(entry.word)
      return true
    })
  resultCache.set(sequence, result)
  return result
}

export function pinyinCandidates(sequence: string): string[] {
  return lookup(sequence).map((entry) => entry.word)
}

export function pinyinHint(sequence: string): string {
  return lookup(sequence)[0]?.pinyin || sequence
}

export function recordPinyinChoice(sequence: string, word: string): void {
  try {
    const key = `w810-ime:${usageKey(sequence, word)}`
    localStorage.setItem(key, String(Number(localStorage.getItem(key) || 0) + 1))
    resultCache.delete(sequence)
  } catch {
    // 隐私模式或存储不可用时，输入法仍可正常工作。
  }
}
