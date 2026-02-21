<template>
  <el-select
    class="silicone-select"
    popper-class="silicone-select-dropdown"
    v-bind="$attrs"
    @focus="isFocused = true"
    @blur="isFocused = false"
  >
    <!-- 透传默认插槽 -->
    <slot />
    <!-- 透传 header 插槽 -->
    <template #header>
      <slot name="header" />
    </template>
    <!-- 透传 footer 插槽 -->
    <template #footer>
      <slot name="footer" />
    </template>
  </el-select>
</template>

<script setup>
import { ref } from "vue";

const isFocused = ref(false);
</script>

<style>
/* 主输入框样式 */
.silicone-select .el-select__wrapper {
  background-color: transparent;
  border-radius: 12px;
  border: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  font-size: 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  transition: all 0.15s ease;
  cursor: pointer;
}

.silicone-select .el-select__wrapper:active {
  background-color: #e6e6e6;
  transform: translateY(1px);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 隐藏下拉框的箭头 */
.el-popper__arrow {
  display: none;
}

/* 下拉框容器样式 */
.silicone-select-dropdown .el-select-dropdown {
  background-color: #f5f5f5;
  border-radius: 6px;
  border: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05),
    0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 6px;
  margin-top: -4px;
}

/* 下拉选项项 */
.silicone-select-dropdown .el-select-dropdown__item {
  border-radius: 8px;
  font-size: 14px;
  color: #333;
  transition: all 0.15s ease;
}

/* 选项 hover 状态 */
.silicone-select-dropdown .el-select-dropdown__item:hover {
  background-color: #e0e0e0;
  color: #333;
}

/* 选项选中状态 */
.silicone-select-dropdown .el-select-dropdown__item.selected {
  background-color: #d0d0d0;
  color: #333;
  font-weight: 500;
}

/* 选项 hover + 选中 */
.silicone-select-dropdown .el-select-dropdown__item.selected:hover {
  background-color: #c5c5c5;
}

/* 下拉框滚动条样式 */
.silicone-select-dropdown .el-select-dropdown__wrap {
  border-radius: 8px;
}

.silicone-select-dropdown .el-select-dropdown__wrap::-webkit-scrollbar {
  width: 6px;
}

.silicone-select-dropdown .el-select-dropdown__wrap::-webkit-scrollbar-thumb {
  background-color: #ccc;
  border-radius: 3px;
}

.silicone-select-dropdown .el-select-dropdown__wrap::-webkit-scrollbar-track {
  background-color: transparent;
}

/* 暗黑模式 */
.dark .silicone-select .el-select__wrapper {
  background-color: #333;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1),
    0 1px 3px rgba(255, 255, 255, 0.1);
}

.dark .silicone-select .el-select__selection {
  color: #d3d3d3;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.1);
}

.dark .silicone-select .el-icon {
  color: rgba(255, 255, 255, 0.5);
}

.dark .silicone-select .el-select__wrapper:active {
  background-color: #444;
}

/* 暗黑模式下拉框 */
.dark .silicone-select-dropdown.el-select-dropdown {
  background-color: #2a2a2a;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.05),
    0 4px 12px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2);
}

.dark .silicone-select-dropdown .el-select-dropdown__item {
  color: #d3d3d3;
}

.dark .silicone-select-dropdown .el-select-dropdown__item:hover {
  background-color: #3a3a3a;
  color: #fff;
}

.dark .silicone-select-dropdown .el-select-dropdown__item.selected {
  background-color: #444;
  color: #fff;
}

.dark .silicone-select-dropdown .el-select-dropdown__item.selected:hover {
  background-color: #4a4a4a;
}

.dark
  .silicone-select-dropdown
  .el-select-dropdown__wrap::-webkit-scrollbar-thumb {
  background-color: #555;
}
</style>
