<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { viewOpenFile, toJson } from "@/utils/view";
import { mdSplit, useMarkdown } from "@/utils/markdown";
import { useSkiprows } from "@/store/modules/options";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Split] ${msg}`, type);
};

const [path, size, mode] = [ref(""), ref(1000000), ref("rows")];
const modeOptions = [
  { label: "Rows", value: "rows" },
  { label: "Lines", value: "lines" }
];
const [tableColumn, tableData] = [ref([]), ref([])];
const [loading, dialog] = [ref(false), ref(false)];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdSplit);
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

// invoke split
async function splitData() {
  if (path.value === "") {
    addLog("CSV file not selected", 'warning');
    return;
  }
  if (skiprows.skiprows !== 0) {
    addLog("split only support skiprows=0", 'warning');
    return;
  }

  try {
    loading.value = true;
    addLog('Starting split process...', 'info');
    const rtime: string = await invoke("split", {
      path: path.value,
      size: size.value,
      mode: mode.value
    });
    addLog(`Split done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Split failed: ${e}`, 'error');
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
          <Icon icon="ri:scissors-cut-line" />
          Split
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400">
          Split one CSV file into many CSV files
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
              <SiliconeButton @click="splitData()" :loading="loading" size="small" text>
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
              SPLIT SIZE
            </label>
            <SiliconeInputNumber v-model="size" :min="1" placeholder="Enter split size" style="width: 100%" />
            <p class="mt-1 text-[12px] text-gray-400">
              Each output file will contain this many rows
            </p>
          </div>

          <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div class="flex items-start gap-2">
              <Icon icon="ri:information-line" class="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div class="text-[12px] text-blue-700 dark:text-blue-300">
                <span v-if="mode === 'rows'">
                  Split by fixed number of rows per file
                </span>
                <span v-else-if="mode === 'lines'">
                  Split by lines, the delimiter can be ignored
                </span>
              </div>
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
                      TODO
                    </div>
                    <div class="text-[12px] text-blue-600 dark:text-blue-400">
                      Output Files
                    </div>
                  </div>
                  <Icon icon="ri:file-copy-line" class="w-6 h-6 text-blue-500" />
                </div>
              </div>

              <div
                class="flex-1 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-lg font-bold text-green-600 dark:text-green-400">
                      {{ size }}
                    </div>
                    <div class="text-[12px] text-green-600 dark:text-green-400">
                      Rows/File
                    </div>
                  </div>
                  <Icon icon="ri:table-line" class="w-6 h-6 text-green-500" />
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
                <Icon icon="ri:scissors-cut-line" class="w-3.5 h-3.5" />
                Mode: {{ mode }}
              </span>
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded">
                <Icon icon="ri:hashtag" class="w-3.5 h-3.5" />
                Size: {{ size }}
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
            <SiliconeText type="info">2. Select split mode (Rows or Lines)</SiliconeText>
            <SiliconeText type="info">3. Enter the split size (number of rows per file)</SiliconeText>
            <SiliconeText type="info">4. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to start the split process
            </SiliconeText>
            <SiliconeText type="info">5. Check the output log for details</SiliconeText>
            <SiliconeText type="info">6. The split files will be created in the same directory as the original file
            </SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Split - Split one CSV file into many CSV files" width="70%">
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
