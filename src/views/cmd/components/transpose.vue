<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdTranspose, useMarkdown } from "@/utils/markdown";
import { useQuoting, useSkiprows } from "@/store/modules/options";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Transpose] ${msg}`, type);
};

const [path, mode] = [ref(""), ref("memory")];
const modeOptions = [
  { label: "Memory", value: "memory" },
  { label: "Multipass", value: "multipass" }
];
const [isLoading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdTranspose);
const quoting = useQuoting();
const skiprows = useSkiprows();

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    addLog('File selection canceled', 'info');
    return;
  }

  addLog(`Selected file: ${path.value}`, 'info');

  try {
    addLog('Loading file data...', 'info');
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

async function transposeData() {
  if (path.value === "") {
    addLog("File not selected", 'warning');
    return;
  }

  try {
    isLoading.value = true;
    addLog('Starting transpose operation...', 'info');

    if (mode.value === 'memory') {
      addLog('Using memory mode: faster but uses more RAM for large files', 'info');
    } else {
      addLog('Using multipass mode: slower but memory-efficient for large files', 'info');
    }

    const rtime: string = await invoke("transpose", {
      path: path.value,
      mode: mode.value,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows
    });
    addLog(`Transpose done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Transpose operation failed: ${e}`, 'error');
  } finally {
    isLoading.value = false;
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
      <div class="header-content">
        <div class="header-icon" @click="dialog = true">
          <Icon icon="ri:loop-left-line" />
        </div>
        <div class="header-text">
          <h1>Transpose</h1>
          <p>Transpose rows and columns of a CSV</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
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
            <SiliconeButton @click.stop="transposeData()" :loading="isLoading" size="small">
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

        <div class="preview-formula mt-4">
          <span class="formula-label">Preview:</span>
          <span class="formula-item">TRANSPOSE</span>
          <span class="formula-operator">ROWS</span>
          <span class="formula-item">{{ tableData?.length || 0 }}</span>
          <span class="formula-operator">↔</span>
          <span class="formula-item">COLS</span>
          <span class="formula-item">{{ tableColumn?.length || 0 }}</span>
        </div>

        <div class="transpose-demo mt-4 mb-4">
          <div class="demo-row">
            <div class="demo-label">BEFORE</div>
            <div class="demo-grid">
              <div class="demo-cell header">A</div>
              <div class="demo-cell header">B</div>
              <div class="demo-cell header">C</div>
              <div class="demo-cell">D</div>
              <div class="demo-cell">E</div>
              <div class="demo-cell">F</div>
            </div>
          </div>
          <div class="demo-arrow">
            <Icon icon="ri:arrow-right-line" />
          </div>
          <div class="demo-row">
            <div class="demo-label">AFTER</div>
            <div class="demo-grid transposed">
              <div class="demo-cell header">A</div>
              <div class="demo-cell header">D</div>
              <div class="demo-cell header">B</div>
              <div class="demo-cell header">E</div>
              <div class="demo-cell header">C</div>
              <div class="demo-cell header">F</div>
            </div>
          </div>
        </div>

        <div class="preview-header">
          <span class="preview-title">PREVIEW ({{ tableData?.length || 0 }} rows × {{ tableColumn?.length || 0 }}
            cols)</span>
          <span class="mode-badge">{{ mode }}</span>
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

    <SiliconeDialog v-model="dialog" title="Transpose - Transpose rows/columns of a CSV" width="70%">
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
  max-width: 200px;
}

.preview-formula {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(145deg, #fdf2f8, #fce7f3);
  border-radius: 8px;
  flex-wrap: wrap;
}

.dark .preview-formula {
  background: linear-gradient(145deg, #2e1f26, #271a20);
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
  color: #ec4899;
  font-weight: 600;
}

.dark .formula-item {
  background: #2a2a2a;
  color: #f472b6;
}

.formula-operator {
  color: #888;
  font-size: 12px;
}

.dark .formula-operator {
  color: #999;
}

.transpose-demo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 10px;
}

.dark .transpose-demo {
  background: var(--el-fill-color-dark, #2a2a2a);
}

.demo-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.demo-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.demo-grid.transposed {
  grid-template-columns: repeat(2, 1fr);
}

.demo-cell {
  font-family: ui-monospace, monospace;
  background: white;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  font-weight: 500;
  text-align: center;
  border: 1px solid #e8e8e8;
}

.dark .demo-cell {
  background: #3a3a3a;
  color: #aaa;
  border-color: #444;
}

.demo-cell.header {
  background: linear-gradient(135deg, #fdf2f8, #fce7f3);
  color: #ec4899;
  border-color: #f9a8d4;
}

.dark .demo-cell.header {
  background: linear-gradient(135deg, #2e1f26, #271a20);
  color: #f472b6;
  border-color: #9d174d;
}

.demo-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #888;
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
</style>