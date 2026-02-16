<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Handle, Position, useNodeId } from "@vue-flow/core";
import { CloseBold } from "@element-plus/icons-vue";
import { useHeaders, useSelect } from "@/store/modules/flow";
import { useWorkflowStore } from "@/store/modules/workflow";

const columns = ref([]);
const nodeId = useNodeId();
const headerStore = useHeaders();
const selectStore = useSelect();
const selCols = computed(() => columns.value.join("|"));
const selectData = computed(() => {
  return {
    op: "select",
    column: selCols.value
  };
});

onMounted(() => {
  const saved = selectStore.selects.find(s => s.id === nodeId);
  if (saved?.column) {
    columns.value = saved.column.split("|").filter(col => col.trim() !== "");
  }
});

watch(
  selectData,
  newData => {
    if (nodeId && newData.column) {
      selectStore.addSelect({
        id: nodeId,
        ...newData
      });
    }
  },
  { deep: true, immediate: true }
);

const props = defineProps<{ id: string }>();

function deleteBtn() {
  const store = useWorkflowStore();
  store.removeNodes([props.id]);
}
</script>

<template>
  <div class="page-container">
    <div class="node-container">
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
