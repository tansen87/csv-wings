<template>
  <el-button
    class="silicone-btn"
    v-bind="$attrs"
    :loading="loading"
    @click="$emit('click', $event)"
  >
    <slot />
  </el-button>
</template>

<script setup>
defineEmits(["click"]);
defineProps({
  loading: {
    type: Boolean,
    default: false
  }
});
</script>

<style>
/* 按钮基础样式 */
.silicone-btn {
  padding: 8px 36px 8px 16px; /* 右侧留足空间给状态点 */
  border-radius: 12px;
  font-size: 14px;
  color: #333;
  background-color: #f0f0f0;
  border: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  overflow: visible; /* 必须 visible,否则伪元素可能被裁剪 */
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
}

/* 隐藏默认loading图标 */
.silicone-btn.is-loading .el-icon.is-loading {
  display: none !important;
}

/* circle状态下隐藏小圆点 */
.silicone-btn.is-circle::after {
  display: none;
}

/* 状态小圆点 - 伪元素 */
.silicone-btn::after {
  content: "";
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.1);
  opacity: 0.6;
  pointer-events: none;
}

/* 呼吸动画：用于 loading 状态 */
@keyframes breathe {
  0%,
  100% {
    opacity: 0.6;
    transform: translateY(-50%) scale(1);
    background: rgba(64, 158, 255, 0.1);
  }
  50% {
    opacity: 1;
    transform: translateY(-50%) scale(1.2);
    background: rgba(64, 158, 255, 0.3);
  }
}

/* loading状态: 启用呼吸动画 + 蓝色样式 */
.silicone-btn.is-loading::after {
  border-color: #409eff;
  animation: breathe 2s infinite ease-in-out;
  opacity: 1;
}

/* active状态: 点击变绿 */
.silicone-btn:active::after {
  background-color: #a8e6cf;
  border-color: #7ed56f;
  opacity: 1;
  box-shadow: 0 0 4px rgba(126, 213, 111, 0.4);
}

/* 暗黑模式支持 */
.dark .silicone-btn {
  color: #d3d3d3;
  background-color: #333;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1),
    0 1px 3px rgba(255, 255, 255, 0.1);
}

.dark .silicone-btn::after {
  border-color: rgba(255, 255, 255, 0.1);
}

.dark .silicone-btn.is-loading::after {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.2);
}

.dark .silicone-btn:active {
  background-color: #444;
}

.dark .silicone-btn:active::after {
  background-color: #4caf50;
  border-color: #4caf50;
}
</style>
