<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { viewOpenFile, toJson } from "@/utils/view";
import { mdEnumer, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows
} from "@/store/modules/options";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Enumerate] ${msg}`, type);
};

const path = ref("");
const [currentRows, totalRows] = [ref(0), ref(0)];
const [dialog, loading] = [ref(false), ref(false)];
const [tableColumn, tableData] = [ref([]), ref([])];
const name = ref("row_number");
const [start, step] = [ref("0"), ref("1")];

const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdEnumer);
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();

listen("update-rows", (event: Event<number>) => {
  currentRows.value = event.payload;
});
listen("total-rows", (event: Event<number>) => {
  totalRows.value = event.payload;
});

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    addLog('File selection cancelled', 'info');
    return;
  }
  addLog(`Selected file: ${path.value}`, 'info');

  totalRows.value = 0;

  try {
    const { columnView, dataView } = await toJson(
      path.value,
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
    addLog(`Preview loaded: ${tableData.value.length} rows`, 'success');
  } catch (e) {
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

// invoke enumer
async function enumerate() {
  if (path.value === "") {
    addLog("File not selected", 'warning');
    return;
  }
  if (parseInt(start.value) < 0) {
    addLog("start must be greater than 0", 'warning');
    return;
  }
  if (parseInt(step.value) < 1) {
    addLog("step must be greater than 1", 'warning');
    return;
  }

  try {
    loading.value = true;
    addLog('Starting enumerate process...', 'info');
    const rtime: string = await invoke("enumer", {
      path: path.value,
      progress: progress.progress,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible,
      name: name.value,
      start: start.value,
      step: step.value
    });
    addLog(`Enumerate done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Enumerate failed: ${e}`, 'error');
  }
  loading.value = false;
}

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:sort-number-asc" />
          Enumerate
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400">
          Add a new column enumerating the lines of a CSV
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
              <SiliconeButton @click="enumerate()" :loading="loading" size="small" text>
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

          <div class="flex gap-4 mb-4">
            <div class="flex-1">
              <label class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block">
                COLUMN NAME
              </label>
              <SiliconeInput v-model="name" placeholder="column name" class="w-full" />
            </div>

            <div class="flex-1">
              <label class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block">
                START
              </label>
              <SiliconeInput v-model="start" placeholder="start" class="w-full" />
              <p class="mt-1 text-[10px] text-gray-400">
                The first row will have this value
              </p>
            </div>

            <div class="flex-1">
              <label class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block">
                STEP
              </label>
              <SiliconeInput v-model="step" placeholder="step" class="w-full" />
              <p class="mt-1 text-[10px] text-gray-400">
                Increment value for each row
              </p>
            </div>
          </div>

          <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <label class="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-2">
              PREVIEW
            </label>
            <div class="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 flex-wrap">
              <span class="font-mono bg-white dark:bg-gray-700 px-1 py-1 rounded">
                {{ name || "row_number" }}
              </span>
              <span>=</span>
              <span class="font-mono bg-white dark:bg-gray-700 px-1 py-1 rounded">
                {{ parseInt(start) || 0 }}
              </span>
              <span>,</span>
              <span class="font-mono bg-white dark:bg-gray-700 px-1 py-1 rounded">
                {{ (parseInt(start) || 0) + (parseInt(step) || 1) }}
              </span>
              <span>,</span>
              <span class="font-mono bg-white dark:bg-gray-700 px-1 py-1 rounded">
                {{ (parseInt(start) || 0) + 2 * (parseInt(step) || 1) }}
              </span>
            </div>
          </div>

          <div class="mt-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-3">
              STATISTICS
            </div>
            <div class="flex gap-4">
              <div
                class="flex-1 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-lg font-bold text-gray-800 dark:text-white">
                      {{ totalRows }}
                    </div>
                    <div class="text-[12px] text-gray-500 dark:text-gray-400">
                      Total Rows
                    </div>
                  </div>
                  <Icon icon="ri:database-line" class="w-6 h-6 text-gray-400" />
                </div>
              </div>

              <div
                class="flex-1 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {{ currentRows }}
                    </div>
                    <div class="text-[12px] text-blue-600 dark:text-blue-400">
                      Scanned Rows
                    </div>
                  </div>
                  <div class="relative w-6 h-6 flex items-center justify-center">
                    <Icon v-if="totalRows === 0 || !isFinite(currentRows / totalRows)" icon="ri:scan-line"
                      class="w-6 h-6 text-blue-500" />
                    <SiliconeProgress v-else :percentage="Math.round((currentRows / totalRows) * 100)" />
                  </div>
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
                <Icon icon="ri:sort-number-asc" class="w-3.5 h-3.5" />
                {{ name || "row_number" }}: {{ start || 0 }} + {{ step || 1 }}
              </span>
            </div>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'400px'" show-overflow-tooltip class="select-text">
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
            <SiliconeText type="info">2. Enter the column name for the enumeration</SiliconeText>
            <SiliconeText type="info">3. Set the starting value for the enumeration</SiliconeText>
            <SiliconeText type="info">4. Set the step value for incrementing each row</SiliconeText>
            <SiliconeText type="info">5. Review the preview to confirm the enumeration pattern</SiliconeText>
            <SiliconeText type="info">6. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to start the enumerate process
            </SiliconeText>
            <SiliconeText type="info">7. Check the output log for details</SiliconeText>
            <SiliconeText type="info">8. The output file will be created in the same directory as the original file
            </SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Enumerate - Add a new column enumerating the lines of a CSV" width="70%">
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
