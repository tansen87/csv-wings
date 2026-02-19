<template>
  <el-dialog class="silicone-dialog" v-bind="$attrs">
    <!-- 透传所有具名插槽 -->
    <template #header v-if="$slots.header">
      <slot name="header" />
    </template>

    <!-- 默认插槽 -->
    <slot />

    <!-- 透传 footer 插槽 -->
    <template #footer v-if="$slots.footer">
      <slot name="footer" />
    </template>
  </el-dialog>
</template>

<script setup>
// 透传所有 attrs
</script>

<style>
/* 遮罩层 */
.silicone-dialog + .el-overlay {
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px); /* 毛玻璃效果 */
}

/* 对话框容器 */
.silicone-dialog.el-dialog {
  border-radius: 16px;
  border: none;
  background-color: #f7f7f7;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.8),
    0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  padding: 0;
}

/* 对话框头部 */
.silicone-dialog .el-dialog__header {
  padding: 16px 20px;
  margin: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.silicone-dialog .el-dialog__title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
}

/* 关闭按钮 */
.silicone-dialog .el-dialog__headerbtn {
  top: 16px;
  right: 16px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background-color: transparent;
  transition: all 0.15s ease;
}

.silicone-dialog .el-dialog__headerbtn .el-dialog__close {
  color: #666;
  font-size: 16px;
  transition: all 0.15s ease;
}

.silicone-dialog .el-dialog__headerbtn:hover {
  background-color: rgba(0, 0, 0, 0.08);
}

.silicone-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: #333;
}

/* 对话框内容 */
.silicone-dialog .el-dialog__body {
  padding: 16px;
  color: #555;
  font-size: 14px;
  background-color: transparent;
  margin-top: -4px;
}

/* 对话框底部 */
.silicone-dialog .el-dialog__footer {
  padding: 14px 20px 20px;
  margin: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background-color: transparent;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 底部按钮统一样式 */
.silicone-dialog .el-dialog__footer .el-button {
  border-radius: 12px;
  padding: 8px 20px;
  font-size: 14px;
  transition: all 0.15s ease;
}

/* 取消按钮 */
.silicone-dialog .el-dialog__footer .el-button--default {
  background-color: #e8e8e8;
  border: none;
  color: #555;
}

.silicone-dialog .el-dialog__footer .el-button--default:hover {
  background-color: #d8d8d8;
  color: #333;
}

/* 确认按钮 */
.silicone-dialog .el-dialog__footer .el-button--primary {
  background-color: #409eff;
  border: none;
  color: #9bd7f3;
  box-shadow: 0 2px 4px rgba(64, 158, 255, 0.3);
}

.silicone-dialog .el-dialog__footer .el-button--primary:hover {
  background-color: #3a8ee6;
  box-shadow: 0 3px 6px rgba(64, 158, 255, 0.4);
}

/* 暗黑模式 */
.dark .silicone-dialog + .el-overlay {
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.dark .silicone-dialog.el-dialog {
  background-color: #2d2d2d;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.08),
    0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
}

.dark .silicone-dialog .el-dialog__header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.dark .silicone-dialog .el-dialog__title {
  color: #e0e0e0;
}

.dark .silicone-dialog .el-dialog__headerbtn .el-dialog__close {
  color: #999;
}

.dark .silicone-dialog .el-dialog__headerbtn:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.dark .silicone-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: #fff;
}

.dark .silicone-dialog .el-dialog__body {
  color: #c0c0c0;
}

.dark .silicone-dialog .el-dialog__footer {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

/* 暗黑模式按钮 */
.dark .silicone-dialog .el-dialog__footer .el-button--default {
  background-color: #3a3a3a;
  color: #c0c0c0;
}

.dark .silicone-dialog .el-dialog__footer .el-button--default:hover {
  background-color: #444;
  color: #fff;
}

.dark .silicone-dialog .el-dialog__footer .el-button--primary {
  background-color: #409eff;
  box-shadow: 0 2px 4px rgba(64, 158, 255, 0.4);
}

.dark .silicone-dialog .el-dialog__footer .el-button--primary:hover {
  background-color: #3a8ee6;
  box-shadow: 0 3px 6px rgba(64, 158, 255, 0.5);
}
</style>
