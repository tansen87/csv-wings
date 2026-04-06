<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdSlice, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Slice] ${msg}`, type);
};

const mode = ref("lines");
const modeOptions = [
  { label: "Lines", value: "lines" },
  { label: "Index", value: "index" }
];
const [path, start, end] = [ref(""), ref("1"), ref("10")];
const [isLoading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdSlice);
const quoting = useQuoting();
const flexible = useFlexible();
const skiprows = useSkiprows();

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    addLog('File selection cancelled', 'info');
    return;
  }
  addLog(`Selected file: ${path.value}`, 'info');

  try {
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

// invoke slice
async function sliceData() {
  if (path.value === "") {
    addLog("CSV file not selected", 'warning');
    return;
  }

  try {
    isLoading.value = true;
    addLog('Starting slice process...', 'info');
    const rtime: string = await invoke("slice", {
      path: path.value,
      quoting: quoting.quoting,
      flexible: flexible.flexible,
      start: start.value,
      end: end.value,
      skiprows: skiprows.skiprows,
      mode: mode.value
    });
    addLog(`Slice done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Slice failed: ${e}`, 'error');
  }
  isLoading.value = false;
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
          <Icon icon="ri:crop-line" />
          Slice
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400">
          Returns rows of a CSV file in the specified range
        </div>
        <div class="mode-toggle ml-auto">
          <span v-for="item in modeOptions" :key="item.value" class="mode-item mx-1 w-24" :class="{ active: mode === item.value }"
            @click="mode = item.value">
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
              <SiliconeButton @click="sliceData()" :loading="isLoading" size="small" text>
                <Icon icon="ri:play-large-line" class="w-4 h-4" />
              </SiliconeButton>
            </div>
          </div>

          <div v-if="path" class="mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              SELECTED FILE
            </div>
            <SiliconeText :max-lines="1" class="mb-2">{{ path }}</SiliconeText>
          </div>

          <div class="mb-4">
            <label class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block">
              ROW RANGE
            </label>

            <div class="flex gap-4">
              <div class="flex-1">
                <div class="mb-1 text-sm text-gray-600 dark:text-gray-300">
                  Start
                </div>
                <SiliconeInput v-model="start" placeholder="Start (e.g. 0)" class="w-full" />
              </div>

              <div class="flex-1">
                <div class="mb-1 text-sm text-gray-600 dark:text-gray-300">
                  End
                </div>
                <SiliconeInput v-model="end" placeholder="End (e.g. 100)" class="w-full" />
              </div>
            </div>
          </div>

          <div v-if="start || end"
            class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div class="flex items-center gap-2">
              <Icon icon="ri:brackets-line" class="w-5 h-5 text-blue-500 flex-shrink-0" />
              <span class="text-xs text-blue-700 dark:text-blue-300">
                Range: <span class="font-mono">{{ start || 0 }}</span> to
                <span class="font-mono">{{ end || "end" }}</span>
              </span>
            </div>
          </div>

          <div class="mt-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-3">
              STATISTICS
            </div>
            <div class="flex gap-4">
              <div
                class="flex-1 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {{ parseInt(end) - parseInt(start) }}
                    </div>
                    <div class="text-[12px] text-blue-600 dark:text-blue-400">
                      Sliced Rows
                    </div>
                  </div>
                  <Icon icon="ri:crop-line" class="w-6 h-6 text-blue-500" />
                </div>
              </div>

              <div
                class="flex-1 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-lg font-bold text-gray-800 dark:text-white">
                      TODO
                    </div>
                    <div class="text-[12px] text-gray-500 dark:text-gray-400">
                      Total Rows
                    </div>
                  </div>
                  <Icon icon="ri:database-line" class="w-6 h-6 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </SiliconeCard>

        <SiliconeCard>
          <div class="flex items-center justify-between mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              PREVIEW
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded">
                <Icon icon="ri:crop-line" class="w-3.5 h-3.5" />
                {{ start || 0 }} - {{ end || "end" }}
              </span>
            </div>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'400px'"
              show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center gap-2">
                  No data. Click
                  <Icon icon="ri:folder-open-line" class="w-4 h-4" />
                  to select files.
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
            <SiliconeText type="info">2. Select slice mode (Lines or Index)</SiliconeText>
            <SiliconeText type="info">3. Enter the start and end range for slicing</SiliconeText>
            <SiliconeText type="info">4. Review the preview to confirm the data</SiliconeText>
            <SiliconeText type="info">5. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to start the slice process
            </SiliconeText>
            <SiliconeText type="info">6. Check the output log for details</SiliconeText>
            <SiliconeText type="info">7. The output file will be created in the same directory as the original file
            </SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Slice - Returns rows of a CSV file in the specified range" width="70%">
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
