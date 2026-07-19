import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { MULTITAP } from '../input/multitap'
import { pinyinCandidates, recordPinyinChoice } from '../input/pinyin'
import { createSiliconRequest } from '../utils/silicon'

export type InputMode = '拼音' | 'abc' | '123'
export type ViewName = 'boot' | 'home' | 'call' | 'easterEgg' | 'menu' | 'messagesMenu' | 'history' | 'deleteConfirm' | 'storage' | 'chat' | 'symbols'
export interface Message { role: 'user' | 'assistant'; content: string; createdAt: number }
export interface Conversation { id: string; title: string; createdAt: number; updatedAt: number; messages: Message[] }

const modes: InputMode[] = ['拼音', 'abc', '123']
const STORAGE_KEY = 'w810c-ai-conversations-v1'
const MESSAGE_CAPACITY = 100
export const SYMBOLS = ['.', ',', '?', '!', ':', ';', "'", '"', '(', ')', '[', ']', '@', '#', '$', '%', '+', '-', '×', '÷', '。', '，', '？', '！']

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function makeConversation(): Conversation {
  const now = Date.now()
  return {
    id: makeId(),
    title: '新会话',
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
}

function loadConversations(): Conversation[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Conversation[]
    if (Array.isArray(parsed)) return parsed.filter((session) => session.messages.some((message) => message.role === 'user'))
  } catch {
    // 损坏的旧缓存不阻止手机启动。
  }
  return []
}

