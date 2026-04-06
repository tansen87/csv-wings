<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdFill, useMarkdown } from "@/utils/markdown";
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
  emit('add-log', `[Date Format] ${msg}`, type);
};

const [currentRows, totalRows] = [ref(0), ref(0)];
const [loading, dialog] = [ref(false), ref(false)];
const columns = ref<string[]>([]);
const path = ref("");
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];

// 每列对应的日期格式(key: 列名, value: format 字符串)
const inputFormats = ref<Record<string, string>>({});
const outputFormats = ref<Record<string, string>>({});

// 日期格式选项
// 输入格式（含 Auto detect）
const dateFormats = [
  { label: "Auto detect", value: "" },
  // 无分隔符
  { label: "YYYYMMDD", value: "%Y%m%d" },
  { label: "YYYYMMDDHHMMSS", value: "%Y%m%d%H%M%S" },
  { label: "YYYYMMDDHHMM", value: "%Y%m%d%H%M" },
  { label: "DDMMYYYY", value: "%d%m%Y" },
  { label: "DDMMYYYYHHMMSS", value: "%d%m%Y%H%M%S" },
  { label: "MMDDYYYY", value: "%m%d%Y" },
  { label: "MMDDYYYYHHMMSS", value: "%m%d%Y%H%M%S" },

  // YMD (年-月-日)
  { label: "YYYY-MM-DD", value: "%Y-%m-%d" },
  { label: "YYYY/MM/DD", value: "%Y/%m/%d" },
  { label: "YYYY-MM-DD HH:mm:ss", value: "%Y-%m-%d %H:%M:%S" },
  { label: "YYYY/MM/DD HH:mm:ss", value: "%Y/%m/%d %H:%M:%S" },

  // YDM (年-日-月)
  { label: "YYYY-DD-MM", value: "%Y-%d-%m" },
  { label: "YYYY/DD/MM", value: "%Y/%d/%m" },
  { label: "YYYY-DD-MM HH:mm:ss", value: "%Y-%d-%m %H:%M:%S" },
  { label: "YYYY/DD/MM HH:mm:ss", value: "%Y/%d/%m %H:%M:%S" },

  // MDY (月-日-年)
  { label: "MM-DD-YYYY", value: "%m-%d-%Y" },
  { label: "MM/DD/YYYY", value: "%m/%d/%Y" },
  { label: "MM-DD-YYYY HH:mm:ss", value: "%m-%d-%Y %H:%M:%S" },
  { label: "MM/DD/YYYY HH:mm:ss", value: "%m/%d/%Y %H:%M:%S" },

  // MYD (月-年-日)
  { label: "MM-YYYY-DD", value: "%m-%Y-%d" },
  { label: "MM/YYYY/DD", value: "%m/%Y/%d" },
  { label: "MM-YYYY-DD HH:mm:ss", value: "%m-%Y-%d %H:%M:%S" },
  { label: "MM/YYYY/DD HH:mm:ss", value: "%m/%Y/%d %H:%M:%S" },

  // DMY (日-月-年)
  { label: "DD-MM-YYYY", value: "%d-%m-%Y" },
  { label: "DD/MM/YYYY", value: "%d/%m/%Y" },
  { label: "DD-MM-YYYY HH:mm:ss", value: "%d-%m-%Y %H:%M:%S" },
  { label: "DD/MM/YYYY HH:mm:ss", value: "%d/%m/%Y %H:%M:%S" },

  // DYM (日-年-月)
  { label: "DD-YYYY-MM", value: "%d-%Y-%m" },
  { label: "DD/YYYY/MM", value: "%d/%Y/%m" },
  { label: "DD-YYYY-MM HH:mm:ss", value: "%d-%Y-%m %H:%M:%S" },
  { label: "DD/YYYY/MM HH:mm:ss", value: "%d/%Y/%m %H:%M:%S" },

  // 其他带时间格式
  { label: "YYYY-MM-DD HH:mm:ss.SSS", value: "%Y-%m-%d %H:%M:%S%.f" },
  { label: "YYYY-MM-DDTHH:mm:ss", value: "%Y-%m-%dT%H:%M:%S" },
  { label: "YYYY-MM-DDTHH:mm:ss.SSS", value: "%Y-%m-%dT%H:%M:%S%.f" },
  { label: "YYYY-MM-DD HH:mm", value: "%Y-%m-%d %H:%M" },
  { label: "YYYY/MM/DD HH:mm", value: "%Y/%m/%d %H:%M" },

  // 中文格式
  { label: "YYYY年MM月DD日", value: "%Y年%m月%d日" },
  { label: "YYYY年MM月DD日 HH时MM分SS秒", value: "%Y年%m月%d日 %H时%M分%S秒" },
  { label: "YYYY年MM月DD日 HH:mm:ss", value: "%Y年%m月%d日 %H:%M:%S" },
  { label: "DD日MM月YYYY年", value: "%d日%m月%Y年" },
  { label: "DD日MM月YYYY年 HH时MM分SS秒", value: "%d日%m月%Y年 %H时%M分%S秒" },
  { label: "DD日MM月YYYY年 HH:mm:ss", value: "%d日%m月%Y年 %H:%M:%S" },
  { label: "MM月DD日YYYY年", value: "%m月%d日%Y年" },
  { label: "MM月DD日YYYY年 HH时MM分SS秒", value: "%m月%d日%Y年 %H时%M分%S秒" },
  { label: "MM月DD日YYYY年 HH:mm:ss", value: "%m月%d日%Y年 %H:%M:%S" },

  // 时间在前
  { label: "HH:mm:ss YYYY-MM-DD", value: "%H:%M:%S %Y-%m-%d" },
  { label: "HH:mm YYYY-MM-DD", value: "%H:%M %Y-%m-%d" }
];

