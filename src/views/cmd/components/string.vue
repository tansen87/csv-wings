<script setup lang="ts">
import { onUnmounted, ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdStr, useMarkdown } from "@/utils/markdown";
import { useQuoting, useSkiprows } from "@/store/modules/options";
import { useProgress } from "@/store/modules/options";
import { message } from "@/utils/message";
import { useLocale, t } from "@/store/modules/locale";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const localeStore = useLocale();
const { locale } = storeToRefs(localeStore);

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[String] ${msg}`, type);
};

const [column, path] = [ref(""), ref("")];
const [n, length, by, activeTab] = [ref("4"), ref("5"), ref("-"), ref("left")];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const [loading, dialog, reverse] = [ref(false), ref(false), ref(false)];
const [currentRows, totalRows] = [ref(0), ref(0)];
const reverseOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const modeOptions = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Slice", value: "slice" },
  { label: "SplitN", value: "split_n" },
  { label: "SplitMax", value: "split_max" },
  { label: "PadLeft", value: "pad_left" },
  { label: "PadRight", value: "pad_right" },
  { label: "PadBoth", value: "pad_both" }
];
const { dynamicHeight } = useDynamicHeight(120);
const quoting = useQuoting();
const progress = useProgress();
const skiprows = useSkiprows();

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

  try {
    tableHeader.value = await mapHeaders(path.value, skiprows.skiprows);
    const { columnView, dataView } = await toJson(
      path.value,
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
  } catch (e) {
    addLog(`${t('failedToLoadFile', locale.value)} ${e}`, 'error');
  }
}

async function StrData() {
  if (path.value === "") {
    message(t('csvFileNotSelected', locale.value), { type: 'warning' });
    return;
  }
  if (column.value.length === 0) {
    message(t('columnNotSelected', locale.value), { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(`${t('starting', locale.value)} ${t('operation', locale.value)}...`, 'info');

    let rtime: string;
    if (["left", "right", "slice"].includes(activeTab.value)) {
      rtime = await invoke("str_slice", {
        path: path.value,
        column: column.value,
        n: n.value,
        length: length.value,
        reverse: reverse.value,
        mode: activeTab.value,
        quoting: quoting.quoting,
        progress: progress.progress,
        skiprows: skiprows.skiprows
      });
    } else if (["split_n", "split_max"].includes(activeTab.value)) {
      rtime = await invoke("str_split", {
        path: path.value,
        column: column.value,
        n: n.value,
        by: by.value,
        mode: activeTab.value,
        quoting: quoting.quoting,
        progress: progress.progress,
        skiprows: skiprows.skiprows
      });
    } else if (["pad_left", "pad_right", "pad_both"].includes(activeTab.value)) {
      rtime = await invoke("str_pad", {
        path: path.value,
        column: column.value,
        length: length.value,
        fillChar: by.value,
        mode: activeTab.value,
        quoting: quoting.quoting,
        progress: progress.progress,
        skiprows: skiprows.skiprows
      });
    }
    addLog(`${t('done', locale.value)}, ${t('elapsedTime', locale.value)}: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`${t('operation', locale.value)} ${t('failed', locale.value)}: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
}

const { mdShow } = useMarkdown(mdStr);

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
          <Icon icon="ri:text" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('string', locale) }}</h1>
          <p>{{ t('stringDesc', locale) }}</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
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
            <SiliconeButton @click.stop="StrData()" :loading="loading" size="small">
              {{ t('run', locale) }}
            </SiliconeButton>
          </div>
        </div>

        <div class="flex justify-center">
          <div class="cmd-mode-toggle py-1">
            <span v-for="item in modeOptions" :key="item.value" class="cmd-mode-item mx-0.5 w-24"
              :class="{ active: activeTab === item.value }" @click="activeTab = item.value">
              {{ item.label }}
            </span>
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
            <div class="option-label">{{ t('reverse', locale) }}</div>
            <div class="mode-toggle py-1">
              <span v-for="item in reverseOptions" :key="String(item.value)" class="mode-item mx-0.5 w-32"
                :class="{ active: reverse === item.value }" @click="reverse = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <div v-if="['left', 'right', 'slice', 'split_n', 'split_max'].includes(activeTab)" class="option-section">
            <div class="option-label">{{ activeTab === 'slice' ? t('startIndex', locale) : t('nValue', locale) }}</div>
            <SiliconeInput v-model="n" :placeholder="activeTab === 'slice' ? t('startIndexPlaceholder', locale) : t('nValuePlaceholder', locale)" class="w-full" />
          </div>

          <div v-if="['slice', 'pad_left', 'pad_right', 'pad_both'].includes(activeTab)" class="option-section">
            <div class="option-label">{{ activeTab === 'slice' ? t('length', locale) : t('padLength', locale) }}</div>
            <SiliconeInput v-model="length" :placeholder="activeTab === 'slice' ? t('lengthPlaceholder', locale) : t('padLengthPlaceholder', locale)" type="number"
              class="w-full" />
          </div>

          <div v-if="['split_n', 'split_max', 'pad_left', 'pad_right', 'pad_both'].includes(activeTab)"
            class="option-section">
            <div class="option-label">{{ activeTab.includes('split') ? t('splitBy', locale) : t('padChar', locale) }}</div>
            <SiliconeInput v-model="by" :placeholder="activeTab.includes('split') ? t('splitByPlaceholder', locale) : t('padCharPlaceholder', locale)"
              class="w-full" />
          </div>
        </div>

        <div class="stats-grid mt-4 mb-4">
          <div class="stats-card">
            <div class="stats-icon">
              <Icon icon="ri:database-line" />
            </div>
            <div class="stats-info">
              <span class="stats-label">{{ t('totalRows', locale) }}</span>
              <span class="stats-value">{{ totalRows }}</span>
            </div>
          </div>
          <div class="stats-card blue">
            <div class="stats-icon">
              <Icon icon="ri:scan-line" />
            </div>
            <div class="stats-info">
              <span class="stats-label">{{ t('progress', locale) }}</span>
              <SiliconeProgress v-if="totalRows > 0 && isFinite(currentRows / totalRows)"
                :percentage="Math.round((currentRows / totalRows) * 100)" class="mt-2" />
            </div>
          </div>
        </div>

        <div class="cmd-preview-header">
          <span class="cmd-preview-title">{{ t('preview', locale) }} ({{ tableData?.length || 0 }} {{ t('rows', locale) }})</span>
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
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" :title="`${t('string', locale)} - ${t('stringDesc', locale)}`" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
  background: linear-gradient(145deg, #faf5ff, #f3e8ff);
  border-radius: 8px;
  flex-wrap: wrap;
}

.dark .preview-formula {
  background: linear-gradient(145deg, #2e1f3d, #271a35);
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
  color: #8b5cf6;
  font-weight: 600;
}

.dark .formula-item {
  background: #2a2a2a;
  color: #a78bfa;
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