export const usePhoneStore = defineStore('phone', () => {
  const initialSessions = loadConversations()
  const view = ref<ViewName>('boot')
  const mode = ref<InputMode>('拼音')
  const draft = ref('')
  const sequence = ref('')
  const sessions = ref<Conversation[]>(initialSessions)
  const activeSessionId = ref(initialSessions[0]?.id || '')
  const loading = ref(false)
  const visibleReply = ref('')
  const scrollOffset = ref(0)
  const activeKey = ref('')
  const lastKey = ref('')
  const tapIndex = ref(0)
  const candidateIndex = ref(0)
  const menuIndex = ref(0)
  const historyIndex = ref(0)
  const symbolIndex = ref(0)
  const deleteChoice = ref<0 | 1>(0)
  const notice = ref('')
  const dialedNumber = ref('')
  const callStatus = ref<'idle' | 'failed'>('idle')
  let tapTimer: ReturnType<typeof setTimeout> | undefined
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  const activeSession = computed(() => sessions.value.find((item) => item.id === activeSessionId.value))
  const messages = computed(() => activeSession.value?.messages || [])
  const messageCount = computed(() => sessions.value.reduce((total, item) => total + item.messages.length, 0))
  const storagePercent = computed(() => Math.min(100, Math.round(messageCount.value / MESSAGE_CAPACITY * 100)))
  const candidates = computed(() => pinyinCandidates(sequence.value))

  watch(sessions, (value) => {
    const sentSessions = value.filter((session) => session.messages.some((message) => message.role === 'user'))
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sentSessions)) } catch { /* 容量不足时保留当前内存会话 */ }
  }, { deep: true })

  function showNotice(text: string) {
    notice.value = text
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { notice.value = '' }, 1800)
  }

  function pulse(key: string) {
    activeKey.value = key
    window.setTimeout(() => { if (activeKey.value === key) activeKey.value = '' }, 110)
  }

  function cycleMode() {
    if (view.value !== 'chat') return
    commitMultitap()
    sequence.value = ''
    candidateIndex.value = 0
    mode.value = modes[(modes.indexOf(mode.value) + 1) % modes.length]
  }

  function openSymbols() {
    if (view.value !== 'chat') return
    pulse('*')
    sequence.value = ''
    candidateIndex.value = 0
    symbolIndex.value = 0
    view.value = 'symbols'
  }

  function commitMultitap() {
    lastKey.value = ''
    tapIndex.value = 0
    if (tapTimer) clearTimeout(tapTimer)
  }

  function chooseCandidate(index = candidateIndex.value) {
    const choice = candidates.value[index]
    if (!choice) return
    draft.value += choice
    recordPinyinChoice(sequence.value, choice)
    sequence.value = ''
    candidateIndex.value = 0
  }

  function number(key: string) {
    pulse(key)
    if (view.value === 'home' || view.value === 'call') {
      appendDialCharacter(key)
      return
    }
    if (view.value !== 'chat') return
    if (mode.value === '拼音') {
      if (/[2-9]/.test(key)) {
        sequence.value += key
        candidateIndex.value = 0
      } else if (key === '0') {
        if (sequence.value) {
          chooseCandidate()
          if (sequence.value) return
        }
        draft.value += ' '
      }
      return
    }
    if (mode.value === '123') { draft.value += key; return }
    const chars = MULTITAP[key]
    if (!chars) return
    if (lastKey.value === key && draft.value) {
      tapIndex.value = (tapIndex.value + 1) % chars.length
      draft.value = draft.value.slice(0, -1) + chars[tapIndex.value]
    } else {
      commitMultitap()
      lastKey.value = key
      draft.value += chars[0]
    }
    tapTimer = setTimeout(commitMultitap, 650)
  }

  function specialKey(key: '*' | '#') {
    pulse(key)
    if (view.value === 'home' || view.value === 'call') {
      appendDialCharacter(key)
      return
    }
    if (view.value === 'chat') {
      if (key === '*') openSymbols()
      else cycleMode()
    }
  }

  function appendDialCharacter(character: string) {
    if (view.value === 'home') {
      dialedNumber.value = ''
      view.value = 'call'
    }
    if (dialedNumber.value.length >= 24) return
    callStatus.value = 'idle'
    dialedNumber.value += character
    if (dialedNumber.value === '*#06#') view.value = 'easterEgg'
  }

  function erase() {
    pulse('c')
    if (view.value === 'symbols') { view.value = 'chat'; return }
    if (view.value === 'easterEgg') { view.value = 'call'; return }
    if (view.value === 'call') {
      dialedNumber.value = dialedNumber.value.slice(0, -1)
      callStatus.value = 'idle'
      if (!dialedNumber.value) view.value = 'home'
      return
    }
    if (view.value === 'history') { requestDeleteConversation(); return }
    if (view.value === 'deleteConfirm') { view.value = 'history'; return }
    if (view.value !== 'chat') { back(); return }
    if (sequence.value) {
      sequence.value = sequence.value.slice(0, -1)
      candidateIndex.value = 0
    } else draft.value = draft.value.slice(0, -1)
  }

  function newConversation() {
    if (messageCount.value >= MESSAGE_CAPACITY) {
      showNotice('消息存储已满')
      view.value = 'storage'
      return
    }
    sessions.value = sessions.value.filter((session) => session.messages.some((message) => message.role === 'user'))
    const conversation = makeConversation()
    sessions.value.unshift(conversation)
    activeSessionId.value = conversation.id
    draft.value = ''
    sequence.value = ''
    view.value = 'chat'
  }

  function openConversation(index = historyIndex.value) {
    const conversation = sessions.value[index]
    if (!conversation) return
    activeSessionId.value = conversation.id
    draft.value = ''
    sequence.value = ''
    view.value = 'chat'
    scrollOffset.value = 999
  }

  function requestDeleteConversation() {
    if (!sessions.value[historyIndex.value]) return
    deleteChoice.value = 0
    view.value = 'deleteConfirm'
  }

  function deleteSelectedConversation() {
    const conversation = sessions.value[historyIndex.value]
    if (!conversation) return
    sessions.value.splice(historyIndex.value, 1)
    historyIndex.value = Math.max(0, Math.min(historyIndex.value, sessions.value.length - 1))
    if (activeSessionId.value === conversation.id) activeSessionId.value = sessions.value[0]?.id || ''
    showNotice('会话已删除')
  }

  function selectMessagesMenu() {
    if (menuIndex.value === 0) newConversation()
    if (menuIndex.value === 1) { historyIndex.value = 0; view.value = 'history' }
    if (menuIndex.value === 2) view.value = 'storage'
  }

  function navigate(direction: 'up' | 'down' | 'left' | 'right' | 'center') {
    pulse(direction)
    if (view.value === 'home' && direction === 'center') { view.value = 'menu'; return }
    if (view.value === 'call') {
      if (direction === 'center') {
        if (dialedNumber.value === '*#06#') view.value = 'easterEgg'
        else if (dialedNumber.value) callStatus.value = 'failed'
      }
      return
    }
    if (view.value === 'easterEgg') {
      if (direction === 'center') view.value = 'home'
      return
    }
    if (view.value === 'menu' && direction === 'center') { menuIndex.value = 0; view.value = 'messagesMenu'; return }
    if (view.value === 'messagesMenu') {
      if (direction === 'up') menuIndex.value = (menuIndex.value + 2) % 3
      if (direction === 'down') menuIndex.value = (menuIndex.value + 1) % 3
      if (direction === 'center') selectMessagesMenu()
      return
    }
    if (view.value === 'history') {
      if (direction === 'up' && sessions.value.length) historyIndex.value = (historyIndex.value - 1 + sessions.value.length) % sessions.value.length
      if (direction === 'down' && sessions.value.length) historyIndex.value = (historyIndex.value + 1) % sessions.value.length
      if (direction === 'center') openConversation()
      return
    }
    if (view.value === 'deleteConfirm') {
      if (direction === 'left' || direction === 'right' || direction === 'up' || direction === 'down') {
        deleteChoice.value = deleteChoice.value === 0 ? 1 : 0
      }
      if (direction === 'center') {
        if (deleteChoice.value === 1) deleteSelectedConversation()
        view.value = 'history'
      }
      return
    }
    if (view.value === 'symbols') {
      const columns = 4
      if (direction === 'left') symbolIndex.value = (symbolIndex.value - 1 + SYMBOLS.length) % SYMBOLS.length
      if (direction === 'right') symbolIndex.value = (symbolIndex.value + 1) % SYMBOLS.length
      if (direction === 'up') symbolIndex.value = (symbolIndex.value - columns + SYMBOLS.length) % SYMBOLS.length
      if (direction === 'down') symbolIndex.value = (symbolIndex.value + columns) % SYMBOLS.length
      if (direction === 'center') {
        draft.value += SYMBOLS[symbolIndex.value]
        view.value = 'chat'
      }
      return
    }
    if (view.value !== 'chat') return
    if (sequence.value && candidates.value.length) {
      const pageSize = 6
      if (direction === 'left') candidateIndex.value = (candidateIndex.value - 1 + candidates.value.length) % candidates.value.length
      if (direction === 'right') candidateIndex.value = (candidateIndex.value + 1) % candidates.value.length
      if (direction === 'up') candidateIndex.value = Math.max(0, candidateIndex.value - pageSize)
      if (direction === 'down') candidateIndex.value = Math.min(candidates.value.length - 1, candidateIndex.value + pageSize)
      if (direction === 'center') chooseCandidate()
      return
    }
    if (direction === 'up') scrollOffset.value = Math.max(0, scrollOffset.value - 1)
    if (direction === 'down') scrollOffset.value += 1
  }

  function back() {
    pulse('back')
    if (view.value === 'home') {
      dialedNumber.value = ''
      callStatus.value = 'idle'
      view.value = 'call'
    }
    else if (view.value === 'symbols') view.value = 'chat'
    else if (view.value === 'call' || view.value === 'easterEgg') view.value = 'home'
    else if (view.value === 'deleteConfirm') view.value = 'history'
    else if (view.value === 'chat') {
      const conversation = activeSession.value
      if (conversation && !conversation.messages.some((message) => message.role === 'user')) {
        sessions.value = sessions.value.filter((session) => session.id !== conversation.id)
        activeSessionId.value = sessions.value[0]?.id || ''
      }
      view.value = 'messagesMenu'
    }
    else if (view.value === 'history' || view.value === 'storage') view.value = 'messagesMenu'
    else if (view.value === 'messagesMenu') view.value = 'menu'
    else if (view.value === 'menu') view.value = 'home'
  }

  async function primaryAction() {
    if (view.value === 'chat') await send()
    else navigate('center')
  }

  async function send() {
    pulse('send')
    if (view.value !== 'chat' || loading.value) return
    if (sequence.value) chooseCandidate()
    if (sequence.value) return
    const text = draft.value.trim()
    const conversation = activeSession.value
    if (!text || !conversation) return
    if (messageCount.value > MESSAGE_CAPACITY - 2) {
      showNotice('空间不足，请删除旧会话')
      return
    }

    const userMessage: Message = { role: 'user', content: text, createdAt: Date.now() }
    conversation.messages.push(userMessage)
    if (conversation.title === '新会话') conversation.title = text.slice(0, 12)
    conversation.updatedAt = Date.now()
    draft.value = ''
    loading.value = true
    scrollOffset.value = 999
    try {
      const payload = {
        message: text,
        history: conversation.messages.slice(-9, -1).map(({ role, content }) => ({ role, content })),
      }
      const silicon = createSiliconRequest(payload)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Silicon': silicon.header },
        body: silicon.body,
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok) throw new Error(data.error || '请求失败')
      await typeReply(data.reply || '我刚才走神了，请再说一次。')
    } catch (error) {
      const detail = error instanceof Error ? error.message : '未知错误'
      await typeReply(`信号不太好：${detail}`)
    } finally {
      loading.value = false
      visibleReply.value = ''
    }
  }

  async function typeReply(text: string) {
    visibleReply.value = ''
    for (const char of text) {
      visibleReply.value += char
      await new Promise((resolve) => setTimeout(resolve, 38))
    }
    const conversation = activeSession.value
    if (conversation && messageCount.value < MESSAGE_CAPACITY) {
      conversation.messages.push({ role: 'assistant', content: text, createdAt: Date.now() })
      conversation.updatedAt = Date.now()
    }
  }

  return {
    view, mode, draft, sequence, sessions, messages, activeSession, loading, visibleReply, scrollOffset,
    activeKey, candidates, candidateIndex, menuIndex, historyIndex, symbolIndex, deleteChoice, notice,
    dialedNumber, callStatus,
    messageCount, storagePercent, number, erase, navigate, back, primaryAction, cycleMode, openSymbols,
    specialKey,
  }
})
