<template>
  <el-link class="silicone-link" v-bind="$attrs" :underline="false">
    <slot />
  </el-link>
</template>

<script setup>
// 透传所有 attrs，支持 type、href、disabled 等所有 el-link 属性
</script>

<style>
/* 基础样式 */
.silicone-link.el-link {
  border-radius: 10px;
  border: none;
  background-color: transparent;
  padding: 6px 12px;
  font-size: 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  transition: all 0.15s ease;
  cursor: pointer;
  user-select: none;
}

/* 默认类型 (default) */
.silicone-link.el-link.el-link--default {
  color: #555;
}

.silicone-link.el-link.el-link--default:hover {
  background-color: rgba(0, 0, 0, 0.06);
  color: #333;
}

.silicone-link.el-link.el-link--default:active {
  background-color: rgba(0, 0, 0, 0.1);
  transform: translateY(1px);
}

/* 主要类型 (primary) */
.silicone-link.el-link.el-link--primary {
  color: #409eff;
  background-color: rgba(64, 158, 255, 0.08);
}

.silicone-link.el-link.el-link--primary:hover {
  background-color: rgba(64, 158, 255, 0.15);
  color: #3a8ee6;
  box-shadow: 0 2px 4px rgba(64, 158, 255, 0.2);
}

.silicone-link.el-link.el-link--primary:active {
  background-color: rgba(64, 158, 255, 0.2);
  transform: translateY(1px);
}

/* 成功类型 (success) */
.silicone-link.el-link.el-link--success {
  color: #67c23a;
  background-color: rgba(103, 194, 58, 0.08);
}

.silicone-link.el-link.el-link--success:hover {
  background-color: rgba(103, 194, 58, 0.15);
  color: #5da632;
  box-shadow: 0 2px 4px rgba(103, 194, 58, 0.2);
}

.silicone-link.el-link.el-link--success:active {
  background-color: rgba(103, 194, 58, 0.2);
  transform: translateY(1px);
}

/* 警告类型 (warning) */
.silicone-link.el-link.el-link--warning {
  color: #e6a23c;
  background-color: rgba(230, 162, 60, 0.08);
}

.silicone-link.el-link.el-link--warning:hover {
  background-color: rgba(230, 162, 60, 0.15);
  color: #cf9236;
  box-shadow: 0 2px 4px rgba(230, 162, 60, 0.2);
}

.silicone-link.el-link.el-link--warning:active {
  background-color: rgba(230, 162, 60, 0.2);
  transform: translateY(1px);
}

/* 危险类型 (danger) */
.silicone-link.el-link.el-link--danger {
  color: #f56c6c;
  background-color: rgba(245, 108, 108, 0.08);
}

.silicone-link.el-link.el-link--danger:hover {
  background-color: rgba(245, 108, 108, 0.15);
  color: #dd5555;
  box-shadow: 0 2px 4px rgba(245, 108, 108, 0.2);
}

.silicone-link.el-link.el-link--danger:active {
  background-color: rgba(245, 108, 108, 0.2);
  transform: translateY(1px);
}

/* 禁用状态 */
.silicone-link.el-link.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.silicone-link.el-link.is-disabled:hover,
.silicone-link.el-link.is-disabled:active {
  background-color: transparent;
  transform: none;
  box-shadow: none;
}

/* 暗黑模式 */
.dark .silicone-link.el-link.el-link--default {
  color: #c0c0c0;
}

.dark .silicone-link.el-link.el-link--default:hover {
  background-color: rgba(255, 255, 255, 0.06);
  color: #e0e0e0;
}

.dark .silicone-link.el-link.el-link--default:active {
  background-color: rgba(255, 255, 255, 0.1);
}

/* 暗黑模式 - primary */
.dark .silicone-link.el-link.el-link--primary {
  background-color: rgba(64, 158, 255, 0.12);
}

.dark .silicone-link.el-link.el-link--primary:hover {
  background-color: rgba(64, 158, 255, 0.2);
  box-shadow: 0 2px 4px rgba(64, 158, 255, 0.3);
}

.dark .silicone-link.el-link.el-link--primary:active {
  background-color: rgba(64, 158, 255, 0.25);
}

/* 暗黑模式 - success */
.dark .silicone-link.el-link.el-link--success {
  background-color: rgba(103, 194, 58, 0.12);
}

.dark .silicone-link.el-link.el-link--success:hover {
  background-color: rgba(103, 194, 58, 0.2);
  box-shadow: 0 2px 4px rgba(103, 194, 58, 0.3);
}

/* 暗黑模式 - warning */
.dark .silicone-link.el-link.el-link--warning {
  background-color: rgba(230, 162, 60, 0.12);
}

.dark .silicone-link.el-link.el-link--warning:hover {
  background-color: rgba(230, 162, 60, 0.2);
  box-shadow: 0 2px 4px rgba(230, 162, 60, 0.3);
}

/* 暗黑模式 - danger */
.dark .silicone-link.el-link.el-link--danger {
  background-color: rgba(245, 108, 108, 0.12);
}

.dark .silicone-link.el-link.el-link--danger:hover {
  background-color: rgba(245, 108, 108, 0.2);
  box-shadow: 0 2px 4px rgba(245, 108, 108, 0.3);
}
</style>
