<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { Handle, Position, useNodeId } from "@vue-flow/core";
import { CloseBold } from "@element-plus/icons-vue";
import { useHeaders, useFilter } from "@/store/modules/flow";
import { useWorkflowStore } from "@/store/modules/workflow";

const [columns, condition] = [ref(""), ref("")];
const logic = ref("or");
const mode = ref("equal");
const nodeId = useNodeId();
const headerStore = useHeaders();
const filterStore = useFilter();
const isInitialized = ref(false);

// 分别监听每个字段,避免 deep: true 导致多次触发
watch(
  [columns, condition, logic, mode],
  () => {
    // 跳过未初始化时的空数据
    if (!isInitialized.value) return;

    if (!nodeId) return;

    // 仅当有实际数据时才更新
    if (columns.value || condition.value) {
      filterStore.addFilter({
        id: nodeId,
        op: "filter",
        logic: logic.value,
        mode: mode.value,
        column: columns.value,
        value: condition.value
      });
    }
  },
  { deep: false }
);

const props = defineProps<{ id: string }>();

function deleteBtn() {
  const store = useWorkflowStore();
  store.removeNodes([props.id]);
  // 同时删除filterStore中的数据
  filterStore.filters = filterStore.filters.filter(f => f.id !== nodeId);
}

onMounted(() => {
  if (!nodeId) return;

  const existingFilter = filterStore.filters.find(f => f.id === nodeId);

  if (existingFilter) {
    logic.value = existingFilter.logic || "or";
    mode.value = existingFilter.mode || "equal";
    columns.value = existingFilter.column || "";
    condition.value = existingFilter.value || "";
    isInitialized.value = true;
  } else {
    isInitialized.value = true;
  }
});
</script>

<template>
  <div class="page-container">
    <div class="node-container w-[200px]">
      <Handle
        type="target"
        :position="Position.Left"
        id="input"
        class="handle-style"
      />

      <div class="flex justify-between items-center mb-1 w-full">
        <span class="font-bold"> Filter </span>
        <SiliconeButton circle text @click="deleteBtn" size="small">
          <el-icon><CloseBold /></el-icon>
        </SiliconeButton>
      </div>

      <SiliconeSelect
        v-model="columns"
        filterable
        placeholder="Select column"
        style="margin-bottom: 6px"
      >
        <el-option
          v-for="item in headerStore.headers"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </SiliconeSelect>

      <SiliconeSelect v-model="mode" filterable style="margin-bottom: 6px">
        <el-option label="Equal" value="equal" />
        <el-option label="NotEqual" value="not_equal" />
        <el-option label="Contains" value="contains" />
        <el-option label="NotContains" value="not_contains" />
        <el-option label="StartsWith" value="starts_with" />
        <el-option label="NotStartsWith" value="not_starts_with" />
        <el-option label="EndsWith" value="ends_with" />
        <el-option label="NotEndsWith" value="not_ends_with" />
        <el-option label="IsNull" value="is_null" />
        <el-option label="IsNotNull" value="is_not_null" />
        <el-option label="gt(>)" value="gt" />
        <el-option label="ge(≥)" value="ge" />
        <el-option label="lt(<)" value="lt" />
        <el-option label="le(≤)" value="le" />
        <el-option label="Between" value="between" />
      </SiliconeSelect>

      <SiliconeInput
        v-if="mode !== 'is_null' && mode !== 'is_not_null'"
        v-model="condition"
        placeholder="Filter conditions"
      />

      <SiliconeSelect v-model="logic" style="margin-top: 6px">
        <el-option label="OR" value="or" />
        <el-option label="AND" value="and" />
      </SiliconeSelect>

      <Handle
        type="source"
        :position="Position.Right"
        id="output"
        class="handle-style"
      />
    </div>
  </div>
</template>
