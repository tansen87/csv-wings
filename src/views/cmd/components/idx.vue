<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useQuoting, useSkiprows } from "@/store/modules/options";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";

const path = ref("");
const loading = ref(false);
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (message: string, type: string = 'info') => {
  emit('add-log', `[Index] ${message}`, type);
};

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    return;
  }

  try {
    tableHeader.value = await mapHeaders(path.value, useSkiprows().skiprows);
    const { columnView, dataView } = await toJson(
      path.value,
      useSkiprows().skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
  } catch (e) {
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

async function createIndex() {
  if (path.value === "") {
    message(`CSV file not selected`, { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(`Processing file: ${path.value}`, 'info');
    const rtime: string = await invoke("csv_idx", {
      path: path.value,
      quoting: useQuoting().quoting,
      skiprows: useSkiprows().skiprows
    });
    addLog(`Create index done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`createIndex failed: ${e}`, 'error');
  }
  loading.value = false;
}

onUnmounted(() => {
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
        <div class="header-icon">
          <Icon icon="ri:rocket-line" />
        </div>
        <div class="header-text">
          <h1>Index</h1>
          <p>Create indexed files for faster CSV reading</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="idx-main">
        <div class="p-3">

          <div class="file-selection-bar" :class="{ 'has-file': path }" @click="selectFile">
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
              <SiliconeButton @click.stop="createIndex()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="mt-6">
            <div class="preview-header">
              <span class="preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
            </div>
            <div class="overflow-hidden rounded-lg">
              <SiliconeTable :data="tableData" :height="'400px'" show-overflow-tooltip>
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

.idx-main {
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

.file-selection-bar.has-file {
  border-style: solid;
  border-color: #67c23a;
  background: linear-gradient(145deg, #f0fff4, #e6fff0);
}

.dark .file-selection-bar {
  background: linear-gradient(145deg, #2a2a2a, #222);
  border-color: #444;
}

.dark .file-selection-bar:hover {
  border-color: #409eff;
  background: linear-gradient(145deg, #1e2a3a, #1a2535);
}

.dark .file-selection-bar.has-file {
  border-color: #67c23a;
  background: linear-gradient(145deg, #1a2a20, #152518);
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

.file-selection-bar.has-file .file-selection-icon {
  background: linear-gradient(145deg, #c6e2ff, #a8d4ff);
  color: #409eff;
}

.dark .file-selection-icon {
  background: linear-gradient(145deg, #3a3a3a, #2d2d2d);
  color: #777;
}

.dark .file-selection-bar.has-file .file-selection-icon {
  background: linear-gradient(145deg, #2a4a6a, #1e3a5a);
  color: #66b1ff;
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