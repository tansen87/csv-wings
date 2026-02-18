<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import { Handle, Position, useNodeId } from "@vue-flow/core";
import { CloseBold } from "@element-plus/icons-vue";
import { useHeaders, useRename } from "@/store/modules/flow";
import { useWorkflowStore } from "@/store/modules/workflow";

const [old_col, new_col] = [ref(""), ref("")];
const nodeId = useNodeId();
const headerStore = useHeaders();
const renameStore = useRename();
const isInitialized = ref(false);

const renameData = computed(() => {
  return {
    op: "rename",
    column: old_col.value,
    value: new_col.value
  };
});

watch(
  renameData,
  newData => {
    // 跳过未初始化时的空数据
    if (!isInitialized.value) {
      return;
    }

    if (!nodeId) return;

    // 只有当有实际数据时才更新
    if (newData.column || newData.value) {
      renameStore.addRename({
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
  // 同步删除 renameStore 中的数据
  renameStore.removeRename(nodeId);
}

// 挂载时恢复数据
onMounted(() => {
  if (!nodeId) return;

  const existingRename = renameStore.getRename(nodeId);

  if (existingRename) {
    old_col.value = existingRename.column || "";
    new_col.value = existingRename.value || "";
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
        <span class="font-bold"> Rename </span>
        <SiliconeButton circle text @click="deleteBtn" size="small">
          <el-icon><CloseBold /></el-icon>
        </SiliconeButton>
      </div>

      <SiliconeSelect
        v-model="old_col"
        filterable
        placeholder="Select column"
        style="margin-bottom: 6px"
      >
        <el-option
          v-for="item in headerStore.headers"
          :key="item.value"
          :label="item.label"
          :value="item.label"
        />
      </SiliconeSelect>

      <SiliconeInput
        v-model="new_col"
        placeholder="New name"
        style="width: 100%"
      />

      <Handle
        type="source"
        :position="Position.Right"
        id="output"
        class="handle-style"
      />
    </div>
  </div>
</template>
