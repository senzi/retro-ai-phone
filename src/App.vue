<script setup lang="ts">
import Phone from './components/Phone.vue'
</script>

<template>
  <div class="site-shell">
    <main>
      <section class="intro">
        <div class="eyebrow"><i /> W810c · 2006 / 2026</div>
        <h1>把 AI，装进<br><em>176 × 220</em> 像素。</h1>
        <p>没有触屏，也没有语音。用九宫格，一字一句地和未来对话。</p>
        <div class="keyboard-note">
          <span>桌面键盘</span>
          <div><kbd>↑ ↓ ← →</kbd><b>导航</b></div>
          <div><kbd>Enter</kbd><b>确认</b></div>
          <div><kbd>0–9</kbd><b>输入</b></div>
          <div><kbd># / *</kbd><b>模式 / 符号</b></div>
          <div><kbd>Backspace</kbd><b>删除</b></div>
        </div>
        <small class="edition">WALKMAN AI EDITION · CONCEPT 01</small>
      </section>
      <section class="device-stage">
        <div class="stage-label"><span>INTERACTIVE</span><i /></div>
        <Phone />
        <p class="hint">点击实体按键开始体验</p>
      </section>
    </main>
    <footer class="site-footer">
      <a href="https://github.com/senzi/retro-ai-phone" target="_blank" rel="noopener noreferrer">GitHub</a>
      <i />
      <a href="https://github.com/senzi/retro-ai-phone/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT</a>
      <i />
      <span>Vibe coding</span>
    </footer>
  </div>
</template>
