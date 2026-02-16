<template>
  <el-select
    class="silicone-select"
    v-bind="$attrs"
    @focus="isFocused = true"
    @blur="isFocused = false"
  >
    <slot />
  </el-select>
</template>

<script setup>
import { ref } from "vue";

const isFocused = ref(false);
</script>

<style>
/* 主容器 */
.silicone-select .el-select__wrapper {
  border-radius: 12px;
  background-color: transparent;
  border: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  font-size: 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  transition: all 0.15s ease;
  cursor: pointer;
}

/* 点击/激活反馈 */
.silicone-select .el-select__wrapper:active {
  background-color: #e6e6e6;
  transform: translateY(1px);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.1);
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
</style>
