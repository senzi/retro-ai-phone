const SILICON_SALT = 'SE-W810C:2006/2026:RETRO-SILICON'

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36).padStart(7, '0')
}

function xorEncode(value: string, key: string): string {
  const input = new TextEncoder().encode(value)
  const keyBytes = new TextEncoder().encode(key)
  const encoded = input.map((byte, index) => byte ^ keyBytes[index % keyBytes.length])
  return btoa(String.fromCharCode(...encoded))
}

export function createSiliconRequest(payload: unknown): { body: string; header: string } {
  const timestamp = Date.now()
  const nonce = crypto.randomUUID().replaceAll('-', '').slice(0, 20)
  const key = `${SILICON_SALT}:${timestamp}:${nonce}`
  const data = xorEncode(JSON.stringify(payload), key)
  const proof = fnv1a(`${timestamp}.${nonce}.${data}.${SILICON_SALT}`)
  return {
    body: JSON.stringify({ timestamp, nonce, data }),
    header: `W810C/1 ${proof}`,
  }
}
