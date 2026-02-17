<template>
  <el-table class="silicone-table" v-bind="$attrs" tooltip-effect="light">
    <slot />
  </el-table>
</template>

<script setup>
// 透传所有 attrs
</script>

<style>
/* 表格容器 */
.silicone-table {
  border-radius: 12px;
  overflow: hidden; /* 确保圆角生效 */
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.1);
  background: transparent;
  border: none;
}

/* 表头 */
.silicone-table .el-table__header-wrapper th {
  background-color: #f5f5f5;
  color: #333;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

/* 表体 */
.silicone-table .el-table__body-wrapper td {
  color: #333;
  font-size: 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

/* 行 hover 效果*/
.silicone-table .el-table__body-wrapper tr:hover td {
  background-color: #f9f9f9;
}

/* 无数据状态 */
.silicone-table .el-table__empty-block {
  padding: 24px 0;
  color: #888;
  font-size: 14px;
}

/* 暗黑模式 */
.dark .silicone-table {
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.3);
}

.dark .silicone-table .el-table__header-wrapper th {
  background-color: #2a2a2a;
  color: #ddd;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.dark .silicone-table .el-table__body-wrapper td {
  color: #ccc;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.dark .silicone-table .el-table__body-wrapper tr:hover td {
  background-color: #333;
}

.dark .silicone-table .el-table__body-wrapper tr.current-row td {
  background-color: #1a3a5f;
  color: #40a9ff;
}

.dark .silicone-table .el-table__empty-block {
  color: #aaa;
}
</style>
