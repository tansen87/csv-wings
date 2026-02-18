<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { Handle, Position, useNodeId } from "@vue-flow/core";
import { FolderOpened, CloseBold } from "@element-plus/icons-vue";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { shortFileName } from "@/utils/utils";
import { useHeaders } from "@/store/modules/flow";
import { useWorkflowStore } from "@/store/modules/workflow";
import { useSkiprows } from "@/store/modules/options";
import { useInput } from "@/store/modules/flow";

const path = ref("");
const isPath = ref(false);
const [tableColumn, tableData] = [ref([]), ref([])];
const nodeId = useNodeId();
const headerStore = useHeaders();
const skiprows = useSkiprows();
const inputStore = useInput();
const isInitialized = ref(false);
const props = defineProps<{ id: string }>();

function deleteBtn() {
  const store = useWorkflowStore();
  store.removeNodes([props.id]);
  // 同步删除 inputStore 中的数据
  inputStore.removeInput(nodeId);
}

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    isPath.value = false;
    return;
  }

  isPath.value = true;
  try {
    const headers: any = await mapHeaders(path.value, skiprows.skiprows);
    headerStore.headers = headers;
    const { columnView, dataView } = await toJson(
      path.value,
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;

    // 保存到 inputStore
    saveToStore();
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
}

// 保存到 store 的函数
function saveToStore() {
  if (!nodeId || !isPath.value) return;

  inputStore.addInput({
    id: nodeId,
    path: path.value,
    isPath: isPath.value,
    headers: headerStore.headers,
    tableColumn: tableColumn.value,
    tableData: tableData.value
  });
}

// 监听 path 变化,自动保存
watch([path, isPath], () => {
  // 跳过初始化时的空数据
  if (!isInitialized.value) return;

  if (isPath.value && path.value) {
    saveToStore();
  }
});

// 挂载时恢复数据
onMounted(async () => {
  if (!nodeId) return;

  const existingInput = inputStore.getInput(nodeId);

  if (existingInput && existingInput.isPath && existingInput.path) {
    // 恢复基本状态
    path.value = existingInput.path;
    isPath.value = existingInput.isPath;

    // 恢复表格数据
    if (existingInput.tableColumn) {
      tableColumn.value = existingInput.tableColumn;
    }
    if (existingInput.tableData) {
      tableData.value = existingInput.tableData;
    }
    if (existingInput.headers) {
      headerStore.headers = existingInput.headers;
    }

    // 标记已初始化
    isInitialized.value = true;
  } else {
    isInitialized.value = true;
  }
});
</script>

<template>
  <div class="page-container node-container w-[400px]">
    <div class="flex justify-between items-center mb-1 w-full">
      <span class="font-bold"> Start </span>
      <SiliconeButton
        @click="selectFile()"
        :icon="FolderOpened"
        text
        class="mb-1"
      >
        <span v-if="isPath">
          <SiliconeTooltip :content="path">
            <span>{{ shortFileName(path) }}</span>
          </SiliconeTooltip>
        </span>
        <span v-else>Open File</span>
      </SiliconeButton>
      <SiliconeButton circle text @click="deleteBtn" size="small">
        <el-icon><CloseBold /></el-icon>
      </SiliconeButton>
    </div>

    <SiliconeTable :data="tableData" show-overflow-tooltip height="200px">
      <el-table-column
        v-for="column in tableColumn"
        :prop="column.prop"
        :label="column.label"
        :key="column.prop"
      />
    </SiliconeTable>

    <Handle
      type="source"
      :position="Position.Right"
      id="output"
      class="handle-style"
    />
  </div>
</template>
