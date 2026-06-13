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
} from "@/store/modules/setting";
import { message } from "@/utils/message"
import { useLocale, t } from "@/store/modules/locale";
import { storeToRefs } from "pinia";
import "./common.css";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const localeStore = useLocale();
const { locale } = storeToRefs(localeStore);

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
    addLog(`${t('failedToLoadFile', locale.value)}: ${e}`, 'error');
  }
}

async function enumerate() {
  if (path.value === "") {
    message(t('fileNotSelected', locale.value), { type: 'warning' });
    return;
  }
  if (parseInt(start.value) < 0) {
    message(t('startMustBeGreater', locale.value), { type: 'warning' });
    return;
  }
  if (parseInt(step.value) < 1) {
    message(t('stepMustBeGreater', locale.value), { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(`${t('startingEnumerate', locale.value)}...`, 'info');
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
    addLog(`${t('enumerateDone', locale.value)}, ${t('elapsedTime', locale.value)}: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`${t('enumerateFailed', locale.value)}: ${e}`, 'error');
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
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:sort-number-asc" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('enumerate', locale) }}</h1>
          <p>{{ t('enumerateDesc', locale) }}</p>
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
              <SiliconeButton @click.stop="enumerate()" :loading="loading" size="small">
                {{ t('run', locale) }}
              </SiliconeButton>
            </div>
          </div>

          <div class="cmd-options-grid mt-4">
            <div class="cmd-option-section">
              <div class="cmd-option-label">{{ t('columnName', locale) }}</div>
              <SiliconeInput v-model="name" :placeholder="t('columnNamePlaceholder', locale)" />
            </div>

            <div class="cmd-option-section">
              <div class="cmd-option-label">{{ t('startStep', locale) }}</div>
              <div class="flex gap-4">
                <div class="flex-1">
                  <SiliconeInput v-model="start" :placeholder="t('start', locale)" />
                </div>
                <div class="flex-1">
                  <SiliconeInput v-model="step" :placeholder="t('step', locale)" />
                </div>
              </div>
            </div>

            <div class="preview-formula">
              <span class="formula-label">{{ t('preview', locale) }}:</span>
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

          <div class="cmd-progress-card mt-4 mb-4" v-if="totalRows > 0">
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

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">{{ t('preview', locale) }} ({{ tableData?.length || 0 }} {{ t('rows', locale) }})</span>
            <span class="cmd-mode-badge">{{ name || "row_number" }}: {{ start || 0 }} + {{ step || 1 }}</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'350px'" show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  {{ t('noData', locale) }}
                </div>
              </template>
              <el-table-column v-for="column in tableColumn" :prop="column.prop" :label="column.label"
                :key="column.prop" />
            </SiliconeTable>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" :title="`${t('enumerate', locale)} - ${t('enumerateDesc', locale)}`" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
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

.formula-operator {
  color: #888;
  font-size: 12px;
}
</style>