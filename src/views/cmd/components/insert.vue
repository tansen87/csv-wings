<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdInsert, useMarkdown } from "@/utils/markdown";
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
  emit('add-log', `[Insert] ${msg}`, type);
};

const [loading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const [currentRows, totalRows] = [ref(0), ref(0)];
const [path, column, position, values] = [ref(""), ref(""), ref(""), ref("")];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdInsert);

const skiprows = useSkiprows();
const quoting = useQuoting();
const flexible = useFlexible();
const progress = useProgress();

listen("update-insert-rows", (event: Event<number>) => {
  currentRows.value = event.payload;
});
listen("total-insert-rows", (event: Event<number>) => {
  totalRows.value = event.payload;
});

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    column.value = "";
    addLog('File selection canceled', 'info');
    return;
  }

  totalRows.value = 0;
  addLog(`Selected file: ${path.value}`, 'info');

  try {
    tableHeader.value = await mapHeaders(path.value, skiprows.skiprows);
    const { columnView, dataView } = await toJson(
      path.value,
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
    addLog(`Loaded ${tableData.value.length} rows with ${tableColumn.value.length} columns`, 'success');
  } catch (e) {
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

// invoke insert
async function insertData() {
  if (path.value === "") {
    addLog("CSV file not selected", 'warning');
    return;
  }

  try {
    loading.value = true;
    addLog('Starting insert operation...', 'info');

    const rtime: string = await invoke("insert", {
      path: path.value,
      column: column.value,
      position: position.value,
      values: values.value,
      skiprows: skiprows.skiprows,
      quoting: quoting.quoting,
      flexible: flexible.flexible,
      progress: progress.progress
    });
    addLog(`Insert done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Insert operation failed: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  [path, column, position, values].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:insert-column-right" />
          Insert
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400">
          Insert columns through index
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
              <SiliconeButton @click="insertData()" :loading="loading" size="small" text>
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

          <div class="mb-4">
            <div class="grid grid-cols-3 gap-4">
              <div>
                <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
                  COLUMN
                </div>
                <SiliconeSelect v-model="column" filterable placeholder="Select column">
                  <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
                </SiliconeSelect>
              </div>

              <div>
                <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
                  POSITION
                </div>
                <SiliconeTooltip content="left = before, right = after, or use index number">
                  <SiliconeInput v-model="position" placeholder="left | right | 1 | 2..." />
                </SiliconeTooltip>
              </div>

              <div>
                <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
                  VALUES
                </div>
                <SiliconeTooltip content="Use | to separate multiple values">
                  <SiliconeInput v-model="values" placeholder="1 | | CNY..." />
                </SiliconeTooltip>
              </div>
            </div>
          </div>

          <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <label class="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-2">
              PREVIEW
            </label>
            <div class="space-y-1 text-xs text-blue-700 dark:text-blue-300">
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Column:</span>
                <span class="font-mono">{{ column || "-" }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Position:</span>
                <span class="font-mono">{{ position || "left" }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Values:</span>
                <span class="font-mono truncate max-w-[120px]">{{
                  values || "-"
                }}</span>
              </div>
            </div>
          </div>

          <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <label class="text-xs font-semibold text-gray-400 tracking-wider block mb-2">
              EXAMPLE
            </label>
            <div class="text-[10px] space-y-1">
              <div class="flex items-center gap-1">
                <span class="text-gray-500">Before:</span>
                <span class="font-mono bg-white dark:bg-gray-600 px-1 rounded">A | B | C</span>
              </div>
              <div class="flex items-center gap-1">
                <Icon icon="ri:arrow-down-line" class="w-3 h-3 text-gray-400" />
              </div>
              <div class="flex items-center gap-1">
                <span class="text-gray-500">After:</span>
                <span
                  class="font-mono bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1 rounded">A |
                  X | B | C</span>
              </div>
            </div>
          </div>

          <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <label class="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-2">
              CONFIG
            </label>
            <div class="space-y-1 text-xs text-blue-700 dark:text-blue-300">
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Skip rows:</span>
                <span class="font-mono">{{ skiprows.skiprows }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Quoting:</span>
                <span class="font-mono">{{ quoting.quoting }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Flexible:</span>
                <span class="font-mono">{{ flexible.flexible }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Progress:</span>
                <span class="font-mono">{{ progress.progress }}</span>
              </div>
            </div>
          </div>

          <div class="mt-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-3">
              STATISTICS
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
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

              <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
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
              DATA PREVIEW
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded">
                <Icon icon="ri:pin-distance-line" class="w-3.5 h-3.5" />
                {{ position || "left" }}
              </span>
            </div>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'400px'"
              show-overflow-tooltip class="select-text">
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
            <SiliconeText type="info">2. Select the target column to insert relative to</SiliconeText>
            <SiliconeText type="info">3. Specify the position (left, right, or index number)</SiliconeText>
            <SiliconeText type="info">4. Enter values to insert, separated by |</SiliconeText>
            <SiliconeText type="info">5. Review the configuration details</SiliconeText>
            <SiliconeText type="info">6. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to start the insert operation
            </SiliconeText>
            <SiliconeText type="info">7. Check the output log for details</SiliconeText>
            <SiliconeText type="info">8. The output file will be created in the same directory as the original file
            </SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Insert - Insert columns through index" width="70%">
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
