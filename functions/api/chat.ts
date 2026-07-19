interface Env { DEEPSEEK_API_KEY: string }
interface HistoryMessage { role: 'user' | 'assistant'; content: string }
interface ChatPayload { message?: string; history?: HistoryMessage[] }
interface SiliconEnvelope { timestamp?: number; nonce?: string; data?: string }

const SILICON_SALT = 'SE-W810C:2006/2026:RETRO-SILICON'
const usedNonces = new Map<string, number>()

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36).padStart(7, '0')
}

function xorDecode(value: string, key: string): string {
  const binary = atob(value)
  const input = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const keyBytes = new TextEncoder().encode(key)
  const decoded = input.map((byte, index) => byte ^ keyBytes[index % keyBytes.length])
  return new TextDecoder().decode(decoded)
}

function decodeSiliconRequest(requestHeader: string | null, envelope: SiliconEnvelope, ip: string): ChatPayload | null {
  const { timestamp, nonce, data } = envelope
  if (!requestHeader?.startsWith('W810C/1 ')) return null
  if (!Number.isFinite(timestamp) || typeof nonce !== 'string' || typeof data !== 'string') return null
  if (!/^[a-z0-9]{16,24}$/.test(nonce)) return null
  if (Math.abs(Date.now() - Number(timestamp)) > 120_000) return null

  const expected = fnv1a(`${timestamp}.${nonce}.${data}.${SILICON_SALT}`)
  if (requestHeader !== `W810C/1 ${expected}`) return null

  const replayKey = `${ip}:${nonce}`
  const now = Date.now()
  for (const [key, expiresAt] of usedNonces) if (expiresAt < now) usedNonces.delete(key)
  if (usedNonces.has(replayKey)) return null
  usedNonces.set(replayKey, now + 120_000)

  try {
    const key = `${SILICON_SALT}:${timestamp}:${nonce}`
    return JSON.parse(xorDecode(data, key)) as ChatPayload
  } catch {
    return null
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const ip = context.request.headers.get('CF-Connecting-IP') || 'local'
  let envelope: SiliconEnvelope
  try {
    envelope = await context.request.json() as SiliconEnvelope
  } catch {
    return Response.json({ error: '无效的请求格式。' }, { status: 400 })
  }

  const body = decodeSiliconRequest(context.request.headers.get('X-Silicon'), envelope, ip)
  if (!body) {
    return Response.json({ error: 'X-Silicon 校验失败。' }, { status: 403 })
  }

  try {
    const message = body.message?.trim()
    if (!message || message.length > 500) {
      return Response.json({ error: '消息应为 1–500 个字符。' }, { status: 400 })
    }
    if (!context.env.DEEPSEEK_API_KEY) {
      return Response.json({ error: '尚未配置 DEEPSEEK_API_KEY。' }, { status: 503 })
    }

    const history = Array.isArray(body.history) ? body.history.slice(-8) : []
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          {
            role: 'system',
            content: `你是运行在 2006 年 Sony Ericsson W810c 风格直板手机中的 AI 助手。
这台设备保留经典功能机的外观和交互方式，但通过 2026 年的未来技术获得 AI 能力。当前系统日期为 2026 年。

回答要求：
- 使用自然中文，像一个可靠的手机助手。
- 考虑屏幕只有 176×220 像素，回复清楚、精炼。
- 单次回复控制在 90 个中文字符以内。
- 不使用 Markdown、表格或代码块。
- 避免长段落，仅在必要时换行。
- 不主动讨论自身技术实现，除非用户询问。
- 可以偶尔体现未来技术运行在经典手机上的反差感，但不要刻意。`,
          },
          ...history,
          { role: 'user', content: message },
        ],
        thinking: { type: 'disabled' },
        reasoning_effort: 'high',
        max_tokens: 200,
        stream: false,
      }),
    })
    if (!upstream.ok) throw new Error(`上游服务错误 ${upstream.status}`)
    const data = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> }
    const reply = data.choices?.[0]?.message?.content?.trim()
    if (!reply) throw new Error('上游没有返回内容')
    return Response.json({ reply })
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务暂时不可用'
    return Response.json({ error: message }, { status: 502 })
  }
}
