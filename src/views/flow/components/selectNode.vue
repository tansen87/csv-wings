<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Handle, Position, useNodeId } from "@vue-flow/core";
import { CloseBold } from "@element-plus/icons-vue";
import { useHeaders, useSelect } from "@/store/modules/flow";
import { useWorkflowStore } from "@/store/modules/workflow";

const columns = ref<string[]>([]);
const nodeId = useNodeId();
const headerStore = useHeaders();
const selectStore = useSelect();
const isInitialized = ref(false);
const selCols = computed(() => columns.value.join("|"));

const selectData = computed(() => {
  return {
    op: "select",
    column: selCols.value
  };
});

// 挂载时恢复数据
onMounted(() => {
  if (!nodeId) return;

  const saved = selectStore.getSelect(nodeId);

  if (saved?.column) {
    columns.value = saved.column.split("|").filter(col => col.trim() !== "");
  }

  // 标记已初始化
  isInitialized.value = true;
});

watch(
  selectData,
  newData => {
    // 跳过未初始化时的空数据
    if (!isInitialized.value) return;

    if (!nodeId) return;

    // 只有当有实际数据时才更新
    if (newData.column) {
      selectStore.addSelect({
        id: nodeId,
        ...newData
      });
    }
  },
  { deep: true }
);

const props = defineProps<{ id: string }>();

function deleteBtn() {
  const store = useWorkflowStore();
  store.removeNodes([props.id]);
  // 同步删除 selectStore 中的数据
  selectStore.removeSelect(nodeId);
}
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
        <span class="font-bold"> Select </span>
        <SiliconeButton circle text @click="deleteBtn" size="small">
          <el-icon><CloseBold /></el-icon>
        </SiliconeButton>
      </div>

      <SiliconeSelect
        v-model="columns"
        multiple
        filterable
        placeholder="Select column"
      >
        <el-option
          v-for="item in headerStore.headers"
          :key="item.value"
          :label="item.label"
          :value="item.label"
        />
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
