<template>
  <button
    class="silicone-btn"
    :class="[`btn-${props.type}`, `btn-${props.size}`, { 'btn-active': isActive, 'btn-disabled': disabled, 'btn-breathing': breathing, 'is-loading': loading }]"
    :disabled="disabled || loading"
    @mousedown="isActive = true"
    @mouseup="isActive = false"
    @mouseleave="isActive = false"
    @click="$emit('click', $event)"
  >
    <span class="btn-glow"></span>
    <span class="btn-content">
      <slot />
    </span>
    <span class="btn-loading-indicator" v-if="loading">
      <span class="loading-dot"></span>
      <span class="loading-dot"></span>
      <span class="loading-dot"></span>
    </span>
    <span class="btn-status" v-if="props.status && !loading">
      <span class="status-dot" :class="`status-${props.status}`"></span>
    </span>
  </button>
</template>

<script setup>
import { ref } from 'vue';

defineEmits(["click"]);
const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: "default"
  },
  size: {
    type: String,
    default: "medium"
  },
  status: {
    type: String,
    default: ""
  },
  disabled: {
    type: Boolean,
    default: false
  },
  breathing: {
    type: Boolean,
    default: false
  }
});

const isActive = ref(false);
</script>

<style>
.silicone-btn {
  cursor: pointer;
  padding: 10px;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  border: none;
  outline: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 14px;
  font-weight: 600;
}

.silicone-btn:hover {
  background: var(--sidebar-item-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.silicone-btn.btn-active {
  transform: translateY(2px);
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.15);
}

.silicone-btn.btn-breathing {
  animation: breathing 3s ease-in-out infinite;
}

@keyframes breathing {
  0%, 100% {
    background: transparent;
    box-shadow: none;
  }
  50% {
    background: rgba(64, 158, 255, 0.06);
    box-shadow: none;
  }
}

@keyframes breathing-primary {
  0%, 100% {
    background: transparent;
    box-shadow: none;
  }
  50% {
    background: rgba(64, 158, 255, 0.1);
    box-shadow: none;
  }
}

.silicone-btn.btn-breathing.btn-primary {
  animation: breathing-primary 3s ease-in-out infinite;
}

@keyframes breathing-loading {
  0%, 100% {
    background: transparent;
    box-shadow: none;
  }
  50% {
    background: rgba(64, 158, 255, 0.08);
    box-shadow: none;
  }
}

.silicone-btn.is-loading.btn-breathing {
  animation: breathing-loading 1.5s ease-in-out infinite;
}

.btn-loading-indicator {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: 6px;
}

.loading-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.6;
}

.loading-dot:nth-child(1) {
  animation: loading-breathe 1.2s ease-in-out infinite;
  animation-delay: 0s;
}

.loading-dot:nth-child(2) {
  animation: loading-breathe 1.2s ease-in-out infinite;
  animation-delay: 0.2s;
}

.loading-dot:nth-child(3) {
  animation: loading-breathe 1.2s ease-in-out infinite;
  animation-delay: 0.4s;
}

