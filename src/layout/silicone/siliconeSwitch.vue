<template>
  <el-switch class="silicone-switch" v-bind="$attrs" />
</template>

<script setup>
// 透传所有 attrs
</script>

<style>
/* 开关轨道(外层) */
.silicone-switch .el-switch__core {
  border-radius: 20px;
  border: none;
  background-color: #e0e0e0;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 开关按钮(内层圆球) */
.silicone-switch .el-switch__action {
  border-radius: 50%;
  background-color: #fff;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 开启状态 */
.silicone-switch.is-checked .el-switch__core {
  background-color: #409eff;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15),
    0 1px 3px rgba(64, 158, 255, 0.3);
}

/* Hover 状态 */
.silicone-switch:not(.is-disabled):hover .el-switch__core {
  background-color: #d0d0d0;
}

.silicone-switch:not(.is-disabled):hover.is-checked .el-switch__core {
  background-color: #3a8ee6; /* 开启时 hover 稍深 */
}

/* 聚焦状态 */
.silicone-switch .el-switch__core:focus-visible {
  outline: 2px solid rgba(64, 158, 255, 0.3);
  outline-offset: 2px;
}

/* 禁用状态 */
.silicone-switch.is-disabled .el-switch__core {
  background-color: #f0f0f0;
  cursor: not-allowed;
  opacity: 0.7;
}

.silicone-switch.is-disabled .el-switch__action {
  background-color: #ccc;
  cursor: not-allowed;
}

.silicone-switch.is-disabled.is-checked .el-switch__core {
  background-color: #a0cfff;
}

/* 暗黑模式 */
.dark .silicone-switch .el-switch__core {
  background-color: #444;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3),
    0 1px 2px rgba(255, 255, 255, 0.05);
}

.dark .silicone-switch .el-switch__action {
  background-color: #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(255, 255, 255, 0.05);
}

.dark .silicone-switch.is-checked .el-switch__core {
  background-color: #409eff;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3),
    0 1px 3px rgba(64, 158, 255, 0.4);
}

.dark .silicone-switch.is-checked .el-switch__action {
  box-shadow: 0 2px 6px rgba(64, 158, 255, 0.5), 0 1px 3px rgba(0, 0, 0, 0.2);
}

.dark .silicone-switch:not(.is-disabled):hover .el-switch__core {
  background-color: #505050;
}

.dark .silicone-switch:not(.is-disabled):hover.is-checked .el-switch__core {
  background-color: #3a8ee6;
}

.dark .silicone-switch.is-disabled .el-switch__core {
  background-color: #333;
  opacity: 0.6;
}

.dark .silicone-switch.is-disabled .el-switch__action {
  background-color: #666;
}

.dark .silicone-switch.is-disabled.is-checked .el-switch__core {
  background-color: #3a7bd5;
}
</style>
