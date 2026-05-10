<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdDedup, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";
import { message } from "@/utils/message";

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
    message("File not selected", { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(`Starting deduplication with mode: ${mode.value}`, 'info');
    addLog(`Selected columns: ${columns.value.length > 0 ? columns.value.join(', ') : 'All'}`, 'info');

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
    <div class="p-3">
      <div class="header-content">
        <div class="header-icon" @click="dialog = true">
          <Icon icon="ri:table-alt-fill" />
        </div>
        <div class="header-text">
          <h1>Dedup</h1>
          <p>Remove duplicate rows based on selected columns</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="dedup-main">
        <div class="p-3">
          <div class="file-selection-bar mb-4" @click="selectFile()">
            <div class="file-selection-icon">
              <Icon icon="ri:folder-open-line" />
            </div>
            <div class="file-selection-text">
              <template v-if="path">
                <span class="file-name">{{ path.split(/[/\\]/).pop() }}</span>
                <span class="file-path">{{ path }}</span>
              </template>
              <template v-else>
                <span class="file-prompt">Click to select a CSV file</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="runDedup()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="mode-toggle py-1">
            <span v-for="item in modeOptions" :key="item.value" class="mode-item mx-0.5"
              :class="{ active: mode === item.value }" @click="mode = item.value">
              {{ item.label }}
            </span>
          </div>

          <div class="options-grid mt-4">
            <div class="option-section">
              <div class="option-label">COLUMNS ({{ columns.length }})</div>
              <SiliconeSelect v-model="columns" multiple filterable placeholder="Select columns (empty = all)">
                <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>
            <div class="option-section">
              <div class="option-label">SORTED</div>
              <div class="mode-toggle-inline">
                <span v-for="item in sortedOptions" :key="String(item.value)" class="toggle-item"
                  :class="{ active: sorted === item.value }" @click="sorted = item.value">
                  {{ item.label }}
                </span>
              </div>
              <p class="option-hint">Enable O(1) memory mode if file is sorted</p>
            </div>
          </div>

          <div class="info-box mt-4">
            <Icon icon="ri:information-line" class="info-icon" />
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

          <div v-if="outputRows > 0" class="stats-box mt-4">
            <div class="stat-value" :class="mode === 'keep_duplicates' ? 'text-orange-500' : 'text-green-500'">
              {{ outputRows }}
            </div>
            <div class="stat-label">
              {{ mode === "keep_duplicates" ? "Duplicate Rows" : "Unique Rows Kept" }}
            </div>
          </div>

          <div class="mt-4">
            <div class="preview-header">
              <span class="preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
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
.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #409eff, #66b1ff);
  border-radius: 12px;
  font-size: 24px;
  color: white;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
  cursor: pointer;
}

.header-text h1 {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  margin: 0 0 4px 0;
}

.dark .header-text h1 {
  color: #e8e8e8;
}

.header-text p {
  font-size: 13px;
  color: #888;
  margin: 0;
}

.dark .header-text p {
  color: #999;
}

.dedup-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-selection-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(145deg, #f8f8f8, #f0f0f0);
  border: 2px dashed #ddd;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.file-selection-bar:hover {
  border-color: #409eff;
  background: linear-gradient(145deg, #f0f8ff, #e6f2ff);
}

.dark .file-selection-bar {
  background: linear-gradient(145deg, #2a2a2a, #222);
  border-color: #444;
}

.dark .file-selection-bar:hover {
  border-color: #409eff;
  background: linear-gradient(145deg, #1e2a3a, #1a2535);
}

.file-selection-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #e8e8e8, #d8d8d8);
  border-radius: 10px;
  font-size: 20px;
  color: #666;
  flex-shrink: 0;
}

.dark .file-selection-icon {
  background: linear-gradient(145deg, #3a3a3a, #2d2d2d);
  color: #777;
}

.file-selection-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  flex: 1;
}

.file-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.dark .file-name {
  color: #e0e0e0;
}

.file-path {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-prompt {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.dark .file-prompt {
  color: #aaa;
}

.mode-toggle {
  display: flex;
  justify-content: center;
  margin: 0 auto;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 12px;
  max-width: 480px;
}

.mode-item {
  text-align: center;
}

.mode-toggle-inline {
  display: flex;
  gap: 4px;
}

.toggle-item {
  flex: 1;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;
  background: var(--el-fill-color-light, #f5f7fa);
}

.toggle-item:hover {
  background-color: #e9e9e9;
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.15),
    0 2px 5px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.toggle-item.active {
  background-color: #d8d7d7;
  color: #000000;
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.2),
    0 2px 5px rgba(0, 0, 0, 0.2);
}

.dark .toggle-item {
  background: #3a3a3a;
  color: #c0c0c0;
}

.dark .toggle-item:hover {
  background-color: #4a4a4a;
}

.dark .toggle-item.active {
  background-color: #d8d7d7;
  color: #000000;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.option-section {
  display: flex;
  flex-direction: column;
}

.option-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.option-hint {
  font-size: 11px;
  color: #aaa;
  margin-top: 6px;
}

.info-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(145deg, #f0f8ff, #e6f2ff);
  border: 1px solid #b3d8fd;
  border-radius: 10px;
  font-size: 13px;
  color: #409eff;
}

.dark .info-box {
  background: linear-gradient(145deg, #1e2a3a, #1a2535);
  border-color: #2a4a6a;
  color: #66b1ff;
}

.stats-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background: linear-gradient(145deg, #f0fff4, #e6fff0);
  border: 1px solid #67c23a;
  border-radius: 10px;
}

.dark .stats-box {
  background: linear-gradient(145deg, #1a2a20, #152518);
  border-color: #2d4a2d;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #67c23a;
}

.stat-label {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: #666;
}

.dark .preview-title {
  color: #999;
}
</style>