@keyframes loading-breathe {
  0%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.silicone-btn.btn-disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: linear-gradient(180deg, #e8e8e8 0%, #d8d8d8 50%, #d0d0d0 100%);
}

.silicone-btn.btn-disabled:hover {
  transform: none;
  box-shadow: 
    inset 0 3px 6px rgba(255, 255, 255, 0.8),
    inset 0 -3px 6px rgba(0, 0, 0, 0.08),
    0 6px 18px rgba(0, 0, 0, 0.12),
    0 2px 4px rgba(0, 0, 0, 0.08);
}

.btn-content {
  position: relative;
  z-index: 1;
  transition: text-shadow 0.15s ease;
}

.btn-status {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-left: 4px;
  position: relative;
  z-index: 1;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #999;
  box-shadow: 
    inset 0 1px 2px rgba(0, 0, 0, 0.3),
    0 1px 2px rgba(255, 255, 255, 0.5);
}

.status-online {
  background: #67c23a;
  animation: pulse-green 2s ease-in-out infinite;
}

@keyframes pulse-green {
  0%, 100% {
    box-shadow: 
      inset 0 1px 2px rgba(0, 0, 0, 0.3),
      0 0 0 0 rgba(103, 194, 58, 0.4);
  }
  50% {
    box-shadow: 
      inset 0 1px 2px rgba(0, 0, 0, 0.3),
      0 0 0 6px rgba(103, 194, 58, 0);
  }
}

.status-offline {
  background: #999;
}

.status-warning {
  background: #e6a23c;
  animation: pulse-warning 1s ease-in-out infinite;
}

@keyframes pulse-warning {
  0%, 100% {
    box-shadow: 
      inset 0 1px 2px rgba(0, 0, 0, 0.3),
      0 0 0 0 rgba(230, 162, 60, 0.4);
  }
  50% {
    box-shadow: 
      inset 0 1px 2px rgba(0, 0, 0, 0.3),
      0 0 0 5px rgba(230, 162, 60, 0);
  }
}

.status-error {
  background: #f56c6c;
  animation: pulse-error 0.8s ease-in-out infinite;
}

@keyframes pulse-error {
  0%, 100% {
    box-shadow: 
      inset 0 1px 2px rgba(0, 0, 0, 0.3),
      0 0 0 0 rgba(245, 108, 108, 0.4);
  }
  50% {
    box-shadow: 
      inset 0 1px 2px rgba(0, 0, 0, 0.3),
      0 0 0 5px rgba(245, 108, 108, 0);
  }
}

.btn-primary {
  background: transparent;
  box-shadow: none;
  color: var(--el-text-color-regular);
  text-shadow: none;
}

.btn-primary:hover {
  background: linear-gradient(180deg, #93c5fd 0%, #60a5fa 50%, #3b82f6 100%);
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.5),
    inset 0 -2px 4px rgba(0, 0, 0, 0.06),
    0 6px 16px rgba(59, 130, 246, 0.3),
    0 3px 4px rgba(0, 0, 0, 0.1);
  color: #1e40af;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.btn-primary.btn-active {
  transform: translateY(2px);
  background: linear-gradient(180deg, #4f94ef 0%, #3b82f6 50%, #2563eb 100%);
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.12),
    0 1px 2px rgba(0, 0, 0, 0.15);
  color: #1e40af;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.btn-primary.btn-active .btn-content {
  text-shadow:
    0 1px 0 rgba(0, 0, 0, 0.1),
    0 -1px 0 rgba(255, 255, 255, 0.2);
}

.btn-success {
  background: transparent;
  box-shadow: none;
  color: var(--el-text-color-regular);
  text-shadow: none;
}

.btn-success:hover {
  background: linear-gradient(180deg, #bbf7d0 0%, #86efac 50%, #4ade80 100%);
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.5),
    inset 0 -2px 4px rgba(0, 0, 0, 0.06),
    0 6px 16px rgba(74, 222, 128, 0.3),
    0 3px 4px rgba(0, 0, 0, 0.1);
  color: #166534;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.btn-success.btn-active {
  transform: translateY(2px);
  background: linear-gradient(180deg, #6ee7b7 0%, #4ade80 50%, #22c55e 100%);
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.12),
    0 1px 2px rgba(0, 0, 0, 0.15);
  color: #166534;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.btn-success.btn-active .btn-content {
  text-shadow:
    0 1px 0 rgba(0, 0, 0, 0.1),
    0 -1px 0 rgba(255, 255, 255, 0.2);
}

.btn-warning {
  background: transparent;
  box-shadow: none;
  color: var(--el-text-color-regular);
  text-shadow: none;
}

.btn-warning:hover {
  background: linear-gradient(180deg, #fde68a 0%, #fcd34d 50%, #fbbf24 100%);
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.5),
    inset 0 -2px 4px rgba(0, 0, 0, 0.06),
    0 6px 16px rgba(251, 191, 36, 0.3),
    0 3px 4px rgba(0, 0, 0, 0.1);
  color: #92400e;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.btn-warning.btn-active {
  transform: translateY(2px);
  background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.12),
    0 1px 2px rgba(0, 0, 0, 0.15);
  color: #92400e;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.btn-warning.btn-active .btn-content {
  text-shadow:
    0 1px 0 rgba(0, 0, 0, 0.1),
    0 -1px 0 rgba(255, 255, 255, 0.2);
}

.btn-danger {
  background: transparent;
  box-shadow: none;
  color: var(--el-text-color-regular);
  text-shadow: none;
}

.btn-danger:hover {
  background: linear-gradient(180deg, #fecaca 0%, #fca5a5 50%, #f87171 100%);
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.5),
    inset 0 -2px 4px rgba(0, 0, 0, 0.06),
    0 6px 16px rgba(248, 113, 113, 0.3),
    0 3px 4px rgba(0, 0, 0, 0.1);
  color: #991b1b;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.btn-danger.btn-active {
  transform: translateY(2px);
  background: linear-gradient(180deg, #f87171 0%, #ef4444 50%, #dc2626 100%);
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.25),
    inset 0 -2px 4px rgba(0, 0, 0, 0.15),
    0 1px 2px rgba(0, 0, 0, 0.2);
  color: #991b1b;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.btn-danger.btn-active .btn-content {
  text-shadow: 
    0 1px 0 rgba(0, 0, 0, 0.2),
    0 -1px 0 rgba(255, 255, 255, 0.2);
}

.btn-text {
  background: transparent !important;
  box-shadow: none !important;
  color: #409eff;
  text-shadow: none;
}

.btn-text .btn-glow {
  display: none;
}

.btn-text:hover {
  background: transparent !important;
  box-shadow: none !important;
  transform: none;
}

.btn-text.btn-active {
  transform: none !important;
  background: transparent !important;
  box-shadow: none !important;
}

