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
import { message } from "@/utils/message";

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

const inputFormats = ref<Record<string, string>>({});
const outputFormats = ref<Record<string, string>>({});

const dateFormats = [
  { label: "Auto detect", value: "" },
  { label: "YYYYMMDD", value: "%Y%m%d" },
  { label: "YYYYMMDDHHMMSS", value: "%Y%m%d%H%M%S" },
  { label: "YYYYMMDDHHMM", value: "%Y%m%d%H%M" },
  { label: "DDMMYYYY", value: "%d%m%Y" },
  { label: "DDMMYYYYHHMMSS", value: "%d%m%Y%H%M%S" },
  { label: "MMDDYYYY", value: "%m%d%Y" },
  { label: "MMDDYYYYHHMMSS", value: "%m%d%Y%H%M%S" },
  { label: "YYYY-MM-DD", value: "%Y-%m-%d" },
  { label: "YYYY/MM/DD", value: "%Y/%m/%d" },
  { label: "YYYY-MM-DD HH:mm:ss", value: "%Y-%m-%d %H:%M:%S" },
  { label: "YYYY/MM/DD HH:mm:ss", value: "%Y/%m/%d %H:%M:%S" },
  { label: "YYYY-DD-MM", value: "%Y-%d-%m" },
  { label: "YYYY/DD/MM", value: "%Y/%d/%m" },
  { label: "YYYY-DD-MM HH:mm:ss", value: "%Y-%d-%m %H:%M:%S" },
  { label: "YYYY/DD/MM HH:mm:ss", value: "%Y/%d/%m %H:%M:%S" },
  { label: "MM-DD-YYYY", value: "%m-%d-%Y" },
  { label: "MM/DD/YYYY", value: "%m/%d/%Y" },
  { label: "MM-DD-YYYY HH:mm:ss", value: "%m-%d-%Y %H:%M:%S" },
  { label: "MM/DD/YYYY HH:mm:ss", value: "%m/%d/%Y %H:%M:%S" },
  { label: "MM-YYYY-DD", value: "%m-%Y-%d" },
  { label: "MM/YYYY/DD", value: "%m/%Y/%d" },
  { label: "MM-YYYY-DD HH:mm:ss", value: "%m-%Y-%d %H:%M:%S" },
  { label: "MM/YYYY/DD HH:mm:ss", value: "%m/%Y/%d %H:%M:%S" },
  { label: "DD-MM-YYYY", value: "%d-%m-%Y" },
  { label: "DD/MM/YYYY", value: "%d/%m/%Y" },
  { label: "DD-MM-YYYY HH:mm:ss", value: "%d-%m-%Y %H:%M:%S" },
  { label: "DD/MM/YYYY HH:mm:ss", value: "%d/%m/%Y %H:%M:%S" },
  { label: "DD-YYYY-MM", value: "%d-%Y-%m" },
  { label: "DD/YYYY/MM", value: "%d/%Y/%m" },
  { label: "DD-YYYY-MM HH:mm:ss", value: "%d-%Y-%m %H:%M:%S" },
  { label: "DD/YYYY/MM HH:mm:ss", value: "%d/%Y/%m %H:%M:%S" },
  { label: "YYYY-MM-DD HH:mm:ss.SSS", value: "%Y-%m-%d %H:%M:%S%.f" },
  { label: "YYYY-MM-DDTHH:mm:ss", value: "%Y-%m-%dT%H:%M:%S" },
  { label: "YYYY-MM-DDTHH:mm:ss.SSS", value: "%Y-%m-%dT%H:%M:%S%.f" },
  { label: "YYYY-MM-DD HH:mm", value: "%Y-%m-%d %H:%M" },
  { label: "YYYY/MM/DD HH:mm", value: "%Y/%m/%d %H:%M" },
  { label: "YYYY年MM月DD日", value: "%Y年%m月%d日" },
  { label: "YYYY年MM月DD日 HH时MM分SS秒", value: "%Y年%m月%d日 %H时%M分%S秒" },
  { label: "YYYY年MM月DD日 HH:mm:ss", value: "%Y年%m月%d日 %H:%M:%S" },
  { label: "DD日MM月YYYY年", value: "%d日%m月%Y年" },
  { label: "DD日MM月YYYY年 HH时MM分SS秒", value: "%d日%m月%Y年 %H时%M分%S秒" },
  { label: "DD日MM月YYYY年 HH:mm:ss", value: "%d日%m月%Y年 %H:%M:%S" },
  { label: "MM月DD日YYYY年", value: "%m月%d日%Y年" },
  { label: "MM月DD日YYYY年 HH时MM分SS秒", value: "%m月%d日%Y年 %H时%M分%S秒" },
  { label: "MM月DD日YYYY年 HH:mm:ss", value: "%m月%d日%Y年 %H:%M:%S" },
  { label: "HH:mm:ss YYYY-MM-DD", value: "%H:%M:%S %Y-%m-%d" },
  { label: "HH:mm YYYY-MM-DD", value: "%H:%M %Y-%m-%d" }
];

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
    return;
  }

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

