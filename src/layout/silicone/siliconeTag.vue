<template>
  <el-tag class="silicone-tag" v-bind="$attrs">
    <slot />
  </el-tag>
</template>

<script setup>
// 所有 el-tag 属性通过 $attrs 透传
</script>

<style>
.silicone-tag {
  padding: 6px 14px !important;
  border-radius: 12px !important;
  font-size: 13px !important;
  font-weight: 500;
  color: #333 !important;
  background: linear-gradient(145deg, #f5f5f5, #eeeeee) !important;
  border: none !important;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.8),
    0 2px 6px rgba(0, 0, 0, 0.08) !important;
  transition: all 0.2s ease;
}

.silicone-tag.el-tag--primary {
  background: linear-gradient(
    145deg,
    rgba(64, 158, 255, 0.15),
    rgba(79, 170, 255, 0.25)
  ) !important;
  color: #409eff !important;
}

.silicone-tag.el-tag--success {
  background: linear-gradient(
    145deg,
    rgba(103, 194, 58, 0.15),
    rgba(118, 207, 74, 0.25)
  ) !important;
  color: #67c23a !important;
}

.silicone-tag.el-tag--warning {
  background: linear-gradient(
    145deg,
    rgba(230, 162, 60, 0.15),
    rgba(243, 176, 74, 0.25)
  ) !important;
  color: #e6a23c !important;
}

.silicone-tag.el-tag--danger {
  background: linear-gradient(
    145deg,
    rgba(245, 108, 108, 0.15),
    rgba(250, 127, 127, 0.25)
  ) !important;
  color: #f56c6c !important;
}

.silicone-tag.el-tag--info {
  background: linear-gradient(
    145deg,
    rgba(144, 147, 153, 0.15),
    rgba(169, 172, 178, 0.25)
  ) !important;
  color: #909399 !important;
}

.silicone-tag .el-tag__close {
  opacity: 0.6;
  margin-left: 6px;
}

.silicone-tag .el-tag__close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.1);
}

.dark .silicone-tag {
  color: #e0e0e0 !important;
  background: linear-gradient(145deg, #3a3a3a, #323232) !important;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1),
    0 2px 6px rgba(0, 0, 0, 0.3) !important;
}

.dark .silicone-tag .el-tag__close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.dark .silicone-tag.el-tag--primary {
  background: linear-gradient(
    145deg,
    rgba(64, 158, 255, 0.25),
    rgba(79, 170, 255, 0.35)
  ) !important;
}

.dark .silicone-tag.el-tag--success {
  background: linear-gradient(
    145deg,
    rgba(103, 194, 58, 0.25),
    rgba(118, 207, 74, 0.35)
  ) !important;
}

.dark .silicone-tag.el-tag--warning {
  background: linear-gradient(
    145deg,
    rgba(230, 162, 60, 0.25),
    rgba(243, 176, 74, 0.35)
  ) !important;
}

.dark .silicone-tag.el-tag--danger {
  background: linear-gradient(
    145deg,
    rgba(245, 108, 108, 0.25),
    rgba(250, 127, 127, 0.35)
  ) !important;
}

.dark .silicone-tag.el-tag--info {
  background: linear-gradient(
    145deg,
    rgba(144, 147, 153, 0.25),
    rgba(169, 172, 178, 0.35)
  ) !important;
}
</style>
