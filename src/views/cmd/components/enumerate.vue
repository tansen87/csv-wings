<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { viewOpenFile, toJson } from "@/utils/view";
import { mdEnumer, useMarkdown } from "@/utils/markdown";
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
  emit('add-log', `[Enumerate] ${msg}`, type);
};

const path = ref("");
const [currentRows, totalRows] = [ref(0), ref(0)];
const [dialog, loading] = [ref(false), ref(false)];
const [tableColumn, tableData] = [ref([]), ref([])];
const name = ref("row_number");
const [start, step] = [ref("0"), ref("1")];

const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdEnumer);
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

async function enumerate() {
  if (path.value === "") {
    message("File not selected", { type: 'warning' });
    return;
  }
  if (parseInt(start.value) < 0) {
    message("start must be greater than 0", { type: 'warning' });
    return;
  }
  if (parseInt(step.value) < 1) {
    message("step must be greater than 1", { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog('Starting enumerate process...', 'info');
    const rtime: string = await invoke("enumer", {
      path: path.value,
      progress: progress.progress,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible,
      name: name.value,
      start: start.value,
      step: step.value
    });
    addLog(`Enumerate done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Enumerate failed: ${e}`, 'error');
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
    <div class="p-3">
      <div class="header-content">
        <div class="header-icon" @click="dialog = true">
          <Icon icon="ri:sort-number-asc" />
        </div>
        <div class="header-text">
          <h1>Enumerate</h1>
          <p>Add a column enumerating the lines</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="enumerate-main">
        <div class="p-3">
          <div class="file-selection-bar" @click="selectFile()">
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
              <SiliconeButton @click.stop="enumerate()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="options-grid mt-4">
            <div class="option-section">
              <div class="option-label">COLUMN NAME</div>
              <SiliconeInput v-model="name" placeholder="column name" class="w-full" />
            </div>

            <div class="option-section">
              <div class="option-label">START & STEP</div>
              <div class="flex gap-4">
                <div class="flex-1">
                  <SiliconeInput v-model="start" placeholder="start" class="w-full" />
                </div>
                <div class="flex-1">
                  <SiliconeInput v-model="step" placeholder="step" class="w-full" />
                </div>
              </div>
            </div>

            <div class="preview-formula">
              <span class="formula-label">Preview:</span>
              <span class="formula-item">{{ name || "row_number" }}</span>
              <span class="formula-operator">=</span>
              <span class="formula-item">{{ parseInt(start) || 0 }}</span>
              <span class="formula-operator">,</span>
              <span class="formula-item">{{ (parseInt(start) || 0) + (parseInt(step) || 1) }}</span>
              <span class="formula-operator">,</span>
              <span class="formula-item">{{ (parseInt(start) || 0) + 2 * (parseInt(step) || 1) }}</span>
              <span class="formula-operator">...</span>
            </div>
          </div>

          <div class="stats-grid mt-4 mb-4">
            <div class="stat-card">
              <div class="stat-label">Total Rows</div>
              <div class="stat-value">{{ totalRows }}</div>
            </div>
            <div class="stat-card stat-blue">
              <div class="stat-label">Progress</div>
              <SiliconeProgress v-if="totalRows > 0 && isFinite(currentRows / totalRows)"
                :percentage="Math.round((currentRows / totalRows) * 100)" class="mt-2" />
            </div>
          </div>

          <div class="preview-header">
            <span class="preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
            <span class="mode-badge">{{ name || "row_number" }}: {{ start || 0 }} + {{ step || 1 }}</span>
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

    <SiliconeDialog v-model="dialog" title="Enumerate - Add a new column enumerating the lines of a CSV" width="70%">
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

.enumerate-main {
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

.options-grid {
  display: grid;
  grid-template-columns: 1fr;
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
  background: linear-gradient(145deg, #f0f8ff, #e6f2ff);
  border-radius: 8px;
  flex-wrap: wrap;
}

.dark .preview-formula {
  background: linear-gradient(145deg, #1e2a3a, #1a2535);
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
  color: #409eff;
  font-weight: 600;
}

.dark .formula-item {
  background: #2a2a2a;
  color: #66b1ff;
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

.stat-card {
  background: linear-gradient(145deg, #f5f5f5, #e8e8e8);
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.dark .stat-card {
  background: linear-gradient(145deg, #2a2a2a, #222);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.dark .stat-value {
  color: #e0e0e0;
}

.stat-card.stat-blue .stat-value {
  color: #409eff;
}

.stat-label {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.dark .stat-label {
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
</style>