<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdInsert, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows
} from "@/store/modules/setting";
import { message } from "@/utils/message";
import { useLocale, t } from "@/store/modules/locale";
import { storeToRefs } from "pinia";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const localeStore = useLocale();
const { locale } = storeToRefs(localeStore);

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Insert] ${msg}`, type);
};

const [loading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const [currentRows, totalRows] = [ref(0), ref(0)];
const [path, column, position, values] = [ref(""), ref(""), ref(""), ref("")];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdInsert);

const skiprows = useSkiprows();
const quoting = useQuoting();
const flexible = useFlexible();
const progress = useProgress();

listen("update-insert-rows", (event: Event<number>) => {
  currentRows.value = event.payload;
});
listen("total-insert-rows", (event: Event<number>) => {
  totalRows.value = event.payload;
});

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    column.value = "";
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
    addLog(`${t('loaded', locale.value)} ${tableData.value.length} ${t('rows', locale.value)} with ${tableColumn.value.length} ${t('columns', locale.value)}`, 'success');
  } catch (e) {
    addLog(`${t('failedToLoadFile', locale.value)}: ${e}`, 'error');
  }
}

async function insertData() {
  if (path.value === "") {
    message(t('csvFileNotSelected', locale.value), { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(`${t('startingInsert', locale.value)}...`, 'info');

    const rtime: string = await invoke("insert", {
      path: path.value,
      column: column.value,
      position: position.value,
      values: values.value,
      skiprows: skiprows.skiprows,
      quoting: quoting.quoting,
      flexible: flexible.flexible,
      progress: progress.progress
    });
    addLog(`${t('insertDone', locale.value)}, ${t('elapsedTime', locale.value)}: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`${t('insertFailed', locale.value)}: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  [path, column, position, values].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:insert-column-right" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('insert', locale) }}</h1>
          <p>{{ t('insertDesc', locale) }}</p>
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
              <span class="cmd-file-prompt">{{ t('clickToSelectFile', locale) }}</span>
            </template>
          </div>
          <div class="flex items-center gap-2 ml-auto">
            <SiliconeButton @click.stop="insertData()" :loading="loading" size="small">
              {{ t('run', locale) }}
            </SiliconeButton>
          </div>
        </div>

        <div class="options-grid mt-4">
          <div class="option-section">
            <div class="option-label">{{ t('targetColumn', locale) }}</div>
            <SiliconeSelect v-model="column" filterable :placeholder="t('selectColumn', locale)" class="w-full">
              <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
            </SiliconeSelect>
          </div>

          <div class="option-section">
            <div class="option-label">{{ t('position', locale) }}</div>
            <SiliconeInput v-model="position" :placeholder="t('positionPlaceholder', locale)" class="w-full" />
          </div>

          <div class="option-section">
            <div class="option-label">{{ t('values', locale) }}</div>
            <SiliconeInput v-model="values" :placeholder="t('valuesPlaceholder', locale)" class="w-full" />
          </div>
        </div>

        <div class="preview-formula mt-4">
          <span class="formula-label">{{ t('preview', locale) }}:</span>
          <span class="formula-item">INSERT</span>
          <span class="formula-operator">{{ t('col', locale) }}</span>
          <span class="formula-item">{{ column }}</span>
          <span class="formula-operator">@</span>
          <span class="formula-item">{{ position || t('insertLeft', locale) }}</span>
          <span class="formula-operator">=</span>
          <span class="formula-item">{{ values ? values.split('|').length : 0 }} {{ t('vals', locale) }}</span>
        </div>

        <div class="insert-demo mt-4">
          <div class="demo-row">
            <div class="demo-label">{{ t('before', locale) }}</div>
            <div class="demo-items">
              <span class="demo-item">A</span>
              <span class="demo-item">B</span>
              <span class="demo-item">C</span>
            </div>
          </div>
          <div class="demo-arrow">
            <Icon icon="ri:arrow-right-line" />
          </div>
          <div class="demo-row">
            <div class="demo-label">{{ t('after', locale) }}</div>
            <div class="demo-items">
              <span class="demo-item">A</span>
              <span class="demo-item insert-highlight">X</span>
              <span class="demo-item">B</span>
              <span class="demo-item">C</span>
            </div>
          </div>
        </div>

        <div class="cmd-progress-card mt-4" v-if="totalRows > 0">
            <div class="cmd-progress-header">
              <div class="cmd-progress-info">
                <span class="cmd-progress-current">{{ currentRows }}</span>
                <span class="cmd-progress-divider">/</span>
                <span class="cmd-progress-total">{{ totalRows }}</span>
                <span class="cmd-progress-label">{{ t('totalRows', locale) }}</span>
              </div>
            </div>
            <SiliconeProgress 
              v-if="totalRows > 0 && isFinite(currentRows / totalRows)"
              :percentage="Math.round((currentRows / totalRows) * 100)"
              class="mr-[-16px]"
            />
          </div>

        <div class="cmd-preview-header mt-4">
          <span class="cmd-preview-title">{{ t('preview', locale) }} ({{ tableData?.length || 0 }} {{ t('rows', locale) }} x {{ tableColumn?.length || 0 }} {{ t('cols', locale) }})</span>
          <span class="cmd-mode-badge">INSERT @ {{ position || t('insertLeft', locale) }}</span>
        </div>
        <div class="overflow-hidden rounded-lg">
          <SiliconeTable :data="tableData" :height="'350px'" show-overflow-tooltip>
            <template #empty>
              <div class="flex items-center justify-center gap-2 text-gray-500">
                {{ t('noData', locale) }}
              </div>
            </template>
            <el-table-column v-for="col in tableColumn" :prop="col.prop" :label="col.label" :key="col.prop" />
          </SiliconeTable>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" :title="`${t('insert', locale)} - ${t('insertDesc', locale)}`" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
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
  background: linear-gradient(145deg, #ecfdf5, #d1fae5);
  border-radius: 8px;
  flex-wrap: wrap;
}

.dark .preview-formula {
  background: linear-gradient(145deg, #1a2e25, #172219);
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
  color: #10b981;
  font-weight: 600;
}

.dark .formula-item {
  background: #2a2a2a;
  color: #34d399;
}

.formula-operator {
  color: #888;
  font-size: 12px;
}

.dark .formula-operator {
  color: #999;
}

.insert-demo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 10px;
}

.dark .insert-demo {
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
  gap: 4px;
}

.demo-item {
  font-family: ui-monospace, monospace;
  background: white;
  padding: 6px 12px;
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

.demo-item.insert-highlight {
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  color: #10b981;
  border-color: #6ee7b7;
}

.dark .demo-item.insert-highlight {
  background: linear-gradient(135deg, #1a2e25, #172219);
  color: #34d399;
  border-color: #065f46;
}

.demo-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #888;
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