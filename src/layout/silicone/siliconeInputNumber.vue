<template>
  <el-input-number class="silicone-input-number" v-bind="$attrs" />
</template>

<script setup>
// 透传所有 attrs
</script>

<style>
/* 主容器 */
.silicone-input-number .el-input__wrapper {
  border-radius: 12px;
  background-color: transparent;
  border: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  font-size: 14px;
  transition: all 0.15s ease;
  color: #333;
}

/* 输入框 */
.silicone-input-number .el-input__inner {
  text-align: center;
  background: transparent;
  border: none;
  color: inherit;
}

/* 增减按钮 */
.silicone-input-number .el-input-number__decrease,
.silicone-input-number .el-input-number__increase {
  width: 32px;
  height: auto;
  line-height: 1;
  background: transparent;
  color: #666;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

/* 按钮 hover 效果 */
.silicone-input-number .el-input-number__decrease:hover,
.silicone-input-number .el-input-number__increase:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #333;
}

/* 按钮 active / 点击 */
.silicone-input-number .el-input-number__decrease:active,
.silicone-input-number .el-input-number__increase:active {
  background-color: rgba(0, 0, 0, 0.1);
}

/* 聚焦状态 */
.silicone-input-number.is-focused .el-input__wrapper {
  background-color: #e9e9e9;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15), 0 1px 4px rgba(0, 0, 0, 0.2);
}

/* 禁用状态 */
.silicone-input-number.is-disabled .el-input__wrapper {
  background-color: #f8f8f8;
  color: #aaa;
  cursor: not-allowed;
}

.silicone-input-number.is-disabled .el-input-number__decrease,
.silicone-input-number.is-disabled .el-input-number__increase {
  color: #bbb;
  cursor: not-allowed;
  opacity: 0.6;
}

/* 暗黑模式 */
.dark .silicone-input-number .el-input__wrapper {
  background-color: #333;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1),
    0 1px 3px rgba(255, 255, 255, 0.1);
  color: #d3d3d3;
}

.dark .silicone-input-number .el-input-number__decrease,
.dark .silicone-input-number .el-input-number__increase {
  color: #aaa;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.dark .silicone-input-number .el-input-number__decrease:hover,
.dark .silicone-input-number .el-input-number__increase:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.dark .silicone-input-number.is-focused .el-input__wrapper {
  background-color: #3a3a3a;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.15),
    0 1px 4px rgba(255, 255, 255, 0.2);
}

.dark .silicone-input-number.is-disabled .el-input__wrapper {
  background-color: #2a2a2a;
  color: #777;
}
</style>
