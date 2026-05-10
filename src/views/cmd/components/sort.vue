<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdSort, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";
import { message } from "@/utils/message";

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
  { label: "Asc", value: false },
  { label: "Desc", value: true }
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

async function sortData() {
  if (path.value === "") {
    message("CSV file not selected", { type: 'warning' });
    return;
  }
  if (column.value.length === 0 && mode.value !== "index") {
    message("Column not selected", { type: 'warning' });
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
    <div class="p-3">
      <div class="header-content">
        <div class="header-icon" @click="dialog = true">
          <Icon icon="ri:sort-alphabet-asc" />
        </div>
        <div class="header-text">
          <h1>Sort</h1>
          <p>Sort CSV data lexicographically</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="sort-main">
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
              <SiliconeButton @click.stop="sortData()" :loading="loading" size="small">
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
              <div class="option-label">SORT COLUMN</div>
              <SiliconeSelect v-model="column" filterable placeholder="Select column" class="w-full">
                <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>

            <div class="option-section">
              <div class="option-label">NUMERIC</div>
              <div class="mode-toggle py-1">
                <span v-for="item in numOptions" :key="String(item.value)" class="mode-item mx-0.5 w-32"
                  :class="{ active: numeric === item.value }" @click="numeric = item.value">
                  {{ item.label }}
                </span>
              </div>
            </div>

            <div class="option-section">
              <div class="option-label">ORDER</div>
              <div class="mode-toggle py-1">
                <span v-for="item in reverseOptions" :key="String(item.value)" class="mode-item mx-0.5 w-32"
                  :class="{ active: reverse === item.value }" @click="reverse = item.value">
                  {{ item.label }}
                </span>
              </div>
            </div>
          </div>

          <div class="preview-formula mt-4 mb-4">
            <span class="formula-label">Preview:</span>
            <span class="formula-item">{{ mode }}</span>
            <span class="formula-operator">BY</span>
            <span class="formula-item">{{ column || "column" }}</span>
            <span class="formula-operator">{{ numeric ? "(NUMERIC)" : "" }}</span>
            <span class="formula-operator">{{ reverse ? "DESC" : "ASC" }}</span>
          </div>

          <div class="preview-header">
            <span class="preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
            <span class="mode-badge">{{ mode }} | {{ column || "none" }} | {{ reverse ? "Desc" : "Asc" }}</span>
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

.sort-main {
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
  max-width: 240px;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

.preview-formula {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(145deg, #f0fdf4, #dcfce7);
  border-radius: 8px;
  flex-wrap: wrap;
}

.dark .preview-formula {
  background: linear-gradient(145deg, #14532d, #166534);
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
  color: #06b6d4;
  font-weight: 600;
}

.dark .formula-item {
  background: #2a2a2a;
  color: #22d3ee;
}

.formula-operator {
  color: #888;
  font-size: 12px;
}

.dark .formula-operator {
  color: #999;
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

.mode-badge {
  font-size: 12px;
  color: #666;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
}

.dark .mode-badge {
  color: #999;
  background: rgba(255, 255, 255, 0.05);
}

@media (max-width: 768px) {
  .options-grid {
    grid-template-columns: 1fr;
  }
}
</style>