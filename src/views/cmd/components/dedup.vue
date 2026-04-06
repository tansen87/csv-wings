<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdDedup, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Dedup] ${msg}`, type);
};

const mode = ref("keep_first");
const modeOptions = [
  { label: "Keep First", value: "keep_first" },
  { label: "Keep Last", value: "keep_last" },
  { label: "Keep Duplicates", value: "keep_duplicates" },
  { label: "Unique", value: "unique" }
];
const sortedOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const [loading, dialog, sorted] = [ref(false), ref(false), ref(false)];
const [columns, path] = [ref<string[]>([]), ref("")];
const outputRows = ref(0);
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdDedup);
const quoting = useQuoting();
const skiprows = useSkiprows();
const flexible = useFlexible();

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    addLog('File selection cancelled', 'info');
    return;
  }

  try {
    addLog(`Selected file: ${path.value}`, 'info');
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

// Invoke dedup
async function runDedup() {
  if (path.value === "") {
    addLog("File not selected", 'warning');
    return;
  }

  try {
    loading.value = true;
    addLog(`Starting deduplication with mode: ${mode.value}`, 'info');
    addLog(`Selected columns: ${columns.value.length > 0 ? columns.value.join(', ') : 'All'}`, 'info');
    addLog('Running deduplication...', 'info');

    const result: string = await invoke("dedup", {
      path: path.value,
      columns: columns.value,
      mode: mode.value,
      skiprows: skiprows.skiprows,
      sorted: sorted.value,
      flexible: flexible.flexible,
      quoting: quoting.quoting
    });
    const json_res = JSON.parse(result);

    let msg: string;
    if (json_res.mode === "keep_duplicates") {
      msg = `Found ${json_res.output_rows} duplicate rows in ${json_res.elapsed_seconds.toFixed(1)}s`;
    } else {
      msg = `Kept ${json_res.output_rows} unique rows in ${json_res.elapsed_seconds.toFixed(1)}s`;
    }
    addLog(msg, 'success');
    outputRows.value = json_res.output_rows;
  } catch (e) {
    addLog(`deduplication failed: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  columns.value = [];
  path.value = "";
  tableHeader.value = [];
  tableColumn.value = [];
  tableData.value = [];
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:filter-line" />
          Dedup
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400 tracking-wider">
          Remove duplicate rows based on selected columns
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
              <SiliconeButton @click="runDedup()" :loading="loading" size="small" text>
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

          <div class="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
                DEDUP MODE
              </div>
              <div class="mode-toggle-v h-[60px]">
                <span v-for="item in modeOptions" :key="item.value" class="mode-item"
                  :class="{ active: mode === item.value }" @click="mode = item.value">
                  {{ item.label }}
                </span>
              </div>
            </div>
            <div>
              <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
                SORTED FILE
              </div>
              <div class="mode-toggle h-[30px] w-full">
                <span v-for="item in sortedOptions" :key="String(item.value)" class="mode-item"
                  :class="{ active: sorted === item.value }" @click="sorted = item.value">
                  {{ item.label }}
                </span>
              </div>
              <p class="mt-1 text-[10px] text-gray-400">
                Enable O(1) memory mode if file is sorted on selected columns
              </p>
            </div>
            <div>
              <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
                COLUMNS ({{ columns.length }})
              </div>
              <SiliconeSelect v-model="columns" multiple filterable placeholder="Select columns (empty = all)">
                <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
              <p class="mt-1 text-[10px] text-gray-400">
                Leave empty to deduplicate on all columns
              </p>
            </div>
          </div>

          <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div class="flex items-start gap-2">
              <Icon icon="ri:information-line" class="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div class="text-[12px] text-blue-700 dark:text-blue-300">
                <span v-if="mode === 'keep_first'">
                  Keep the first occurrence of each duplicate group.
                </span>
                <span v-else-if="mode === 'keep_last'">
                  Keep the last occurrence of each duplicate group.
                </span>
                <span v-else-if="mode === 'keep_duplicates'">
                  Output only the rows that are duplicates.
                </span>
                <span v-else-if="mode === 'unique'"> Get unique values </span>
              </div>
            </div>
          </div>

          <div v-if="outputRows > 0" class="mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              STATISTICS
            </div>
            <div class="p-3 rounded-lg border" :class="{
              'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800':
                mode !== 'keep_duplicates',
              'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800':
                mode === 'keep_duplicates'
            }">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-2xl font-bold" :class="{
                    'text-green-600 dark:text-green-400':
                      mode !== 'keep_duplicates',
                    'text-orange-600 dark:text-orange-400':
                      mode === 'keep_duplicates'
                  }">
                    {{ outputRows }}
                  </div>
                  <div class="text-xs" :class="{
                    'text-green-600 dark:text-green-400':
                      mode !== 'keep_duplicates',
                    'text-orange-600 dark:text-orange-400':
                      mode === 'keep_duplicates'
                  }">
                    {{ mode === "keep_duplicates" ? "Duplicate Rows" : "Unique Rows Kept" }}
                  </div>
                </div>
                <Icon icon="ri:file-list-line" class="w-6 h-6" :class="{
                  'text-green-500': mode !== 'keep_duplicates',
                  'text-orange-500': mode === 'keep_duplicates'
                }" />
              </div>
            </div>
          </div>
        </SiliconeCard>

        <SiliconeCard>
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
            PREVIEW
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'300px'"
              show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center gap-2">
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
            <SiliconeText type="info">2. Choose deduplication mode: Keep First, Keep Last, Keep Duplicates, or Unique
            </SiliconeText>
            <SiliconeText type="info">3. Select columns to deduplicate on (leave empty for all columns)</SiliconeText>
            <SiliconeText type="info">4. Set Sorted to True if the file is already sorted on selected columns
            </SiliconeText>
            <SiliconeText type="info">5. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to run deduplication
            </SiliconeText>
            <SiliconeText type="info">6. Check the output log for details</SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Dedup - Remove duplicate rows based on selected columns" width="70%">
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
