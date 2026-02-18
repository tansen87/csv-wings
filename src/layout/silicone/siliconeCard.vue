<template>
  <el-card
    :class="['silicone-card', `shadow-${props.shadow}`]"
    :style="{ padding: props.padding }"
    v-bind="$attrs"
  >
    <slot />
  </el-card>
</template>

<script setup>
const props = defineProps({
  padding: {
    type: [String, Number],
    default: "0px"
  },
  shadow: {
    type: String,
    default: "hover"
  }
});
</script>

<style scoped>
/* 基础样式 */
.silicone-card {
  border-radius: 12px;
  background-color: #ffffff;
  border: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.1); /* 外发光 */
  transition: all 0.15s ease;
}

/* 阴影控制 */
.shadow-always {
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.1);
}
.shadow-hover {
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.15s ease;
}
.shadow-hover:hover {
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.15);
}
.shadow-never {
  box-shadow: none;
}

/* 暗黑模式 */
.dark .silicone-card {
  background-color: #333;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1),
    0 4px 8px rgba(0, 0, 0, 0.3);
}

.dark .shadow-hover {
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.1);
}
.dark .shadow-hover:hover {
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.15),
    0 4px 8px rgba(0, 0, 0, 0.15);
}
</style>
