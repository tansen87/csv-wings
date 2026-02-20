<template>
  <el-input
    ref="inputRef"
    class="silicone-input"
    v-bind="$attrs"
    :type="props.type"
    :autosize="
      props.type === 'textarea' ? { minRows: 2, maxRows: 2 } : undefined
    "
  />
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  type: {
    type: String,
    default: "text"
  }
});

const inputRef = ref(null);
defineExpose({
  focus: () => {
    inputRef.value?.focus();
  }
});
</script>

<style>
/* input */
.silicone-input .el-input__wrapper {
  border-radius: 12px;
  background-color: transparent;
  border: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  font-size: 14px;
  transition: all 0.15s ease;
}

/* textarea */
.silicone-input .el-textarea__inner {
  border-radius: 12px;
  background-color: transparent;
  border: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  font-size: 14px;
  transition: all 0.15s ease;
  resize: none;
}

/* 聚焦状态 */
.silicone-input .el-input__wrapper.is-focused {
  background-color: #e9e9e9;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15), 0 1px 4px rgba(0, 0, 0, 0.2);
}

.silicone-input .el-textarea__inner:focus {
  background-color: #e9e9e9;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15), 0 1px 4px rgba(0, 0, 0, 0.2);
}

/* 禁用状态 */
.silicone-input .el-input__wrapper.is-disabled,
.silicone-input .el-textarea__inner:disabled {
  background-color: #f8f8f8;
  color: #aaa;
  cursor: not-allowed;
}

/* 暗黑模式 */
.dark .silicone-input .el-input__wrapper,
.dark .silicone-input .el-textarea__inner {
  background-color: #333;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1),
    0 1px 3px rgba(255, 255, 255, 0.1);
  color: #d3d3d3;
}

.dark .silicone-input .el-input__wrapper.is-focused,
.dark .silicone-input .el-textarea__inner:focus {
  background-color: #3a3a3a;
}

.dark .silicone-input .el-input__wrapper.is-disabled,
.dark .silicone-input .el-textarea__inner:disabled {
  background-color: #2a2a2a;
  color: #777;
}
</style>
