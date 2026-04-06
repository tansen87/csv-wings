<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdSort, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Sort] ${msg}`, type);
};

const mode = ref("Sort");
const modeOptions = [
  { label: "Sort", value: "Sort" },
  { label: "ExtSort", value: "ExtSort" }
];
const numOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const reverseOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const [column, path] = [ref(""), ref("")];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const [loading, dialog, numeric, reverse] = [
  ref(false),
  ref(false),
  ref(false),
  ref(false)
];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdSort);
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
  addLog(`Selected file: ${path.value}`, 'info');

  try {
    tableHeader.value = await mapHeaders(path.value, skiprows.skiprows);
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

// invoke sort
async function sortData() {
  if (path.value === "") {
    addLog("CSV file not selected", 'warning');
    return;
  }
  if (column.value.length === 0 && mode.value !== "index") {
    addLog("Column not selected", 'warning');
    return;
  }

  try {
    loading.value = true;
    addLog(`Starting ${mode.value} process...`, 'info');

    let rtime: string;
    if (mode.value == "Sort") {
      rtime = await invoke("sort", {
        path: path.value,
        column: column.value,
        numeric: numeric.value,
        reverse: reverse.value,
        quoting: quoting.quoting,
        skiprows: skiprows.skiprows,
        flexible: flexible.flexible
      });
    } else if (mode.value == "ExtSort") {
      rtime = await invoke("extsort", {
        path: path.value,
        column: column.value,
        reverse: reverse.value,
        quoting: quoting.quoting
      });
    }
    addLog(`${mode.value} done, elapsed time: ${rtime} s`, 'success');
  } catch (err) {
    addLog(`${mode.value} failed: ${err.toString()}`, 'error');
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  [path, column].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:sort-asc" />
          Sort
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400">
          Sorts CSV data lexicographically
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
              <SiliconeButton @click="sortData()" :loading="loading" size="small" text>
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
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              SORT CONFIGURATION
            </div>
            <div class="space-y-4">
              <div>
                <label class="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">
                  SORT COLUMN
                </label>
                <SiliconeSelect v-model="column" filterable placeholder="Select column" class="w-full">
                  <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
                </SiliconeSelect>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">
                    NUMERIC SORT
                  </label>
                  <SiliconeTooltip content="When True, sort by numerical size">
                    <div class="mode-toggle">
                      <span v-for="item in numOptions" :key="String(item.value)" class="mode-item mx-1 w-24"
                        :class="{ active: numeric === item.value }" @click="numeric = item.value">
                        {{ item.label }}
                      </span>
                    </div>
                  </SiliconeTooltip>
                </div>

                <div>
                  <label class="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">
                    SORT ORDER
                  </label>
                  <SiliconeTooltip content="When True, sort from large to small">
                    <div class="mode-toggle">
                      <span v-for="item in reverseOptions" :key="String(item.value)" class="mode-item mx-1 w-24"
                        :class="{ active: reverse === item.value }" @click="reverse = item.value">
                        {{ item.label }}
                      </span>
                    </div>
                  </SiliconeTooltip>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <label class="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-2">
              SORT CONFIG
            </label>
            <div class="space-y-1 text-xs text-blue-700 dark:text-blue-300">
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Column:</span>
                <span class="font-mono">{{ column || "-" }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Mode:</span>
                <span class="font-mono">{{ mode }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Numeric:</span>
                <span class="font-mono">{{ numeric }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Order:</span>
                <span class="font-mono">{{ reverse ? "Desc ↓" : "Asc ↑" }}</span>
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
              <span v-if="column"
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded">
                <Icon icon="ri:table-line" class="w-3.5 h-3.5" />
                {{ column }}
              </span>
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded">
                <Icon :icon="reverse ? 'ri:sort-desc' : 'ri:sort-asc'" class="w-3.5 h-3.5" />
                {{ reverse ? "Descending" : "Ascending" }}
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
            <SiliconeText type="info">2. Select the column you want to sort by</SiliconeText>
            <SiliconeText type="info">3. Choose the sort mode (Sort or ExtSort)</SiliconeText>
            <SiliconeText type="info">4. Enable numeric sort if you want to sort by numerical value</SiliconeText>
            <SiliconeText type="info">5. Set the sort order (Ascending or Descending)</SiliconeText>
            <SiliconeText type="info">6. Review the sort configuration</SiliconeText>
            <SiliconeText type="info">7. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to start the sort process
            </SiliconeText>
            <SiliconeText type="info">8. Check the output log for details</SiliconeText>
            <SiliconeText type="info">9. The output file will be created in the same directory as the original file
            </SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Sort - Sorts CSV data lexicographically" width="70%">
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
