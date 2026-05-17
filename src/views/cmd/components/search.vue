<script setup lang="ts">
import { onUnmounted, ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { toJson, viewOpenFile, mapHeaders } from "@/utils/view";
import { mdSearch, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows,
  useThreads
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

const mode = ref("equal");
const [currentRows, totalRows, matchRows] = [ref(0), ref(0), ref(0)];
const [column, path, condition] = [ref(""), ref(""), ref("")];
const [dialog, loading] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(121);
const { mdShow } = useMarkdown(mdSearch);
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();
const threads = useThreads();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Search] ${msg}`, type);
};

listen("update-search-rows", (event: Event<number>) => {
  currentRows.value = event.payload;
});
listen("total-search-rows", (event: Event<number>) => {
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

async function searchData() {
  if (path.value === "") {
    message(t('csvFileNotSelected', locale.value), { type: 'warning' });
    return;
  }
  if (column.value.length === 0 && mode.value !== "irregular_regex") {
    message(t('columnNotSelected', locale.value), { type: 'warning' });
    return;
  }
  if (
    skiprows.skiprows > 0 &&
    threads.threads !== 1 &&
    mode.value !== "irregular_regex"
  ) {
    message(t('threadsOnlySupportSkiprowsZero', locale.value), { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(t('startingSearch', locale.value), 'info');
    const res: string[] = await invoke("search", {
      path: path.value,
      column: column.value,
      mode: mode.value,
      condition: condition.value,
      progress: progress.progress,
      quoting: quoting.quoting,
      flexible: flexible.flexible,
      unique: unique.value,
      skiprows: skiprows.skiprows,
      threads: threads.threads
    });
    matchRows.value = Number(res[0]);
    addLog(`${t('matched', locale.value)} ${res[0]} ${t('rows', locale.value)}, ${t('elapsedTime', locale.value)}: ${res[1]} s`, 'success');
  } catch (err) {
    addLog(`${t('searchFailed', locale.value)}: ${err.toString()}`, 'error');
  }
  loading.value = false;
}

interface FilterModeOption {
  label: string;
  value: string;
  description?: string;
}

const filterModeOptions = computed(() => [
  { label: t('equal', locale.value), value: "equal" },
  { label: t('equalMulti', locale.value), value: "equal_multi" },
  { label: t('notEqual', locale.value), value: "not_equal" },
  { label: t('contains', locale.value), value: "contains" },
  { label: t('containsMulti', locale.value), value: "contains_multi" },
  { label: t('notContains', locale.value), value: "not_contains" },
  { label: t('startsWith', locale.value), value: "starts_with" },
  { label: t('startsWithMulti', locale.value), value: "starts_with_multi" },
  { label: t('notStartsWith', locale.value), value: "not_starts_with" },
  { label: t('endsWith', locale.value), value: "ends_with" },
  { label: t('endsWithMulti', locale.value), value: "ends_with_multi" },
  { label: t('notEndsWith', locale.value), value: "not_ends_with" },
  { label: t('regex', locale.value), value: "regex" },
  { label: t('irregularRegex', locale.value), value: "irregular_regex" },
  { label: t('isNull', locale.value), value: "is_null" },
  { label: t('isNotNull', locale.value), value: "is_not_null" },
  { label: t('gt', locale.value), value: "gt" },
  { label: t('ge', locale.value), value: "ge" },
  { label: t('lt', locale.value), value: "lt" },
  { label: t('le', locale.value), value: "le" },
  { label: t('between', locale.value), value: "between" }
]);

const unique = ref(false);
const uniqueOpts = computed(() => [
  { label: t('byColumn', locale.value), value: true },
  { label: t('byInput', locale.value), value: false }
]);

onUnmounted(() => {
  [column, path, condition].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:filter-2-line" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('search', locale) }}</h1>
          <p>{{ t('searchDesc', locale) }}</p>
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
              <SiliconeButton @click.stop="searchData()" :loading="loading" size="small">
                {{ t('run', locale) }}
              </SiliconeButton>
            </div>
          </div>

          <div class="cmd-options-grid mt-4 mb-4">
            <div class="cmd-option-section">
              <div class="cmd-option-label">{{ t('columnAndMode', locale) }}</div>
              <div class="flex gap-4">
                <div class="flex-1">
                  <SiliconeSelect v-model="column" filterable :placeholder="t('selectColumn', locale)">
                    <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
                  </SiliconeSelect>
                </div>
                <div class="flex-1">
                  <SiliconeSelect v-model="mode" filterable>
                    <el-option v-for="option in filterModeOptions" :key="option.value" :label="option.label"
                      :value="option.value" />
                  </SiliconeSelect>
                </div>
              </div>
            </div>

            <div class="cmd-option-section" v-if="
              [
                'equal_multi',
                'contains_multi',
                'starts_with_multi',
                'ends_with_multi'
              ].includes(mode)
            ">
              <div class="cmd-option-label">{{ t('conditionMode', locale) }}</div>
              <div class="flex justify-center">
                <div class="cmd-mode-toggle py-1">
                  <span v-for="item in uniqueOpts" :key="String(item.value)" class="cmd-mode-item mx-0.5 w-24"
                    :class="{ active: unique === item.value }" @click="unique = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
            </div>

            <div class="cmd-option-section" v-if="unique === false">
              <div class="cmd-option-label">{{ t('condition', locale) }}</div>
              <SiliconeInput v-model="condition" :autosize="{ minRows: 12, maxRows: 12 }" type="textarea"
                :placeholder="t('searchConditionPlaceholder', locale)" class="w-full" />
            </div>
          </div>

          <div class="cmd-stats-grid mt-4" v-if="totalRows > 0">
            <div class="cmd-stat-card">
              <div class="cmd-stat-value">{{ totalRows }}</div>
              <div class="cmd-stat-label">{{ t('total', locale) }}</div>
            </div>
            <div class="cmd-stat-card stat-blue">
              <div class="cmd-stat-value">{{ currentRows }}</div>
              <div class="cmd-stat-label">{{ t('scanned', locale) }}</div>
              <SiliconeProgress v-if="totalRows > 0 && isFinite(currentRows / totalRows)"
                :percentage="Math.round((currentRows / totalRows) * 100)" class="mt-2" />
            </div>
            <div class="cmd-stat-card stat-green">
              <div class="cmd-stat-value">{{ matchRows }}</div>
              <div class="cmd-stat-label">{{ t('matched', locale) }}</div>
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
              <el-table-column v-for="col in tableColumn" :prop="col.prop" :label="col.label"
                :key="col.prop" />
            </SiliconeTable>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" :title="`${t('search', locale)} - ${t('searchDesc', locale)}`" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>