.btn-text.btn-active .btn-content {
  text-shadow: none !important;
}

.silicone-btn.btn-breathing.btn-text {
  animation: breathing-text 2s ease-in-out infinite;
}

@keyframes breathing-text {
  0%, 100% {
    background: transparent !important;
    box-shadow: none !important;
  }
  50% {
    background: rgba(64, 158, 255, 0.06) !important;
    box-shadow: none !important;
  }
}

.dark .silicone-btn.btn-breathing.btn-text {
  animation: breathing-text-dark 2s ease-in-out infinite;
}

@keyframes breathing-text-dark {
  0%, 100% {
    background: transparent !important;
    box-shadow: none !important;
  }
  50% {
    background: rgba(102, 177, 255, 0.1) !important;
    box-shadow: none !important;
  }
}

.btn-small {
  padding: 5px 22px;
  font-size: 13px;
  border-radius: 16px;
}

.btn-small .btn-status {
  gap: 2px;
}

.btn-small .status-dot {
  width: 5px;
  height: 5px;
}

.btn-medium {
  padding: 14px 36px;
}

.btn-large {
  padding: 18px 44px;
  font-size: 16px;
  border-radius: 24px;
}

.btn-large .status-dot {
  width: 7px;
  height: 7px;
}

.dark .silicone-btn {
  color: var(--el-text-color-regular);
}

.dark .silicone-btn:hover {
  background: var(--dark-sidebar-item-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dark .silicone-btn.btn-active {
  background: var(--dark-sidebar-item-hover);
  transform: translateY(2px);
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 -2px 4px rgba(0, 0, 0, 0.15),
    0 1px 2px rgba(0, 0, 0, 0.2);
}

.dark .btn-primary {
  background: transparent;
  box-shadow: none;
  color: var(--el-text-color-regular);
  text-shadow: none;
}

.dark .btn-primary:hover {
  background: linear-gradient(180deg, #93c5fd 0%, #60a5fa 50%, #3b82f6 100%);
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.4),
    inset 0 -2px 4px rgba(0, 0, 0, 0.1),
    0 6px 16px rgba(59, 130, 246, 0.5),
    0 3px 4px rgba(0, 0, 0, 0.2);
  color: #1e40af;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.dark .btn-primary.btn-active {
  background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%);
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.15),
    inset 0 -1px 3px rgba(0, 0, 0, 0.1);
  color: #1e40af;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.dark .btn-success {
  background: transparent;
  box-shadow: none;
  color: var(--el-text-color-regular);
  text-shadow: none;
}

.dark .btn-success:hover {
  background: linear-gradient(180deg, #bbf7d0 0%, #86efac 50%, #4ade80 100%);
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.4),
    inset 0 -2px 4px rgba(0, 0, 0, 0.1),
    0 6px 16px rgba(74, 222, 128, 0.5),
    0 3px 4px rgba(0, 0, 0, 0.2);
  color: #166534;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.dark .btn-success.btn-active {
  background: linear-gradient(180deg, #86efac 0%, #4ade80 50%, #22c55e 100%);
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.15),
    inset 0 -1px 3px rgba(0, 0, 0, 0.1);
  color: #166534;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.dark .btn-warning {
  background: transparent;
  box-shadow: none;
  color: var(--el-text-color-regular);
  text-shadow: none;
}

.dark .btn-warning:hover {
  background: linear-gradient(180deg, #fde68a 0%, #fcd34d 50%, #fbbf24 100%);
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.4),
    inset 0 -2px 4px rgba(0, 0, 0, 0.1),
    0 6px 16px rgba(251, 191, 36, 0.5),
    0 3px 4px rgba(0, 0, 0, 0.2);
  color: #92400e;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.dark .btn-warning.btn-active {
  background: linear-gradient(180deg, #fcd34d 0%, #fbbf24 50%, #f59e0b 100%);
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.15),
    inset 0 -1px 3px rgba(0, 0, 0, 0.1);
  color: #92400e;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.dark .btn-danger {
  background: transparent;
  box-shadow: none;
  color: var(--el-text-color-regular);
  text-shadow: none;
}

.dark .btn-danger:hover {
  background: linear-gradient(180deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%);
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.15),
    inset 0 -2px 4px rgba(0, 0, 0, 0.2),
    0 6px 16px rgba(239, 68, 68, 0.4),
    0 3px 4px rgba(0, 0, 0, 0.2);
  color: #fee2e2;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
}

.dark .btn-danger.btn-active {
  background: linear-gradient(180deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%);
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.25),
    inset 0 -1px 3px rgba(0, 0, 0, 0.2);
  color: #fee2e2;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
}

.dark .btn-text {
  color: #66b1ff;
}

.dark .btn-text:hover {
  background: rgba(64, 158, 255, 0.15) !important;
}

.dark .btn-text.btn-active {
  background: rgba(64, 158, 255, 0.2) !important;
}
</style>