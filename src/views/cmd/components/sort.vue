<script setup lang="ts">
import { onUnmounted, ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdSort, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/setting";
import { message } from "@/utils/message";
import { useLocale, t } from "@/store/modules/locale";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const localeStore = useLocale();
const { locale } = storeToRefs(localeStore);

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Sort] ${msg}`, type);
};

const mode = ref("Sort");
const modeOptions = computed(() => [
  { label: t('sort', locale.value), value: "Sort" },
  { label: t('extSort', locale.value), value: "ExtSort" }
]);
const numOptions = computed(() => [
  { label: t('true', locale.value), value: true },
  { label: t('false', locale.value), value: false }
]);
const reverseOptions = computed(() => [
  { label: t('asc', locale.value), value: false },
  { label: t('desc', locale.value), value: true }
]);
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
    addLog(`${t('failedToLoadFile', locale.value)}: ${e}`, 'error');
  }
}

async function sortData() {
  if (path.value === "") {
    message(t('csvFileNotSelected', locale.value), { type: 'warning' });
    return;
  }
  if (column.value.length === 0 && mode.value !== "index") {
    message(t('columnNotSelected', locale.value), { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(`${t('starting', locale.value)} ${mode.value} ${t('process', locale.value)}...`, 'info');

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
    addLog(`${mode.value} ${t('done', locale.value)}, ${t('elapsedTime', locale.value)}: ${rtime} s`, 'success');
  } catch (err) {
    addLog(`${mode.value} ${t('failed', locale.value)}: ${err.toString()}`, 'error');
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
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:sort-alphabet-asc" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('sort', locale) }}</h1>
          <p>{{ t('sortDesc', locale) }}</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="cmd-main">
        <div class="p-3">
          <div class="cmd-file-selection-bar mb-4" @click="selectFile()">
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
              <SiliconeButton @click.stop="sortData()" :loading="loading" size="small">
                {{ t('run', locale) }}
              </SiliconeButton>
            </div>
          </div>

          <div class="flex justify-center">
            <div class="cmd-mode-toggle py-1">
              <span v-for="item in modeOptions" :key="item.value" class="cmd-mode-item mx-0.5 w-24"
                :class="{ active: mode === item.value }" @click="mode = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <div class="options-grid mt-4">
            <div class="option-section">
              <div class="option-label">{{ t('sortColumn', locale) }}</div>
              <SiliconeSelect v-model="column" filterable :placeholder="t('selectColumn', locale)" class="w-full">
                <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>

            <div class="option-section">
              <div class="option-label">{{ t('numeric', locale) }}</div>
              <div class="mode-toggle py-1">
                <span v-for="item in numOptions" :key="String(item.value)" class="mode-item mx-0.5 w-32"
                  :class="{ active: numeric === item.value }" @click="numeric = item.value">
                  {{ item.label }}
                </span>
              </div>
            </div>

            <div class="option-section">
              <div class="option-label">{{ t('order', locale) }}</div>
              <div class="mode-toggle py-1">
                <span v-for="item in reverseOptions" :key="String(item.value)" class="mode-item mx-0.5 w-32"
                  :class="{ active: reverse === item.value }" @click="reverse = item.value">
                  {{ item.label }}
                </span>
              </div>
            </div>
          </div>

          <div class="preview-formula mt-4 mb-4">
            <span class="formula-label">{{ t('preview', locale) }}:</span>
            <span class="formula-item">{{ mode }}</span>
            <span class="formula-operator">{{ t('by', locale) }}</span>
            <span class="formula-item">{{ column || t('column', locale) }}</span>
            <span class="formula-operator">{{ numeric ? t('numericLabel', locale) : "" }}</span>
            <span class="formula-operator">{{ reverse ? t('desc', locale) : t('asc', locale) }}</span>
          </div>

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">{{ t('preview', locale) }} ({{ tableData?.length || 0 }} {{ t('rows', locale) }})</span>
            <span class="cmd-mode-badge">{{ mode }} | {{ column || t('none', locale) }} | {{ reverse ? t('desc', locale) : t('asc', locale) }}</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'350px'" show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  {{ t('noData', locale) }}
                </div>
              </template>
              <el-table-column v-for="col in tableColumn" :prop="col.prop" :label="col.label" :key="col.prop" />
            </SiliconeTable>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" :title="`${t('sort', locale)} - ${t('sortDesc', locale)}`" width="70%">
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

@media (max-width: 768px) {
  .options-grid {
    grid-template-columns: 1fr;
  }
}
</style>