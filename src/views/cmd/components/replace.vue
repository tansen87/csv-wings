<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdReplace, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows,
  useThreads
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
  emit('add-log', `[Replace] ${msg}`, type);
};

const [isLoading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const [currentRows, totalRows, matchRows] = [ref(0), ref(0), ref(0)];
const [column, path, regexPattern, replacement] = [
  ref(""),
  ref(""),
  ref(""),
  ref("")
];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdReplace);
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();
const threads = useThreads();

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
    addLog(`${t('failedToLoadFile', locale.value)}: ${e}`, 'error');
  }
}

async function replaceData() {
  if (path.value === "") {
    message(t('csvFileNotSelected', locale.value), { type: 'warning' });
    return;
  }
  if (column.value.length === 0) {
    message(t('columnNotSelected', locale.value), { type: 'warning' });
    return;
  }
  if (skiprows.skiprows > 0 && threads.threads !== 1) {
    message(t('threadsOnlySupportSkiprowsZero', locale.value), { type: 'warning' });
    return;
  }

  try {
    isLoading.value = true;
    addLog(t('startingReplaceProcess', locale.value), 'info');
    const res: string[] = await invoke("replace", {
      path: path.value,
      column: column.value,
      regexPattern: regexPattern.value,
      replacement: replacement.value,
      quoting: quoting.quoting,
      progress: progress.progress,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible,
      threads: threads.threads
    });
    matchRows.value = Number(res[0]);
    addLog(`${t('replaced', locale.value)} ${res[0]} ${t('rows', locale.value)}, ${t('elapsedTime', locale.value)}: ${res[1]} s`, 'success');
  } catch (e) {
    addLog(`${t('replaceFailed', locale.value)}: ${e}`, 'error');
  } finally {
    isLoading.value = false;
  }
}

onUnmounted(() => {
  [column, path, regexPattern, replacement].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:find-replace-line" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('replace', locale) }}</h1>
          <p>{{ t('replaceDesc', locale) }}</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="cmd-main">
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
              <SiliconeButton @click.stop="replaceData()" :loading="isLoading" size="small">
                {{ t('run', locale) }}
              </SiliconeButton>
            </div>
          </div>

          <div class="options-grid mt-4">
            <div class="option-section">
              <div class="option-label">{{ t('column', locale) }}</div>
              <SiliconeSelect v-model="column" filterable :placeholder="t('selectColumn', locale)" class="w-full">
                <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>

            <div class="option-section">
              <div class="option-label">{{ t('regexPattern', locale) }}</div>
              <SiliconeInput v-model="regexPattern" :placeholder="t('regexPatternPlaceholder', locale)" class="w-full" />
            </div>

            <div class="option-section">
              <div class="option-label">{{ t('replacement', locale) }}</div>
              <SiliconeInput v-model="replacement" :placeholder="t('replacementPlaceholder', locale)" class="w-full" />
            </div>

            <div class="preview-formula">
              <span class="formula-label">{{ t('preview', locale) }}:</span>
              <span class="formula-item">str.replace({{ regexPattern || t('pattern', locale) }}, {{ replacement || t('value', locale) }})</span>
            </div>
          </div>

          <div class="stats-grid mt-4 mb-4">
            <div class="stat-card stat-green">
              <div class="stat-label">{{ t('replacedRows', locale) }}</div>
              <div class="stat-value">{{ matchRows }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{{ t('totalRows', locale) }}</div>
              <div class="stat-value">{{ totalRows }}</div>
            </div>
            <div class="stat-card stat-blue">
              <div class="stat-label">{{ t('progress', locale) }}</div>
              <SiliconeProgress v-if="totalRows > 0 && isFinite(currentRows / totalRows)"
                :percentage="Math.round((currentRows / totalRows) * 100)" class="mt-2" />
            </div>
          </div>

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">{{ t('preview', locale) }} ({{ tableData?.length || 0 }} {{ t('rows', locale) }})</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'350px'" show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  {{ t('noDataClickAboveToSelectFile', locale) }}
                </div>
              </template>
              <el-table-column v-for="col in tableColumn" :prop="col.prop" :label="col.label" :key="col.prop" />
            </SiliconeTable>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" :title="`${t('replace', locale)} - ${t('replaceDesc', locale)}`" width="70%">
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
  grid-column: span 3;
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
  color: #22c55e;
  font-weight: 600;
}

.dark .formula-item {
  background: #2a2a2a;
  color: #4ade80;
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
  grid-template-columns: repeat(3, 1fr);
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

.stat-card.stat-green .stat-value {
  color: #22c55e;
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

@media (max-width: 768px) {
  .options-grid {
    grid-template-columns: 1fr;
  }

  .preview-formula {
    grid-column: span 1;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>