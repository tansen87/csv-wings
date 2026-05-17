<template>
  <el-card
    :class="['silicone-card', `shadow-${props.shadow}`, `card-${props.variant}`]"
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
  },
  variant: {
    type: String,
    default: "default"
  }
});
</script>

<style scoped>
.silicone-card {
  border-radius: 14px;
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.silicone-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
  pointer-events: none;
}

.shadow-always {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.shadow-hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.shadow-hover:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  border-color: rgba(0, 0, 0, 0.1);
}

.shadow-never {
  box-shadow: none;
  border-color: rgba(0, 0, 0, 0.04);
}

.card-default {
  background-color: #ffffff;
}

.card-filled {
  background: linear-gradient(145deg, #fafafa, #f5f5f5);
  border-color: rgba(0, 0, 0, 0.04);
}

.card-outline {
  background-color: #ffffff;
  border-width: 1.5px;
  border-color: rgba(0, 0, 0, 0.1);
}

.card-primary {
  background: linear-gradient(145deg, rgba(64, 158, 255, 0.05), rgba(64, 158, 255, 0.02));
  border-color: rgba(64, 158, 255, 0.15);
}

.card-success {
  background: linear-gradient(145deg, rgba(103, 194, 58, 0.05), rgba(103, 194, 58, 0.02));
  border-color: rgba(103, 194, 58, 0.15);
}

.card-warning {
  background: linear-gradient(145deg, rgba(230, 162, 60, 0.05), rgba(230, 162, 60, 0.02));
  border-color: rgba(230, 162, 60, 0.15);
}

.card-danger {
  background: linear-gradient(145deg, rgba(245, 108, 108, 0.05), rgba(245, 108, 108, 0.02));
  border-color: rgba(245, 108, 108, 0.15);
}

.dark .silicone-card {
  background-color: #2a2a2a;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.dark .shadow-always {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

.dark .shadow-hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.dark .shadow-hover:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  border-color: rgba(255, 255, 255, 0.12);
}

.dark .shadow-never {
  box-shadow: none;
  border-color: rgba(255, 255, 255, 0.06);
}

.dark .card-default {
  background-color: #2a2a2a;
}

.dark .card-filled {
  background: linear-gradient(145deg, #2e2e2e, #262626);
  border-color: rgba(255, 255, 255, 0.04);
}

.dark .card-outline {
  background-color: #2a2a2a;
  border-color: rgba(255, 255, 255, 0.12);
}

.dark .card-primary {
  background: linear-gradient(145deg, rgba(64, 158, 255, 0.12), rgba(64, 158, 255, 0.06));
  border-color: rgba(64, 158, 255, 0.25);
}

.dark .card-success {
  background: linear-gradient(145deg, rgba(103, 194, 58, 0.12), rgba(103, 194, 58, 0.06));
  border-color: rgba(103, 194, 58, 0.25);
}

.dark .card-warning {
  background: linear-gradient(145deg, rgba(230, 162, 60, 0.12), rgba(230, 162, 60, 0.06));
  border-color: rgba(230, 162, 60, 0.25);
}

.dark .card-danger {
  background: linear-gradient(145deg, rgba(245, 108, 108, 0.12), rgba(245, 108, 108, 0.06));
  border-color: rgba(245, 108, 108, 0.25);
}
</style>
