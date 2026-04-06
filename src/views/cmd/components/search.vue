<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { toJson, viewOpenFile, mapHeaders } from "@/utils/view";
import { mdSearch, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows,
  useThreads
} from "@/store/modules/options";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const mode = ref("equal");
const placeholderText = ref(
  "Search conditions, Separate by |.\nExample: tom|jack|jerry"
);
const [currentRows, totalRows, matchRows] = [ref(0), ref(0), ref(0)];
const [column, path, condition] = [ref(""), ref(""), ref("")];
const [dialog, loading] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(121);
const { mdShow } = useMarkdown(mdSearch);
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();
const threads = useThreads();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Search] ${msg}`, type);
};

listen("update-search-rows", (event: Event<number>) => {
  currentRows.value = event.payload;
});
listen("total-search-rows", (event: Event<number>) => {
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

// invoke search
async function searchData() {
  if (path.value === "") {
    addLog("CSV file not selected", 'warning');
    return;
  }
  if (column.value.length === 0 && mode.value !== "irregular_regex") {
    addLog("Column not selected", 'warning');
    return;
  }
  if (
    skiprows.skiprows > 0 &&
    threads.threads !== 1 &&
    mode.value !== "irregular_regex"
  ) {
    addLog("threads only support skiprows = 0", 'warning');
    return;
  }

  try {
    loading.value = true;
    addLog('Starting search process...', 'info');
    const res: string[] = await invoke("search", {
      path: path.value,
      column: column.value,
      mode: mode.value,
      condition: condition.value,
      progress: progress.progress,
      quoting: quoting.quoting,
      flexible: flexible.flexible,
      unique: unique.value,
      skiprows: skiprows.skiprows,
      threads: threads.threads
    });
    matchRows.value = Number(res[0]);
    addLog(`Match ${res[0]} rows, elapsed time: ${res[1]} s`, 'success');
  } catch (err) {
    addLog(`Search failed: ${err.toString()}`, 'error');
  }
  loading.value = false;
}

interface FilterModeOption {
  label: string;
  value: string;
  description?: string;
}
const filterModeOptions: FilterModeOption[] = [
  // 精确匹配
  { label: "equal", value: "equal" },
  { label: "equal_multi", value: "equal_multi" },
  { label: "not_equal", value: "not_equal" },
  // 包含匹配
  { label: "contains", value: "contains" },
  { label: "contains_multi", value: "contains_multi" },
  { label: "not_contains", value: "not_contains" },
  // 前缀匹配
  { label: "starts_with", value: "starts_with" },
  { label: "starts_with_multi", value: "starts_with_multi" },
  { label: "not_starts_with", value: "not_starts_with" },
  // 后缀匹配
  { label: "ends_with", value: "ends_with" },
  { label: "ends_with_multi", value: "ends_with_multi" },
  { label: "not_ends_with", value: "not_ends_with" },
  // 正则匹配
  { label: "regex", value: "regex" },
  { label: "irregular_regex", value: "irregular_regex" },
  // 空值判断
  { label: "is_null", value: "is_null" },
  { label: "is_not_null", value: "is_not_null" },
  // 数值比较
  { label: "gt(>)", value: "gt" },
  { label: "ge(≥)", value: "ge" },
  { label: "lt(<)", value: "lt" },
  { label: "le(≤)", value: "le" },
  { label: "between", value: "between" }
];

const unique = ref(false);
const uniqueOpts = [
  { label: "by column", value: true },
  { label: "by input", value: false }
];

const conditionsCollapsed = ref(false);
const statisticsCollapsed = ref(false);

onUnmounted(() => {
  [column, path, condition].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:filter-2-line" />
          Search
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400 tracking-wider">
          Filter rows matching conditions
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
              <SiliconeButton @click="searchData()" :loading="loading" size="small" text>
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
            <div class="flex items-center justify-between cursor-pointer mb-3"
              @click="conditionsCollapsed = !conditionsCollapsed">
              <div class="text-xs font-semibold text-gray-400 tracking-wider">
                CONDITIONS
              </div>
              <Icon :icon="conditionsCollapsed
                  ? 'ri:arrow-down-s-line'
                  : 'ri:arrow-up-s-line'
                " class="text-gray-400" />
            </div>

            <div v-show="!conditionsCollapsed" class="space-y-3">
              <div class="flex gap-4">
                <div class="flex-1 flex flex-col gap-1">
                  <label class="text-xs text-gray-500 dark:text-gray-400">
                    Column
                  </label>
                  <SiliconeSelect v-model="column" filterable placeholder="Select column">
                    <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
                  </SiliconeSelect>
                </div>

                <div class="flex-1 flex flex-col gap-1">
                  <label class="text-xs text-gray-500 dark:text-gray-400">
                    Mode
                  </label>
                  <SiliconeSelect v-model="mode" filterable>
                    <el-option v-for="option in filterModeOptions" :key="option.value" :label="option.label"
                      :value="option.value" />
                  </SiliconeSelect>
                </div>
              </div>

              <div class="flex flex-col gap-1" v-if="
                [
                  'equal_multi',
                  'contains_multi',
                  'starts_with_multi',
                  'ends_with_multi'
                ].includes(mode)
              ">
                <label class="text-xs text-gray-500 dark:text-gray-400">
                  Condition mode
                </label>
                <div class="mode-toggle w-full">
                  <span v-for="item in uniqueOpts" :key="String(item.value)" class="mode-item"
                    :class="{ active: unique === item.value }" @click="unique = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>

              <div class="flex flex-col gap-1" v-if="unique === false">
                <label class="text-xs text-gray-500 dark:text-gray-400">
                  Condition
                </label>
                <SiliconeInput v-model="condition" :autosize="{ minRows: 12, maxRows: 12 }" type="textarea"
                  :placeholder="placeholderText" class="w-full" />
              </div>
            </div>
          </div>

          <div class="mt-4">
            <div class="flex items-center justify-between cursor-pointer mb-3"
              @click="statisticsCollapsed = !statisticsCollapsed">
              <div class="text-xs font-semibold text-gray-400 tracking-wider">
                STATISTICS
              </div>
              <Icon :icon="statisticsCollapsed
                  ? 'ri:arrow-down-s-line'
                  : 'ri:arrow-up-s-line'
                " class="text-gray-400" />
            </div>

            <div v-show="!statisticsCollapsed" class="flex gap-4">
              <div
                class="flex-1 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-lg font-bold text-gray-800 dark:text-white">
                      {{ totalRows }}
                    </div>
                    <div class="text-[12px] text-gray-500 dark:text-gray-400">
                      Total
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
                      Scanned
                    </div>
                  </div>
                  <div class="relative w-6 h-6 flex items-center justify-center">
                    <Icon v-if="totalRows === 0 || !isFinite(currentRows / totalRows)" icon="ri:scan-line"
                      class="w-6 h-6 text-blue-500" />
                    <SiliconeProgress v-else :percentage="Math.round((currentRows / totalRows) * 100)" />
                  </div>
                </div>
              </div>

              <div
                class="flex-1 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-lg font-bold text-green-600 dark:text-green-400">
                      {{ matchRows }}
                    </div>
                    <div class="text-[12px] text-green-600 dark:text-green-400">
                      Matched
                    </div>
                  </div>
                  <Icon icon="ri:checkbox-circle-line" class="w-6 h-6 text-green-500" />
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
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'400px'"
              show-overflow-tooltip :cell-style="{
                borderBottom: '1px solid #f0f0f0'
              }">
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
            <SiliconeText type="info">2. Select a column from the dropdown list</SiliconeText>
            <SiliconeText type="info">3. Choose a search mode from the list</SiliconeText>
            <SiliconeText type="info">4. Enter search conditions in the textarea (separate multiple conditions with |)
            </SiliconeText>
            <SiliconeText type="info">5. For multi-value modes, select how to handle unique values</SiliconeText>
            <SiliconeText type="info">6. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to start the search process
            </SiliconeText>
            <SiliconeText type="info">7. Check the statistics section for search results</SiliconeText>
            <SiliconeText type="info">8. Check the output log for details</SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Search - Filter rows matching conditions" width="70%">
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