// 输出格式
const outputDateFormats = dateFormats.filter(fmt => fmt.value !== "");

const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdFill);
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

watch(
  columns,
  newCols => {
    const newSet = new Set(newCols);

    for (const col of Object.keys(inputFormats.value)) {
      if (!newSet.has(col)) {
        delete inputFormats.value[col];
        delete outputFormats.value[col];
      }
    }

    for (const col of newCols) {
      if (!(col in inputFormats.value)) {
        inputFormats.value[col] = "";
      }
      if (!(col in outputFormats.value)) {
        outputFormats.value[col] = "%Y-%m-%d";
      }
    }
  },
  { immediate: true }
);

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (!path.value) {
    path.value = "";
    columns.value = [];
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
  } catch (e) {
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

async function convertDates() {
  if (!path.value) {
    addLog("File not selected", 'warning');
    return;
  }
  if (columns.value.length === 0) {
    addLog("No column selected", 'warning');
    return;
  }

  const columnConfigs: Record<
    string,
    { inputFormat?: string; outputFormat: string }
  > = {};

  for (const col of columns.value) {
    const input = inputFormats.value[col]?.trim() || "";
    const output = outputFormats.value[col]?.trim() || "%Y-%m-%d";

    columnConfigs[col] = {
      inputFormat: input === "" ? undefined : input,
      outputFormat: output
    };
  }

  try {
    loading.value = true;
    addLog('Starting date format conversion...', 'info');

    // Log column configurations
    for (const [col, config] of Object.entries(columnConfigs)) {
      addLog(`Column ${col}: Input format = ${config.inputFormat || 'Auto'}, Output format = ${config.outputFormat}`, 'info');
    }

    const rtime: string = await invoke("datefmt", {
      path: path.value,
      columnConfigs,
      flexible: flexible.flexible,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      progress: progress.progress
    });
    addLog(`Date conversion completed, time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Date conversion failed: ${e}`, 'error');
  } finally {
    loading.value = false;
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
          <Icon icon="ri:calendar-event-line" />
          Date Format
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400 tracking-wider">
          Convert date columns between formats
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
            <div class="ml-auto flex items-center">
              <SiliconeButton @click="selectFile()" size="small" text>
                <Icon icon="ri:folder-open-line" class="w-4 h-4" />
              </SiliconeButton>
              <SiliconeButton @click="convertDates()" :loading="loading" size="small" text>
                <Icon icon="ri:play-large-line" class="w-4 h-4" />
              </SiliconeButton>
            </div>
          </div>

          <div v-if="path"
            class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div class="flex items-center justify-between">
              <SiliconeText :max-lines="1" class="flex-1">{{ path }}</SiliconeText>
              <span class="text-xs text-gray-400">
                {{ tableData?.length || 0 }} rows
              </span>
            </div>
          </div>

          <div class="mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              DATE COLUMNS ({{ columns.length }})
            </div>
            <SiliconeSelect v-model="columns" multiple filterable placeholder="Select date columns" class="w-full">
              <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
            </SiliconeSelect>
          </div>

          <div class="mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              FORMAT SETTINGS
            </div>

            <div v-if="columns.length === 0" class="p-4 text-center">
              <Icon icon="ri:calendar-line" class="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p class="text-xs text-gray-400">No columns selected</p>
            </div>

            <div v-else class="space-y-3">
              <div v-for="col in columns" :key="col"
                class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div class="flex gap-2">
                  <div class="flex-1">
                    <span class="text-[10px] text-blue-500 font-medium block mb-1">
                      IN FORMAT
                    </span>
                    <SiliconeSelect v-model="inputFormats[col]" filterable placeholder="Auto" size="small"
                      class="w-full">
                      <el-option v-for="fmt in dateFormats" :key="fmt.value" :label="fmt.label" :value="fmt.value" />
                    </SiliconeSelect>
                  </div>

                  <div class="flex-1">
                    <span class="text-[10px] text-green-600 font-medium block mb-1">
                      OUT FORMAT
                    </span>
                    <SiliconeSelect v-model="outputFormats[col]" filterable placeholder="Select" size="small"
                      class="w-full">
                      <el-option v-for="fmt in outputDateFormats" :key="fmt.value" :label="fmt.label"
                        :value="fmt.value" />
                    </SiliconeSelect>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              PREVIEW
            </div>
            <div class="overflow-hidden rounded-lg">
              <SiliconeTable :data="tableData" :height="'300px'" empty-text="No data. Click folder icon to Open File."
                show-overflow-tooltip class="select-text">
                <el-table-column v-for="column in tableColumn" :prop="column.prop" :label="column.label"
                  :key="column.prop" />
              </SiliconeTable>
            </div>
          </div>

          <div v-if="totalRows > 0" class="grid grid-cols-2 gap-4">
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
        </SiliconeCard>

        <SiliconeCard>
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
            USAGE
          </div>
          <div class="flex flex-col gap-2">
            <SiliconeText type="info">1. Click
              <Icon icon="ri:folder-open-line" class="w-4 h-4 inline align-middle" /> to select a CSV file
            </SiliconeText>
            <SiliconeText type="info">2. Select the date columns you want to format</SiliconeText>
            <SiliconeText type="info">3. For each column, choose the input format (or Auto) and output format
            </SiliconeText>
            <SiliconeText type="info">4. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to start the conversion
            </SiliconeText>
            <SiliconeText type="info">5. Check the output log for details</SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Date Format Converter" width="70%">
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
