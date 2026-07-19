<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { usePhoneStore } from '../store/phone'
import PhoneScreen from './PhoneScreen.vue'
import Keypad from './Keypad.vue'

const phone = usePhoneStore()
let bootTimer: ReturnType<typeof setTimeout>

function onKey(event: KeyboardEvent) {
  if ((event.target as HTMLElement)?.tagName === 'INPUT') return
  const directions: Record<string, 'up' | 'down' | 'left' | 'right' | 'center'> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'center',
  }
  if (directions[event.key]) { event.preventDefault(); phone.navigate(directions[event.key]); return }
  if (/^[0-9]$/.test(event.key)) phone.number(event.key)
  if (event.key === 'Backspace') { event.preventDefault(); phone.erase() }
  if (event.key === 'Escape') phone.back()
  if (event.key === '#') phone.specialKey('#')
  if (event.key === '*') phone.specialKey('*')
}

onMounted(() => {
  bootTimer = setTimeout(() => { phone.view = 'home' }, 1750)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => { clearTimeout(bootTimer); window.removeEventListener('keydown', onKey) })
</script>

<template>
  <div class="phone-wrap">
    <div class="phone-shadow" />
    <div class="phone">
      <div class="top-detail"><span class="speaker"/><span class="brand">SONY ERICSSON</span><span class="camera">●</span></div>
      <div class="screen-bezel"><PhoneScreen /></div>
      <Keypad />
      <div class="walkman-mark"><b>W.</b> WALKMAN</div>
    </div>
  </div>
</template>
