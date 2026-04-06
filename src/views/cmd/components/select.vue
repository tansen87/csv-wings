<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { CheckboxValueType } from "element-plus";
import { Icon } from "@iconify/vue";
import { viewOpenFile, mapHeaders, toJson } from "@/utils/view";
import { useDynamicHeight } from "@/utils/utils";
import { mdSelect, useMarkdown } from "@/utils/markdown";
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
  emit('add-log', `[Select] ${msg}`, type);
};

const path = ref("");
const [currentRows, totalRows] = [ref(0), ref(0)];
const selMode = ref("include");
const selModeOptions = [
  { label: "Include", value: "include" },
  { label: "Exclude", value: "exclude" }
];
const [originalColumns, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const [isLoading, dialog, checkAll, indeterminate] = [
  ref(false),
  ref(false),
  ref(false),
  ref(false)
];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdSelect);
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();
const selColumns = ref<CheckboxValueType[]>([]);

watch(selColumns, val => {
  if (val.length === 0) {
    checkAll.value = false;
    indeterminate.value = false;
  } else if (val.length === originalColumns.value.length) {
    checkAll.value = true;
    indeterminate.value = false;
  } else {
    indeterminate.value = true;
  }
});

const handleCheckAll = (val: CheckboxValueType) => {
  indeterminate.value = false;
  if (val) {
    selColumns.value = originalColumns.value.map(_ => _.value);
  } else {
    selColumns.value = [];
  }
};

listen("update-rows", (event: Event<number>) => {
  currentRows.value = event.payload;
});
listen("total-rows", (event: Event<number>) => {
  totalRows.value = event.payload;
});

async function selectFile() {
  originalColumns.value = [];
  totalRows.value = 0;
  selColumns.value = [];

  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    addLog('File selection cancelled', 'info');
    return;
  }

  try {
    addLog(`Selected file: ${path.value}`, 'info');
    originalColumns.value = await mapHeaders(path.value, skiprows.skiprows);
    selColumns.value = originalColumns.value.map(col => col.value);
    const { dataView } = await toJson(path.value, skiprows.skiprows);
    tableData.value = dataView;
  } catch (e) {
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

// invoke select
async function selectColumns() {
  if (path.value === "") {
    addLog("CSV file not selected", 'warning');
    return;
  }
  if (selColumns.value.length === 0) {
    addLog("Column not selected", 'warning');
    return;
  }

  try {
    isLoading.value = true;
    const selectedCount = selColumns.value.length;
    const totalCount = originalColumns.value.length;
    addLog(`Starting select operation: ${selMode.value} ${selectedCount} of ${totalCount} columns`, 'info');

    const selCols = Object.values(selColumns.value).join("|");
    const rtime: string = await invoke("select", {
      path: path.value,
      selCols: selCols,
      selMode: selMode.value,
      progress: progress.progress,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible
    });
    addLog(`Select done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Select failed: ${e}`, 'error');
  }
  isLoading.value = false;
}

const displayedColumns = computed(() => {
  if (selMode.value === "include") {
    // 按selColumns的顺序,从originalColumns中找对应项
    const colMap = new Map(originalColumns.value.map(col => [col.value, col]));
    return selColumns.value.map(val => colMap.get(val)).filter(Boolean);
  } else {
    // exclude:保留未被选中的列,保持原始顺序
    const excludedSet = new Set(selColumns.value);
    return originalColumns.value.filter(col => !excludedSet.has(col.value));
  }
});

const displayedTableData = computed(() => {
  const cols = displayedColumns.value;
  if (cols.length === 0) return [];

  const props = cols.map(col => col.value);
  return tableData.value.map(row => {
    const newRow: Record<string, any> = {};
    for (const prop of props) {
      newRow[prop] = row[prop];
    }
    return newRow;
  });
});

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [originalColumns, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:check-double-line" />
          Select
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400 tracking-wider">
          Select drop re-order columns
        </div>
        <div class="mode-toggle ml-auto">
          <span v-for="item in selModeOptions" :key="item.value" class="mode-item mx-1 w-24"
            :class="{ active: selMode === item.value }" @click="selMode = item.value">
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
              <SiliconeButton @click="selectColumns()" :loading="isLoading" size="small" text>
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

          <div>
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              COLUMNS ({{ selColumns.length }} / {{ originalColumns.length }})
            </div>
            <SiliconeSelect v-model="selColumns" multiple filterable placeholder="Select columns" class="w-full">
              <template #header>
                <div class="flex items-center justify-between px-2 py-1">
                  <el-checkbox v-model="checkAll" :indeterminate="indeterminate" @change="handleCheckAll"
                    class="text-xs">
                    All
                  </el-checkbox>
                  <span class="text-xs text-gray-400">
                    {{ selColumns.length }} selected
                  </span>
                </div>
              </template>
              <el-option v-for="item in originalColumns" :key="item.value" :label="item.label" :value="item.value" />
            </SiliconeSelect>
          </div>

          <div class="grid grid-cols-2 gap-2 mt-4" v-if="totalRows > 0">
            <div class="h-full">
              <div
                class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 h-full">
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
            </div>
            <div class="h-full">
              <div
                class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 h-full">
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
              PREVIEW ({{ tableData?.length || 0 }} rows)
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded">
                <Icon icon="ri:check-double-line" class="w-3.5 h-3.5" />
                <span class="font-medium text-gray-600 dark:text-gray-300">
                  Mode: {{ selMode }}
                </span>
              </span>
            </div>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="displayedTableData" :height="'400px'"
              show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center gap-2">
                  No data. Click
                  <Icon icon="ri:folder-open-line" class="w-4 h-4" />
                  to select files.
                </div>
              </template>
              <el-table-column v-for="column in displayedColumns" :key="column.value" :prop="column.value"
                :label="column.label" />
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
            <SiliconeText type="info">2. Choose selection mode: Include or Exclude</SiliconeText>
            <SiliconeText type="info">3. Select the columns you want to include or exclude</SiliconeText>
            <SiliconeText type="info">4. Preview the result in the table below</SiliconeText>
            <SiliconeText type="info">5. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to run the select operation
            </SiliconeText>
            <SiliconeText type="info">6. Check the output log for details</SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Select - Select, drop, re-order columns" width="70%">
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
