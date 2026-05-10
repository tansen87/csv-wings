<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { viewOpenFile, toJson } from "@/utils/view";
import { mdReverse, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";
import { message } from "@/utils/message";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Reverse] ${msg}`, type);
};

const path = ref("");
const [tableColumn, tableData] = [ref([]), ref([])];
const [loading, dialog] = [ref(false), ref(false)];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdReverse);
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

async function reverseData() {
  if (path.value === "") {
    message("File not selected", { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog('Starting reverse operation...', 'info');

    const rtime: string = await invoke("reverse", {
      path: path.value,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible
    });
    addLog(`Reverse done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Reverse operation failed: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
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
          <Icon icon="ri:arrow-up-down-line" />
        </div>
        <div class="header-text">
          <h1>CSV Reverse</h1>
          <p>Reverse order of rows in a CSV</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
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
            <SiliconeButton @click.stop="reverseData()" :loading="loading" size="small">
              Run
            </SiliconeButton>
          </div>
        </div>

        <div class="preview-formula mt-4">
          <span class="formula-label">Preview:</span>
          <span class="formula-item">REVERSE</span>
          <span class="formula-operator">ROWS</span>
          <span class="formula-item">{{ tableData?.length || 0 }}</span>
          <span class="formula-operator">FIRST → LAST</span>
        </div>

        <div class="reverse-demo mt-4 mb-4">
          <div class="demo-row">
            <div class="demo-label">BEFORE</div>
            <div class="demo-items">
              <span class="demo-item">1</span>
              <span class="demo-item">2</span>
              <span class="demo-item">3</span>
            </div>
          </div>
          <div class="demo-arrow">
            <Icon icon="ri:arrow-right-line" />
          </div>
          <div class="demo-row">
            <div class="demo-label">AFTER</div>
            <div class="demo-items">
              <span class="demo-item reversed">3</span>
              <span class="demo-item reversed">2</span>
              <span class="demo-item reversed">1</span>
            </div>
          </div>
        </div>

        <div class="preview-header">
          <span class="preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
          <span class="mode-badge">Reverse</span>
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

    <SiliconeDialog v-model="dialog" title="Reverse - Reverse order of rows in a CSV" width="70%">
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
  border-color: #f59e0b;
  background: linear-gradient(145deg, #fffbeb, #fef3c7);
}

.dark .file-selection-bar {
  background: linear-gradient(145deg, #2a2a2a, #222);
  border-color: #444;
}

.dark .file-selection-bar:hover {
  border-color: #f59e0b;
  background: linear-gradient(145deg, #2e2517, #271f12);
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

.preview-formula {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(145deg, #fffbeb, #fef3c7);
  border-radius: 8px;
  flex-wrap: wrap;
}

.dark .preview-formula {
  background: linear-gradient(145deg, #2e2517, #271f12);
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
  color: #f59e0b;
  font-weight: 600;
}

.dark .formula-item {
  background: #2a2a2a;
  color: #fbbf24;
}

.formula-operator {
  color: #888;
  font-size: 12px;
}

.dark .formula-operator {
  color: #999;
}

.reverse-demo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 10px;
}

.dark .reverse-demo {
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

.demo-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.demo-item {
  font-family: ui-monospace, monospace;
  background: white;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #666;
  font-weight: 500;
  border: 1px solid #e8e8e8;
}

.dark .demo-item {
  background: #3a3a3a;
  color: #aaa;
  border-color: #444;
}

.demo-item.reversed {
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  color: #f59e0b;
  border-color: #fcd34d;
}

.dark .demo-item.reversed {
  background: linear-gradient(135deg, #2e2517, #271f12);
  color: #fbbf24;
  border-color: #92400e;
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