async function convertDates() {
  if (!path.value) {
    message("File not selected", { type: 'warning' });
    return;
  }
  if (columns.value.length === 0) {
    message("No column selected", { type: 'warning' });
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
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:calendar-event-line" />
        </div>
        <div class="cmd-header-text">
          <h1>Date Format</h1>
          <p>Convert date columns between formats</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="p-3">
        <div class="cmd-file-selection-bar" @click="selectFile()">
          <div class="cmd-file-selection-icon">
            <Icon icon="ri:folder-open-line" />
          </div>
          <div class="cmd-file-selection-text">
            <template v-if="path">
              <span class="cmd-file-name">{{ path.split(/[/\\]/).pop() }}</span>
              <span class="cmd-file-path">{{ path }}</span>
            </template>
            <template v-else>
              <span class="cmd-file-prompt">Click to select a CSV file</span>
            </template>
          </div>
          <div class="flex items-center gap-2 ml-auto">
            <SiliconeButton @click.stop="convertDates()" :loading="loading" size="small">
              Run
            </SiliconeButton>
          </div>
        </div>

        <div class="options-grid mt-4">
          <div class="option-section full-width">
            <div class="option-label">DATE COLUMNS ({{ columns.length }})</div>
            <SiliconeSelect v-model="columns" multiple filterable placeholder="Select date columns" class="w-full">
              <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
            </SiliconeSelect>
          </div>
        </div>

        <div v-if="columns.length > 0" class="format-cards mt-4">
          <div v-for="col in columns" :key="col" class="format-card">
            <div class="format-card-header">
              <Icon icon="ri:calendar-line" class="format-icon" />
              <span class="format-col-name">{{ col }}</span>
            </div>
            <div class="format-card-body">
              <div class="format-section">
                <span class="format-label">IN</span>
                <SiliconeSelect v-model="inputFormats[col]" filterable placeholder="Auto" size="small" class="w-full">
                  <el-option v-for="fmt in dateFormats" :key="fmt.value" :label="fmt.label" :value="fmt.value" />
                </SiliconeSelect>
              </div>
              <div class="format-arrow">
                <Icon icon="ri:arrow-right-line" />
              </div>
              <div class="format-section">
                <span class="format-label">OUT</span>
                <SiliconeSelect v-model="outputFormats[col]" filterable placeholder="Select" size="small"
                  class="w-full">
                  <el-option v-for="fmt in outputDateFormats" :key="fmt.value" :label="fmt.label" :value="fmt.value" />
                </SiliconeSelect>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="format-empty mt-4">
          <Icon icon="ri:calendar-line" class="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p class="text-xs text-gray-400">Select date columns above to configure formats</p>
        </div>

        <div class="preview-formula mt-4">
          <span class="formula-label">Preview:</span>
          <span class="formula-item">DATEFMT</span>
          <span class="formula-operator">@</span>
          <span class="formula-item">{{ columns.length }}</span>
          <span class="formula-operator">cols</span>
        </div>

        <div class="stats-grid mt-4 mb-4">
          <div class="stats-card">
            <div class="stats-icon">
              <Icon icon="ri:database-line" />
            </div>
            <div class="stats-info">
              <span class="stats-label">Total Rows</span>
              <span class="stats-value">{{ totalRows }}</span>
            </div>
          </div>
          <div class="stats-card blue">
            <div class="stats-icon">
              <Icon icon="ri:scan-line" />
            </div>
            <div class="stats-info">
              <span class="stats-label">Progress</span>
            </div>
          </div>
        </div>

        <div class="cmd-preview-header">
          <span class="cmd-preview-title">PREVIEW ({{ tableData?.length || 0 }} rows x {{ tableColumn?.length || 0 }}
            cols)</span>
        </div>
        <div class="overflow-hidden rounded-lg">
          <SiliconeTable :data="tableData" :height="'350px'" show-overflow-tooltip class="select-text">
            <template #empty>
              <div class="flex items-center justify-center gap-2 text-gray-500">
                No data. Click above to select file.
              </div>
            </template>
            <el-table-column v-for="col in tableColumn" :prop="col.prop" :label="col.label" :key="col.prop" />
          </SiliconeTable>
        </div>
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
.options-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 16px;
}

.option-section {
  display: flex;
  flex-direction: column;
}

.option-section.full-width {
  grid-column: 1 / -1;
}

.option-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.format-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.format-card {
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 10px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
}

.dark .format-card {
  background: var(--el-fill-color-dark, #2a2a2a);
  border-color: #3a3a3a;
}

.format-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.format-icon {
  font-size: 16px;
  color: #6366f1;
}

.dark .format-icon {
  color: #818cf8;
}

.format-col-name {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.dark .format-col-name {
  color: #e0e0e0;
}

.format-card-body {
  display: flex;
  align-items: center;
  gap: 8px;
}

.format-section {
  flex: 1;
}

.format-label {
  font-size: 10px;
  font-weight: 600;
  color: #888;
  display: block;
  margin-bottom: 4px;
}

.format-arrow {
  font-size: 16px;
  color: #6366f1;
  flex-shrink: 0;
}

.format-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 10px;
}

.dark .format-empty {
  background: var(--el-fill-color-dark, #2a2a2a);
}

.preview-formula {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(145deg, #eef2ff, #e0e7ff);
  border-radius: 8px;
  flex-wrap: wrap;
}

.dark .preview-formula {
  background: linear-gradient(145deg, #1e1b4b, #1a1a35);
}

.formula-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.formula-item {
  font-family: ui-monospace, monospace;
  background: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: #6366f1;
  font-weight: 600;
}

.dark .formula-item {
  background: #2a2a2a;
  color: #818cf8;
}

.formula-operator {
  color: #888;
  font-size: 12px;
}

.dark .formula-operator {
  color: #999;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stats-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: linear-gradient(145deg, #f8f8f8, #f0f0f0);
  border-radius: 10px;
  border: 1px solid #e8e8e8;
}

.dark .stats-card {
  background: linear-gradient(145deg, #2a2a2a, #222);
  border-color: #3a3a3a;
}

.stats-card.blue {
  background: linear-gradient(145deg, #f0f9ff, #e0f2fe);
  border-color: #bae6fd;
}

.dark .stats-card.blue {
  background: linear-gradient(145deg, #1e3a5f, #172554);
  border-color: #1e40af;
}

.stats-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 8px;
  font-size: 18px;
  color: #666;
}

.dark .stats-icon {
  background: #3a3a3a;
  color: #999;
}

.stats-card.blue .stats-icon {
  color: #0ea5e9;
}

.dark .stats-card.blue .stats-icon {
  color: #38bdf8;
}

.stats-info {
  display: flex;
  flex-direction: column;
}

.stats-value {
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

.dark .stats-value {
  color: #e8e8e8;
}

.stats-label {
  font-size: 12px;
  color: #888;
}

@media (max-width: 768px) {
  .options-grid {
    grid-template-columns: 1fr;
  }
}
</style>