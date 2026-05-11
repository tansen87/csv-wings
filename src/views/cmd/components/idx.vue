<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useQuoting, useSkiprows } from "@/store/modules/options";
import { mapHeaders, viewOpenFile, toJson, detectSeparator } from "@/utils/view";
import { message } from "@/utils/message"
import "./common.css";

const path = ref("");
const loading = ref(false);
const separator = ref("");
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
    separator.value = "";
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
    separator.value = await detectSeparator(path.value, useSkiprows().skiprows);
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
  separator.value = "";
  tableHeader.value = [];
  tableColumn.value = [];
  tableData.value = [];
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon">
          <Icon icon="ri:rocket-line" />
        </div>
        <div class="cmd-header-text">
          <h1>Index</h1>
          <p>Create indexed files for faster CSV reading</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="cmd-main">
        <div class="p-3">
          <div class="cmd-file-selection-bar" :class="{ 'has-file': path }" @click="selectFile">
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
              <SiliconeButton @click.stop="createIndex()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div v-if="separator" class="separator-info">
            <div class="flex items-center gap-2">
              <Icon icon="ri:tooth-line" class="w-4 h-4" />
              <span class="text-sm">Detected separator:</span>
              <span class="separator-value">{{ separator === '\t' ? 'Tab (\\t)' : separator }}</span>
            </div>
          </div>

          <div class="mt-4">
            <div class="cmd-preview-header">
              <span class="cmd-preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
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
.separator-info {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 8px;
  border: 1px solid var(--el-border-color, #e4e7ed);
  color: var(--el-text-color-regular, #303133);
}

.separator-value {
  background: var(--el-color-primary-light-9, #e6f7ff);
  color: var(--el-color-primary, #409eff);
  font-size: 18px;
  font-family: monospace;
}

.dark .separator-info {
  background: var(--el-fill-color-dark, #2a2a2a);
  border-color: var(--el-border-color-dark, #4a4a4a);
  color: var(--el-text-color-regular, #c0c4cc);
}

.dark .separator-value {
  background: var(--el-color-primary-dark-2, #1a365d);
  color: var(--el-color-primary-light-3, #91caff);
}
</style>