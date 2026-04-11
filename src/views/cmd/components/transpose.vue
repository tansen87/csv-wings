<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdTranspose, useMarkdown } from "@/utils/markdown";
import { useQuoting, useSkiprows } from "@/store/modules/options";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Transpose] ${msg}`, type);
};

const [path, mode] = [ref(""), ref("memory")];
const modeOptions = [
  { label: "Memory", value: "memory" },
  { label: "Multipass", value: "multipass" }
];
const [isLoading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdTranspose);
const quoting = useQuoting();
const skiprows = useSkiprows();

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    addLog('File selection canceled', 'info');
    return;
  }

  addLog(`Selected file: ${path.value}`, 'info');

  try {
    addLog('Loading file data...', 'info');
    tableHeader.value = await mapHeaders(path.value, skiprows.skiprows);
    const { columnView, dataView } = await toJson(
      path.value,
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
  } catch (e) {
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

// invoke transpose
async function transposeData() {
  if (path.value === "") {
    addLog("File not selected", 'warning');
    return;
  }

  try {
    isLoading.value = true;
    addLog('Starting transpose operation...', 'info');

    if (mode.value === 'memory') {
      addLog('Using memory mode: faster but uses more RAM for large files', 'info');
    } else {
      addLog('Using multipass mode: slower but memory-efficient for large files', 'info');
    }

    const rtime: string = await invoke("transpose", {
      path: path.value,
      mode: mode.value,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows
    });
    addLog(`Transpose done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Transpose operation failed: ${e}`, 'error');
  } finally {
    isLoading.value = false;
  }
}

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:loop-left-line" />
          Transpose
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400">
          Transpose rows/columns of a CSV
        </div>
        <div class="mode-toggle ml-auto">
          <span v-for="item in modeOptions" :key="item.value" class="mode-item mx-1 w-24"
            :class="{ active: mode === item.value }" @click="mode = item.value">
            {{ item.label }}
          </span>
        </div>
      </div>
    </SiliconeCard>

    <el-scrollbar class="flex-1 px-4 pb-4 min-h-0">
      <div class="flex flex-col gap-4">
        <SiliconeCard>
          <div class="flex justify-between items-center mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              FILE SELECTION
            </div>
            <div class="flex items-center">
              <SiliconeButton @click="selectFile()" size="small" text>
                <Icon icon="ri:folder-open-line" class="w-4 h-4" />
              </SiliconeButton>
              <SiliconeButton @click="transposeData()" :loading="isLoading" size="small" text>
                <Icon icon="ri:play-large-line" class="w-4 h-4" />
              </SiliconeButton>
            </div>
          </div>

          <div v-if="path" class="mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              SELECTED FILE
            </div>
            <div class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <SiliconeText :max-lines="1">{{ path }}</SiliconeText>
            </div>
          </div>

          <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <label class="text-xs font-semibold text-gray-400 tracking-wider block mb-2">
              BEFORE → AFTER
            </label>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div class="font-mono bg-white dark:bg-gray-600 px-2 py-1 rounded mb-1 text-center">
                  A B C
                </div>
                <div class="font-mono bg-white dark:bg-gray-600 px-2 py-1 rounded mb-1 text-center">
                  D E F
                </div>
              </div>
              <div>
                <div
                  class="font-mono bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-1 rounded mb-1 text-center">
                  A D
                </div>
                <div
                  class="font-mono bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-1 rounded mb-1 text-center">
                  B E
                </div>
                <div
                  class="font-mono bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-1 rounded text-center">
                  C F
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <label class="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-2">
              CONFIG
            </label>
            <div class="space-y-1 text-xs text-blue-700 dark:text-blue-300">
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Process mode:</span>
                <span class="font-mono">{{ mode }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Quoting:</span>
                <span class="font-mono">{{ quoting.quoting }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Skip rows:</span>
                <span class="font-mono">{{ skiprows.skiprows }}</span>
              </div>
            </div>
          </div>
        </SiliconeCard>

        <SiliconeCard>
          <div class="flex items-center justify-between mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              DATA PREVIEW
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded">
                <Icon icon="ri:cpu-line" class="w-3.5 h-3.5" />
                {{ mode }}
              </span>
            </div>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'400px'" show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2">
                  No data. Click
                  <Icon icon="ri:folder-open-line" class="w-4 h-4" />
                  to select file.
                </div>
              </template>
              <el-table-column v-for="column in tableColumn" :prop="column.prop" :label="column.label"
                :key="column.prop" />
            </SiliconeTable>
          </div>
        </SiliconeCard>

        <SiliconeCard>
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
            USAGE
          </div>
          <div class="flex flex-col gap-2">
            <SiliconeText type="info">1. Click
              <Icon icon="ri:folder-open-line" class="w-4 h-4 inline align-middle" /> to select a CSV file
            </SiliconeText>
            <SiliconeText type="info">2. Choose the process mode (Memory for speed, Multipass for memory efficiency)
            </SiliconeText>
            <SiliconeText type="info">3. Review the configuration details</SiliconeText>
            <SiliconeText type="info">4. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to start the transpose operation
            </SiliconeText>
            <SiliconeText type="info">5. Check the output log for details</SiliconeText>
            <SiliconeText type="info">6. The output file will be created in the same directory as the original file
            </SiliconeText>
            <SiliconeText type="info">7. Rows will become columns and columns will become rows</SiliconeText>
            <SiliconeText type="info">8. For large files, consider using Multipass mode to save memory</SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Transpose - Transpose rows/columns of a CSV" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
:deep(.silicone-card) {
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}
</style>
