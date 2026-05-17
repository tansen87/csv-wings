<script setup lang="ts">
import { onUnmounted, ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdDedup, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";
import { message } from "@/utils/message";
import { useLocale, t } from "@/store/modules/locale";
import { storeToRefs } from "pinia";
import "./common.css";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const localeStore = useLocale();
const { locale } = storeToRefs(localeStore);

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Dedup] ${msg}`, type);
};

const mode = ref("keep_first");
const modeOptions = computed(() => [
  { label: t('keepFirst', locale.value), value: "keep_first" },
  { label: t('keepLast', locale.value), value: "keep_last" },
  { label: t('keepDuplicates', locale.value), value: "keep_duplicates" },
  { label: t('unique', locale.value), value: "unique" }
]);
const sortedOptions = computed(() => [
  { label: t('true', locale.value), value: true },
  { label: t('false', locale.value), value: false }
]);
const [loading, dialog, sorted] = [ref(false), ref(false), ref(false)];
const [columns, path] = [ref<string[]>([]), ref("")];
const outputRows = ref(0);
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdDedup);
const quoting = useQuoting();
const skiprows = useSkiprows();
const flexible = useFlexible();

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    addLog(t('fileSelectionCancelled', locale.value), 'info');
    return;
  }

  try {
    addLog(`${t('selectedFile', locale.value)}: ${path.value}`, 'info');
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

async function runDedup() {
  if (path.value === "") {
    message(t('fileNotSelected', locale.value), { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(`${t('startingDeduplication', locale.value)} ${t('withMode', locale.value)}: ${mode.value}`, 'info');
    addLog(`${t('selectedColumns', locale.value)}: ${columns.value.length > 0 ? columns.value.join(', ') : t('all', locale.value)}`, 'info');

    const result: string = await invoke("dedup", {
      path: path.value,
      columns: columns.value,
      mode: mode.value,
      skiprows: skiprows.skiprows,
      sorted: sorted.value,
      flexible: flexible.flexible,
      quoting: quoting.quoting
    });
    const json_res = JSON.parse(result);

    let msg: string;
    if (json_res.mode === "keep_duplicates") {
      msg = `${t('found', locale.value)} ${json_res.output_rows} ${t('duplicateRows', locale.value)} ${t('in', locale.value)} ${json_res.elapsed_seconds.toFixed(1)}s`;
    } else {
      msg = `${t('kept', locale.value)} ${json_res.output_rows} ${t('uniqueRows', locale.value)} ${t('in', locale.value)} ${json_res.elapsed_seconds.toFixed(1)}s`;
    }
    addLog(msg, 'success');
    outputRows.value = json_res.output_rows;
  } catch (e) {
    addLog(`${t('deduplicationFailed', locale.value)}: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  columns.value = [];
  path.value = "";
  tableHeader.value = [];
  tableColumn.value = [];
  tableData.value = [];
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:table-alt-fill" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('dedup', locale) }}</h1>
          <p>{{ t('dedupDesc', locale) }}</p>
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
              <SiliconeButton @click.stop="runDedup()" :loading="loading" size="small">
                {{ t('run', locale) }}
              </SiliconeButton>
            </div>
          </div>

          <div class="flex justify-center">
            <div class="cmd-mode-toggle py-1">
              <span v-for="item in modeOptions" :key="item.value" class="cmd-mode-item mx-0.5 w-28"
                :class="{ active: mode === item.value }" @click="mode = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <div class="cmd-options-grid mt-4">
            <div class="cmd-option-section">
              <div class="cmd-option-label">{{ t('columns', locale) }} ({{ columns.length }})</div>
              <SiliconeSelect v-model="columns" multiple filterable :placeholder="t('selectColumnsEmptyAll', locale)">
                <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>
            <div class="cmd-option-section">
              <div class="cmd-option-label">{{ t('sorted', locale) }}</div>
              <div class="cmd-mode-toggle-inline">
                <span v-for="item in sortedOptions" :key="String(item.value)" class="cmd-toggle-item"
                  :class="{ active: sorted === item.value }" @click="sorted = item.value">
                  {{ item.label }}
                </span>
              </div>
              <p class="option-hint">{{ t('enableO1Memory', locale) }}</p>
            </div>
          </div>

          <div class="info-box mt-4">
            <Icon icon="ri:information-line" class="info-icon" />
            <span v-if="mode === 'keep_first'">
              {{ t('keepFirstDesc', locale) }}
            </span>
            <span v-else-if="mode === 'keep_last'">
              {{ t('keepLastDesc', locale) }}
            </span>
            <span v-else-if="mode === 'keep_duplicates'">
              {{ t('keepDuplicatesDesc', locale) }}
            </span>
            <span v-else-if="mode === 'unique'">{{ t('uniqueDesc', locale) }}</span>
          </div>

          <div v-if="outputRows > 0" class="stats-box mt-4">
            <div class="cmd-stat-value" :class="mode === 'keep_duplicates' ? 'text-orange-500' : 'text-green-500'">
              {{ outputRows }}
            </div>
            <div class="cmd-stat-label">
              {{ mode === "keep_duplicates" ? t('duplicateRows', locale) : t('uniqueRowsKept', locale) }}
            </div>
          </div>

          <div class="mt-4">
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
                <el-table-column v-for="column in tableColumn" :prop="column.prop" :label="column.label"
                  :key="column.prop" />
              </SiliconeTable>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" :title="`${t('dedup', locale)} - ${t('dedupDesc', locale)}`" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
.info-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(145deg, #f0f8ff, #e6f2ff);
  border: 1px solid #b3d8fd;
  border-radius: 10px;
  font-size: 13px;
  color: #409eff;
}
</style>