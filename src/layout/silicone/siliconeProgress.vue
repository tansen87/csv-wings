<template>
  <el-progress
    class="silicone-progress"
    v-bind="$attrs"
    :show-text="showText"
    :text-inside="textInside"
  />
</template>

<script setup>
// 暴露 props 用于默认行为控制
defineProps({
  showText: {
    type: Boolean,
    default: true
  },
  textInside: {
    type: Boolean,
    default: false
  }
});
</script>

<style>
/* 主进度条容器 */
.silicone-progress .el-progress-bar {
  padding-right: 0;
}

/* 轨道 */
.silicone-progress .el-progress-bar__outer {
  border-radius: 12px;
  background-color: #e0e0e0; /* 浅灰轨道 */
  height: 12px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 已完成部分 */
.silicone-progress .el-progress-bar__inner {
  border-radius: 12px;
  background: linear-gradient(90deg, #60a7ff, #8cc5ff); /* 蓝色渐变 */
  transition: width 0.4s ease;
  box-shadow: inset 0 -1px 2px rgba(255, 255, 255, 0.3),
    inset 0 1px 2px rgba(255, 255, 255, 0.2);
}

/* 进度文字 */
.silicone-progress .el-progress__text {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  font-size: 13px;
  color: #555;
  font-weight: 500;
  margin-left: 8px;
}

/* 内嵌文字(text-inside) */
.silicone-progress .el-progress-bar__innerText {
  color: white;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* 暗黑模式 */
.dark .silicone-progress .el-progress-bar__outer {
  background-color: #444;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1);
}

.dark .silicone-progress .el-progress__text {
  color: #ccc;
}

.dark .silicone-progress .el-progress-bar__inner {
  background: linear-gradient(90deg, #60a7ff, #8cc5ff);
  box-shadow: inset 0 -1px 2px rgba(255, 255, 255, 0.2),
    inset 0 1px 2px rgba(255, 255, 255, 0.1);
}
</style>
