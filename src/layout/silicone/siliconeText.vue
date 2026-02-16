<template>
  <div
    :class="['silicone-text', computedClass, { truncated: truncated }]"
    :style="textStyle"
  >
    <slot />
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  // 文本大小
  size: {
    type: String,
    default: "medium" // 'small' | 'medium' | 'large'
  },
  // 字重
  weight: {
    type: String,
    default: "normal" // 'light' | 'normal' | 'bold'
  },
  // 颜色主题
  color: {
    type: String,
    default: "default" // 'default' | 'primary' | 'secondary' | 'error' | 'success' | 'warning'
  },
  // 对齐方式
  align: {
    type: String,
    default: "left" // 'left' | 'center' | 'right'
  },
  // 是否启用省略
  truncated: {
    type: Boolean,
    default: false
  },
  // 最大显示行数（仅在 truncated=true 时生效）
  maxLines: {
    type: [Number, String],
    default: 2
  },
  // 显示类型：block（默认）或 inline-block
  display: {
    type: String,
    default: "block" // 'block' | 'inline-block'
  }
});

const computedClass = computed(() => ({
  [`text-${props.size}`]: true,
  [`font-${props.weight}`]: true,
  [`text-${props.color}`]: true,
  [`text-align-${props.align}`]: true
}));

const textStyle = computed(() => {
  const style = {
    display: props.display
  };

  if (props.truncated) {
    style.display = "-webkit-box";
    style["-webkit-box-orient"] = "vertical";
    style["-webkit-line-clamp"] = props.maxLines;
    style.overflow = "hidden";
    style["text-overflow"] = "ellipsis";
  }

  return style;
});
</script>

<style scoped>
/* 基础样式 */
.silicone-text {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  padding: 4px 8px;
  border-radius: 12px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.15s ease;
  word-wrap: break-word;
  word-break: break-word;
}

/* 尺寸 */
.text-small {
  font-size: 12px;
  padding: 4px 8px;
}
.text-medium {
  font-size: 14px;
  padding: 4px 8px;
}
.text-large {
  font-size: 16px;
  padding: 12px 24px;
}

/* 字重 */
.font-light {
  font-weight: 300;
}
.font-normal {
  font-weight: 400;
}
.font-bold {
  font-weight: 600;
}

/* 颜色 */
.text-default {
  color: #333;
}
.text-primary {
  color: #3b82f6;
}
.text-secondary {
  color: #6b7280;
}
.text-error {
  color: #ef4444;
}
.text-success {
  color: #10b981;
}
.text-warning {
  color: #f59e0b;
}

/* 对齐 */
.text-align-left {
  text-align: left;
}
.text-align-center {
  text-align: center;
}
.text-align-right {
  text-align: right;
}

/* 悬停反馈 */
.silicone-text:hover {
  background-color: #f0f0f0;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15), 0 2px 5px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

/* 暗黑模式 */
.dark .silicone-text {
  background-color: #1f1f1f;
  color: #ffffff;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.5);
}
.dark .text-default {
  color: #ffffff;
}
.dark .text-primary {
  color: #93c5fd;
}
.dark .text-secondary {
  color: #d1d5db;
}
.dark .text-error {
  color: #fca5a5;
}
.dark .text-success {
  color: #6ee7b7;
}
.dark .text-warning {
  color: #fcd34d;
}

/* 暗黑模式悬停 */
.dark .silicone-text:hover {
  background-color: #2a2a2a;
  color: #ffffff;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.15),
    0 2px 5px rgba(0, 0, 0, 0.6);
}
</style>
