<script setup lang="ts">
import { onUnmounted, ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdFill, useMarkdown } from "@/utils/markdown";
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
  emit('add-log', `[Fill] ${msg}`, type);
};

const [fillChar, mode] = [ref("0"), ref("fill")];
const [currentRows, totalRows] = [ref(0), ref(0)];
const modeOptions = computed(() => [
  { label: t('fillMode', locale.value), value: "fill" },
  { label: t('ffillMode', locale.value), value: "ffill" }
]);
const [loading, dialog] = [ref(false), ref(false)];
const [columns, path] = [ref(""), ref("")];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdFill);
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

async function fillData() {
  if (path.value === "") {
    message(t('fileNotSelected', locale.value), { type: 'warning' });
    return;
  }
  if (columns.value.length === 0) {
    message(t('columnNotSelected', locale.value), { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(t('startingFillProcess', locale.value), 'info');
    const cols = Object.values(columns.value).join("|");
    const rtime: string = await invoke("fill", {
      path: path.value,
      columns: cols,
      values: fillChar.value,
      mode: mode.value,
      quoting: quoting.quoting,
      progress: progress.progress,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible
    });
    addLog(`${t('fillDone', locale.value)}, ${t('elapsedTime', locale.value)}: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`${t('fillFailed', locale.value)}: ${e}`, 'error');
  }
  loading.value = false;
}

onUnmounted(() => {
  [columns, path].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:rhythm-fill" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('fill', locale) }}</h1>
          <p>{{ t('fillDesc', locale) }}</p>
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
              <SiliconeButton @click.stop="fillData()" :loading="loading" size="small">
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

          <div class="cmd-options-grid mt-4 mb-4">
            <div class="cmd-option-section">
              <div class="cmd-option-label">{{ t('columns', locale) }} ({{ columns.length }})</div>
              <SiliconeSelect v-model="columns" multiple filterable :placeholder="t('selectColumns', locale)" class="w-full">
                <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>

            <div class="cmd-option-section" v-if="mode === 'fill'">
              <div class="cmd-option-label">{{ t('fillValue', locale) }}</div>
              <SiliconeInput v-model="fillChar" :placeholder="t('enterFillValue', locale)" class="w-full" />
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
            <span class="cmd-mode-badge">{{ t('mode', locale) }}: {{ mode === 'fill' ? t('fillMode', locale) : t('ffillMode', locale) }}</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'350px'" show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  {{ t('noDataClickAboveToSelectFile', locale) }}
                </div>
              </template>
              <el-table-column v-for="column in tableColumn" :prop="column.prop" :label="column.label"
                :key="column.prop" />
            </SiliconeTable>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" :title="`${t('fill', locale)} - ${t('fillDesc', locale)}`" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>