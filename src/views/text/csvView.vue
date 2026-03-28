<!-- src/views/file/CsvView.vue -->
<script setup lang="ts">
import { ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpened, Guide, Position } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import { viewOpenFile } from "@/utils/view";
import GotoDialog from "@/views/text/gotoDialog.vue";
import { useShortcuts } from "@/utils/globalShortcut";
import { useFileView } from "@/store/modules/fileView";

const props = defineProps<{
  path: string | null;
}>();

const VISIBLE_LINE_COUNT = 200;

const loading = ref(false);
const tableHeader = ref<string[]>([]);
const tableData = ref<Record<string, string>[]>([]);
const tableRows = ref<number>(0);
const currentDataLine = ref(1); // 当前聚焦的数据行号(1-based)
const path_inner = ref("");
const showGotoDialog = ref(false);

async function openFile() {
  try {
    path_inner.value = await viewOpenFile(false, "csv", ["*"]);
    if (path_inner.value) {
      await loadRows(1);
    }
  } catch (e) {
    message(`failed to open file: ${e}`, { type: "error" });
  }
}

// 加载围绕某数据行的片段
async function loadRows(targetLine: number) {
  if (!path_inner.value) return;

  const start = Math.max(1, targetLine);
  const end = start + VISIBLE_LINE_COUNT - 1;

  loading.value = true;

  try {
    const jsonStr: string = await invoke("table_view", {
      path: path_inner.value,
      flexible: true,
      start,
      end
    });

    const jsonData = JSON.parse(jsonStr);
    tableHeader.value = jsonData.headers || [];
    tableData.value = jsonData.data || [];
    tableRows.value = jsonData.rows || 0;
    currentDataLine.value = targetLine;
  } catch (e) {
    message(`CSV load failed: ${e}`, { type: "error" });
    tableHeader.value = [];
    tableData.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleGotoLine(lineNumber: number) {
  const clamped = Math.max(1, lineNumber);
  await loadRows(clamped);
  message(`Jumped to data line ${clamped}`, { type: "success" });
}

// 初始加载
watch(
  () => props.path,
  async newPath => {
    if (newPath) {
      path_inner.value = newPath;
      await loadRows(1);
    } else {
      tableHeader.value = [];
      tableData.value = [];
    }
  },
  { immediate: true }
);

async function promptGoToLine() {
  showGotoDialog.value = !showGotoDialog.value;
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

function clearFile() {
  useFileView().closeFile();
}

useShortcuts({
  onOpenFile: () => openFile(),
  onJump: () => promptGoToLine()
});
</script>

<template>
  <div class="page-view">
    <SiliconeCard shadow="never" class="h-9">
      <div class="flex p-1">
        <SiliconeButton
          size="small"
          :icon="FolderOpened"
          @click="openFile"
          :loading="loading"
          text
        />
        <SiliconeButton
          size="small"
          :icon="Position"
          :loading="loading"
          @click="showGotoDialog = true"
          text
        />
        <div class="flex-grow" />
        <SiliconeButton
          size="small"
          :icon="Guide"
          :loading="loading"
          text
          @click="clearFile"
        />
      </div>
    </SiliconeCard>

    <SiliconeTable
      :data="tableData"
      border
      size="small"
      class="select-text"
      height="100%"
      v-loading="loading"
      element-loading-text="Creating index for csv"
      empty-text=""
    >
      <el-table-column
        v-for="header in tableHeader"
        :key="header"
        :prop="header"
        :label="header"
        show-overflow-tooltip
      />
    </SiliconeTable>

    <SiliconeCard v-if="path_inner" shadow="never" class="min-h-[25px]">
      <div class="flex items-center justify-between">
        <div class="truncate max-w-[80%]">
          <el-scrollbar>
            <SiliconeTag type="info">
              {{ path_inner }}
            </SiliconeTag>
          </el-scrollbar>
        </div>

        <div class="flex items-center">
          <SiliconeTag type="success">
            {{ formatNumber(tableRows) }} rows
          </SiliconeTag>
        </div>
      </div>
    </SiliconeCard>

    <GotoDialog
      v-model="showGotoDialog"
      :total-lines="tableRows"
      @go-to="handleGotoLine"
    />
  </div>
</template>

<style scoped>
:deep(.el-card__body) {
  padding: 0 !important;
}
</style>
