<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { usePhoneStore } from '../store/phone'

const phone = usePhoneStore()
const modeHoldTimer = ref<ReturnType<typeof setTimeout>>()
const symbolHoldTimer = ref<ReturnType<typeof setTimeout>>()
const modeHoldTriggered = ref(false)
const symbolHoldTriggered = ref(false)

function startModeHold() {
  modeHoldTriggered.value = false
  modeHoldTimer.value = setTimeout(() => {
    modeHoldTriggered.value = true
    phone.cycleMode()
  }, 560)
}

function endModeHold() {
  if (modeHoldTimer.value) clearTimeout(modeHoldTimer.value)
  if (!modeHoldTriggered.value) phone.specialKey('#')
}

function startSymbolHold() {
  symbolHoldTriggered.value = false
  symbolHoldTimer.value = setTimeout(() => {
    symbolHoldTriggered.value = true
    phone.openSymbols()
  }, 560)
}

function endSymbolHold() {
  if (symbolHoldTimer.value) clearTimeout(symbolHoldTimer.value)
  if (!symbolHoldTriggered.value) phone.specialKey('*')
}

function cancelModeHold() { if (modeHoldTimer.value) clearTimeout(modeHoldTimer.value) }
function cancelSymbolHold() { if (symbolHoldTimer.value) clearTimeout(symbolHoldTimer.value) }

onBeforeUnmount(() => {
  cancelModeHold()
  cancelSymbolHold()
})

const keys = [
  ['1', '.,?!'], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', '长按符号'], ['0', '+ _'], ['#', '长按模式'],
]
</script>

<template>
  <div class="controls">
    <div class="soft-row">
      <button :class="{ pressed: phone.activeKey === 'back' }" aria-label="返回" @click="phone.back">↩</button>
      <div class="dpad">
        <button class="up" :class="{ pressed: phone.activeKey === 'up' }" aria-label="向上" @click="phone.navigate('up')">▲</button>
        <button class="left" :class="{ pressed: phone.activeKey === 'left' }" aria-label="向左" @click="phone.navigate('left')">◀</button>
        <button class="center" :class="{ pressed: phone.activeKey === 'center' }" aria-label="确认" @click="phone.navigate('center')"><i /></button>
        <button class="right" :class="{ pressed: phone.activeKey === 'right' }" aria-label="向右" @click="phone.navigate('right')">▶</button>
        <button class="down" :class="{ pressed: phone.activeKey === 'down' }" aria-label="向下" @click="phone.navigate('down')">▼</button>
      </div>
      <button :class="{ pressed: phone.activeKey === 'send' }" aria-label="确认或发送" @click="phone.primaryAction">OK</button>
    </div>
    <div class="utility-row">
      <button class="walkman" aria-label="Walkman">W.</button>
      <button class="clear" :class="{ pressed: phone.activeKey === 'c' }" aria-label="删除或返回" @click="phone.erase">C</button>
    </div>
    <div class="number-grid">
      <button v-for="key in keys" :key="key[0]" :class="{ pressed: phone.activeKey === key[0] }"
        @click="!['*', '#'].includes(key[0]) && phone.number(key[0])"
        @pointerdown="key[0] === '*' ? startSymbolHold() : key[0] === '#' ? startModeHold() : undefined"
        @pointerup="key[0] === '*' ? endSymbolHold() : key[0] === '#' ? endModeHold() : undefined"
        @pointercancel="key[0] === '*' ? cancelSymbolHold() : key[0] === '#' ? cancelModeHold() : undefined"
        @pointerleave="key[0] === '*' ? cancelSymbolHold() : key[0] === '#' ? cancelModeHold() : undefined">
        <b>{{ key[0] }}</b><small>{{ key[1] }}</small>
      </button>
    </div>
  </div>
</template>
