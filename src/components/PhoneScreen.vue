<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePhoneStore, SYMBOLS } from '../store/phone'
import { pinyinHint } from '../input/pinyin'

const phone = usePhoneStore()
const messagePanel = ref<HTMLElement>()
const currentTime = ref(new Date())
const clock = computed(() => currentTime.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }))
const homeDate = computed(() => currentTime.value.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', ' / '))
let clockTimer: ReturnType<typeof setInterval>
const renderedMessages = computed(() => {
  const all = [...phone.messages]
  if (phone.visibleReply) all.push({ role: 'assistant' as const, content: phone.visibleReply, createdAt: Date.now() })
  return all
})
const candidateWindow = computed(() => {
  const pageSize = 6
  const start = Math.floor(phone.candidateIndex / pageSize) * pageSize
  return phone.candidates.slice(start, start + pageSize).map((word, offset) => ({ word, index: start + offset }))
})
const candidatePage = computed(() => Math.floor(phone.candidateIndex / 6) + 1)
const candidatePages = computed(() => Math.max(1, Math.ceil(phone.candidates.length / 6)))
const historyWindow = computed(() => {
  const pageSize = 5
  const start = Math.floor(phone.historyIndex / pageSize) * pageSize
  return phone.sessions.slice(start, start + pageSize).map((session, offset) => ({ session, index: start + offset }))
})
const historyPage = computed(() => phone.sessions.length ? Math.floor(phone.historyIndex / 5) + 1 : 0)
const historyPages = computed(() => Math.ceil(phone.sessions.length / 5))
const menuItems = ['新建会话', '历史会话', '消息存储']

onMounted(() => {
  clockTimer = setInterval(() => { currentTime.value = new Date() }, 1000)
})
onBeforeUnmount(() => clearInterval(clockTimer))

function shortDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

watch(
  () => [phone.messages.length, phone.visibleReply, phone.loading, phone.view],
  async () => {
    await nextTick()
    if (phone.view === 'chat' && messagePanel.value) messagePanel.value.scrollTop = messagePanel.value.scrollHeight
  },
)

watch(() => phone.scrollOffset, (current, previous) => {
  if (!messagePanel.value || current === previous) return
  messagePanel.value.scrollBy({ top: current > previous ? 32 : -32, behavior: 'smooth' })
})
</script>

<template>
  <section class="lcd" aria-live="polite">
    <div class="scanlines" />

    <div v-if="phone.notice" class="phone-notice">{{ phone.notice }}</div>

    <template v-if="phone.view === 'boot'">
      <div class="boot-screen">
        <div class="se-orbit"><i /><b>SE</b></div>
        <strong>Sony Ericsson</strong>
        <span>WALKMAN</span>
      </div>
    </template>

    <template v-else-if="phone.view === 'home'">
      <div class="statusbar"><span>▮▮▮ AI</span><span>{{ clock }}</span><span>▰</span></div>
      <div class="wallpaper"><div class="wave w1"/><div class="wave w2"/><b>W.</b></div>
      <div class="home-time">{{ clock }}</div>
      <div class="home-date">{{ homeDate }}</div>
      <div class="softkeys"><span>呼叫</span><span>菜单</span></div>
    </template>

    <template v-else-if="phone.view === 'call'">
      <div class="titlebar"><span>电话</span><small>GSM</small></div>
      <div class="call-screen">
        <span class="call-icon">☎</span>
        <small>输入号码</small>
        <strong>{{ phone.dialedNumber || '—' }}</strong>
        <div v-if="phone.callStatus === 'failed'" class="call-error">
          <b>无法接通</b>
          <small>请检查号码后重试</small>
        </div>
        <p v-else>按 OK 呼叫</p>
      </div>
      <div class="softkeys three"><span>返回</span><span>C 删除</span><span>OK 呼叫</span></div>
    </template>

    <template v-else-if="phone.view === 'easterEgg'">
      <div class="titlebar"><span>设备信息</span><small>*#06#</small></div>
      <div class="egg-screen">
        <div class="egg-orbit"><i /><b>SE</b></div>
        <strong>SECRET SERVICE</strong>
        <p>彩蛋内容待定</p>
        <small>W810C · AI EDITION</small>
        <code>06 / 2006 / 2026</code>
      </div>
      <div class="softkeys"><span>返回</span><span>确定</span></div>
    </template>

    <template v-else-if="phone.view === 'menu'">
      <div class="titlebar"><span>主菜单</span><small>1/1</small></div>
      <div class="menu-grid">
        <div class="menu-item muted"><span>♫</span><small>音乐</small></div>
        <div class="menu-item selected"><span class="bot-icon">✉</span><small>AI 信息</small></div>
        <div class="menu-item muted"><span>⌁</span><small>工具</small></div>
      </div>
      <div class="menu-help">按中键进入</div>
      <div class="softkeys"><span>返回</span><span>选择</span></div>
    </template>

    <template v-else-if="phone.view === 'messagesMenu'">
      <div class="titlebar"><span>AI 信息</span><small>{{ phone.messageCount }}/100</small></div>
      <div class="list-screen">
        <div v-for="(item, index) in menuItems" :key="item" class="list-row" :class="{ active: index === phone.menuIndex }">
          <span class="list-icon">{{ ['＋', '▤', '▥'][index] }}</span><b>{{ item }}</b><i>›</i>
        </div>
      </div>
      <div class="softkeys"><span>返回</span><span>选择</span></div>
    </template>

    <template v-else-if="phone.view === 'history'">
      <div class="titlebar"><span>历史会话</span><small>{{ historyPage }}/{{ historyPages }}</small></div>
      <div class="history-list" v-if="historyWindow.length">
        <div v-for="item in historyWindow" :key="item.session.id" class="history-row" :class="{ active: item.index === phone.historyIndex }">
          <span>✉</span>
          <div><b>{{ item.session.title }}</b><small>{{ item.session.messages.length }} 条 · {{ shortDate(item.session.updatedAt) }}</small></div>
        </div>
      </div>
      <div v-else class="empty-state">没有历史会话</div>
      <div class="softkeys three"><span>返回</span><span>C 删除</span><span>打开</span></div>
    </template>

    <template v-else-if="phone.view === 'deleteConfirm'">
      <div class="titlebar"><span>删除会话</span><small>确认</small></div>
      <div class="confirm-screen">
        <span class="warning-icon">!</span>
        <b>删除这个会话？</b>
        <p>“{{ phone.sessions[phone.historyIndex]?.title }}”</p>
        <small>删除后无法恢复</small>
        <div class="confirm-actions">
          <span :class="{ active: phone.deleteChoice === 0 }">取消</span>
          <span :class="{ active: phone.deleteChoice === 1 }">删除</span>
        </div>
      </div>
      <div class="softkeys three"><span>返回</span><span>C 取消</span><span>OK 确认</span></div>
    </template>

    <template v-else-if="phone.view === 'storage'">
      <div class="titlebar"><span>消息存储</span><small>MEMORY</small></div>
      <div class="storage-screen">
        <span class="storage-chip">▦</span>
        <b>消息存储</b>
        <p>已使用</p>
        <strong>{{ phone.messageCount }}<small>/100 条</small></strong>
        <div class="storage-bar"><i :style="{ width: `${phone.storagePercent}%` }" /></div>
        <small>按 AI 与我的消息总数统计</small>
      </div>
      <div class="softkeys"><span>返回</span><span>{{ phone.storagePercent }}%</span></div>
    </template>

    <template v-else-if="phone.view === 'symbols'">
      <div class="titlebar"><span>插入符号</span><small>{{ phone.symbolIndex + 1 }}/{{ SYMBOLS.length }}</small></div>
      <div class="symbol-grid">
        <b v-for="(symbol, index) in SYMBOLS" :key="`${symbol}-${index}`" :class="{ active: index === phone.symbolIndex }">{{ symbol }}</b>
      </div>
      <div class="symbol-help">方向键移动 · OK 插入</div>
      <div class="softkeys"><span>C 返回</span><span>OK 确认</span></div>
    </template>

    <template v-else>
      <div class="titlebar chat-title"><span><i class="online-dot"/> {{ phone.activeSession?.title || 'AI Chat' }}</span><small>{{ phone.mode }}</small></div>
      <div ref="messagePanel" class="messages">
        <div v-if="!renderedMessages.length" class="empty-chat"><b>新会话</b><span>输入消息，开始和 AI 对话</span></div>
        <article v-for="(message, index) in renderedMessages" :key="`${message.createdAt}-${index}`" :class="message.role">
          <b>{{ message.role === 'assistant' ? 'AI' : '我' }}</b>
          <p>{{ message.content }}</p>
        </article>
        <div v-if="phone.loading && !phone.visibleReply" class="sending">发送中<span>...</span></div>
      </div>
      <div v-if="phone.sequence" class="candidates">
        <span>{{ pinyinHint(phone.sequence) }} <small>↑↓ {{ candidatePage }}/{{ candidatePages }}</small></span>
        <div>
          <b v-for="item in candidateWindow" :key="item.word" :class="{ active: item.index === phone.candidateIndex }">{{ item.word }}</b>
        </div>
      </div>
      <div class="composer"><span>{{ phone.draft || '输入消息…' }}</span><i v-if="!phone.loading" /></div>
      <div class="softkeys"><span># 模式 · * 符号</span><span>OK 发送</span></div>
    </template>
  </section>
</template>
