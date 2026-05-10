<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdSlice, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";
import { message } from "@/utils/message"
import "./common.css";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Slice] ${msg}`, type);
};

const mode = ref("lines");
const modeOptions = [
  { label: "Lines", value: "lines" },
  { label: "Index", value: "index" }
];
const [path, start, end] = [ref(""), ref("1"), ref("10")];
const [isLoading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdSlice);
const quoting = useQuoting();
const flexible = useFlexible();
const skiprows = useSkiprows();

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    return;
  }

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

async function sliceData() {
  if (path.value === "") {
    message("CSV file not selected", { type: 'warning' });
    return;
  }

  try {
    isLoading.value = true;
    addLog('Starting slice process...', 'info');
    const rtime: string = await invoke("slice", {
      path: path.value,
      quoting: quoting.quoting,
      flexible: flexible.flexible,
      start: start.value,
      end: end.value,
      skiprows: skiprows.skiprows,
      mode: mode.value
    });
    addLog(`Slice done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Slice failed: ${e}`, 'error');
  }
  isLoading.value = false;
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
          <Icon icon="ri:crop-line" />
        </div>
        <div class="cmd-header-text">
          <h1>Slice</h1>
          <p>Returns rows in the specified range</p>
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
              <SiliconeButton @click.stop="sliceData()" :loading="isLoading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="flex justify-center">
            <div class="mode-toggle py-1">
              <span v-for="item in modeOptions" :key="item.value" class="mode-item mx-0.5 w-24"
                :class="{ active: mode === item.value }" @click="mode = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <div class="cmd-options-grid mt-4">
            <div class="cmd-option-section">
              <div class="cmd-option-label">ROW RANGE</div>
              <div class="flex gap-4">
                <div class="flex-1">
                  <SiliconeInput v-model="start" placeholder="Start (e.g. 0)" class="w-full" />
                </div>
                <div class="flex-1">
                  <SiliconeInput v-model="end" placeholder="End (e.g. 100)" class="w-full" />
                </div>
              </div>
            </div>
          </div>

          <div class="cmd-stats-grid mt-4 mb-4">
            <div class="cmd-stat-card cmd-stat-card-blue">
              <div class="cmd-stat-value">{{ parseInt(end) - parseInt(start) || 0 }}</div>
              <div class="cmd-stat-label">Sliced Rows</div>
            </div>
            <div class="cmd-stat-card">
              <div class="cmd-stat-value">TODO</div>
              <div class="cmd-stat-label">Total Rows</div>
            </div>
          </div>

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
            <span class="cmd-mode-badge">Range: {{ start || 0 }} - {{ end || "end" }}</span>
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

    <SiliconeDialog v-model="dialog" title="Slice - Returns rows of a CSV file in the specified range" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>
