<script setup lang="ts">
import { onUnmounted, ref } from "vue";
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
import { message } from "@/utils/message"
import "./common.css";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Fill] ${msg}`, type);
};

const [fillChar, mode] = [ref("0"), ref("fill")];
const [currentRows, totalRows] = [ref(0), ref(0)];
const modeOptions = [
  { label: "fill", value: "fill" },
  { label: "f-fill", value: "ffill" }
];
const [loading, dialog] = [ref(false), ref(false)];
const [columns, path] = [ref(""), ref("")];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
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

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
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

async function fillData() {
  if (path.value === "") {
    message("File not selected", { type: 'warning' });
    return;
  }
  if (columns.value.length === 0) {
    message("Column not selected", { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog('Starting fill process...', 'info');
    const cols = Object.values(columns.value).join("|");
    const rtime: string = await invoke("fill", {
      path: path.value,
      columns: cols,
      values: fillChar.value,
      mode: mode.value,
      quoting: quoting.quoting,
      progress: progress.progress,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible
    });
    addLog(`Fill done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Fill failed: ${e}`, 'error');
  }
  loading.value = false;
}

onUnmounted(() => {
  [columns, path].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:rhythm-fill" />
        </div>
        <div class="cmd-header-text">
          <h1>Fill</h1>
          <p>Fill empty fields in selected columns</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="cmd-main">
        <div class="p-3">
          <div class="cmd-file-selection-bar mb-4" @click="selectFile()">
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
              <SiliconeButton @click.stop="fillData()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="flex justify-center">
            <div class="cmd-mode-toggle py-1">
              <span v-for="item in modeOptions" :key="item.value" class="cmd-mode-item mx-0.5 w-24"
                :class="{ active: mode === item.value }" @click="mode = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <div class="cmd-options-grid mt-4 mb-4">
            <div class="cmd-option-section">
              <div class="cmd-option-label">COLUMNS ({{ columns.length }})</div>
              <SiliconeSelect v-model="columns" multiple filterable placeholder="Select columns" class="w-full">
                <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>

            <div class="cmd-option-section" v-if="mode === 'fill'">
              <div class="cmd-option-label">FILL VALUE</div>
              <SiliconeInput v-model="fillChar" placeholder="Enter fill value" class="w-full" />
            </div>
          </div>

          <div class="cmd-stats-grid mt-4" v-if="totalRows > 0">
            <div class="cmd-stat-card">
              <div class="cmd-stat-label">Total Rows</div>
              <div class="cmd-stat-value">{{ totalRows }}</div>
            </div>
            <div class="cmd-stat-card cmd-stat-card-blue">
              <div class="cmd-stat-label">Progress</div>
              <SiliconeProgress v-if="totalRows > 0 && isFinite(currentRows / totalRows)"
                :percentage="Math.round((currentRows / totalRows) * 100)" class="mt-2" />
            </div>
          </div>

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
            <span class="cmd-mode-badge">Mode: {{ mode }}</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'350px'" show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  No data. Click above to select file.
                </div>
              </template>
              <el-table-column v-for="column in tableColumn" :prop="column.prop" :label="column.label"
                :key="column.prop" />
            </SiliconeTable>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Fill - Fill empty fields in selected columns of a CSV" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>
