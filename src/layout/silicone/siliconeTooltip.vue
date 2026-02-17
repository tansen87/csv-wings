<template>
  <el-tooltip
    class="silicone-tooltip"
    v-bind="$attrs"
    effect="light"
    :popper-class="
      ['silicone-tooltip-popper', $attrs.popperClass].filter(Boolean).join(' ')
    "
  >
    <slot />
    <template #content>
      <slot name="content">
        {{ $attrs.content }}
      </slot>
    </template>
  </el-tooltip>
</template>

<script setup>
// 透传所有 attrs，支持 content、placement、effect 等所有 el-tooltip 属性
</script>

<style>
/* Tooltip Popper 容器 */
.silicone-tooltip-popper.el-popper {
  border-radius: 10px;
  border: none;
  padding: 8px 12px;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  word-break: break-word;
}

/* 浅色模式 (light) */
.silicone-tooltip-popper.el-popper {
  background-color: #f7f7f7;
  color: #333;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.8),
    0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08);
}

/* 深色模式 (dark) */
.dark .silicone-tooltip-popper.el-popper {
  background-color: #2d2d2d;
  color: #e0e0e0;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.08),
    0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2);
}

/* 进入/退出动画 */
.silicone-tooltip .fade-in-linear-enter-active,
.silicone-tooltip .fade-in-linear-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.silicone-tooltip .fade-in-linear-enter-from,
.silicone-tooltip .fade-in-linear-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* 不同位置的微调 */
/* 顶部位置 */
.silicone-tooltip-popper.el-popper[data-popper-placement^="top"] {
  margin-bottom: 4px;
}

/* 底部位置 */
.silicone-tooltip-popper.el-popper[data-popper-placement^="bottom"] {
  margin-top: 4px;
}

/* 左侧位置 */
.silicone-tooltip-popper.el-popper[data-popper-placement^="left"] {
  margin-right: 4px;
}

/* 右侧位置 */
.silicone-tooltip-popper.el-popper[data-popper-placement^="right"] {
  margin-left: 4px;
}
</style>
