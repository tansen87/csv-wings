<script setup lang="ts">
import { onUnmounted, ref, watch, computed } from "vue";
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

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Search Chain] ${msg}`, type);
};

interface ColumnConfig {
  column: string;
  mode: string;
  condition: string;
}

const columnConfigs = ref<ColumnConfig[]>([]);
const logics = ref<string[]>([]);

const path = ref("");
const [currentRows, totalRows, matchRows] = [ref(0), ref(0), ref(0)];
const [dialog, loading] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];

const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdSearch);
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();
const threads = useThreads();

const filterModeOptions = computed(() => [
  { label: t('equal', locale.value), value: "equal" },
  { label: t('notEqual', locale.value), value: "not_equal" },
  { label: t('contains', locale.value), value: "contains" },
  { label: t('notContains', locale.value), value: "not_contains" },
  { label: t('startsWith', locale.value), value: "starts_with" },
  { label: t('endsWith', locale.value), value: "ends_with" },
  { label: t('regex', locale.value), value: "regex" },
  { label: t('isNull', locale.value), value: "is_null" },
  { label: t('isNotNull', locale.value), value: "is_not_null" },
  { label: t('gt', locale.value), value: "gt" },
  { label: t('ge', locale.value), value: "ge" },
  { label: t('lt', locale.value), value: "lt" },
  { label: t('le', locale.value), value: "le" },
  { label: t('between', locale.value), value: "between" }
]);

const logicOptions = computed(() => [
  { label: t('and', locale.value), value: "and" },
  { label: t('or', locale.value), value: "or" }
]);

listen("update-search-rows", (event: Event<number>) => {
  currentRows.value = event.payload;
});
listen("total-search-rows", (event: Event<number>) => {
  totalRows.value = event.payload;
});

watch(columnConfigs, newConfigs => {
  const n = newConfigs.length;
  logics.value = Array(n > 0 ? n - 1 : 0).fill("and");
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

function addColumn() {
  columnConfigs.value.push({
    column: "",
    mode: "equal",
    condition: ""
  });
}

function removeColumn(index: number) {
  columnConfigs.value.splice(index, 1);
}

async function searchData() {
  if (path.value === "") {
    message(t('csvFileNotSelected', locale.value), { type: 'warning' });
    return;
  }
  if (columnConfigs.value.length === 0) {
    message(t('addAtLeastOneFilter', locale.value), { type: 'warning' });
    return;
  }
  if (skiprows.skiprows > 0 && threads.threads !== 1) {
    message(t('threadsOnlySupportSkiprowsZero', locale.value), { type: 'warning' });
    return;
  }

  for (const cfg of columnConfigs.value) {
    if (!cfg.column) {
      message(t('allColumnsMustBeSelected', locale.value), { type: 'warning' });
      return;
    }
  }

  try {
    loading.value = true;
    addLog(`${t('numberOfFilters', locale.value)}: ${columnConfigs.value.length}`, 'info');

    const res: string[] = await invoke("search_chain", {
      path: path.value,
      configs: columnConfigs.value,
      logics: logics.value,
      progress: progress.progress,
      quoting: quoting.quoting,
      flexible: flexible.flexible,
      skiprows: skiprows.skiprows,
      threads: threads.threads
    });

    matchRows.value = Number(res[0]);
    addLog(`${t('matched', locale.value)} ${res[0]} ${t('rows', locale.value)}, ${t('elapsedTime', locale.value)}: ${res[1]} s`, 'success');
  } catch (e) {
    addLog(`${t('searchFailed', locale.value)}: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:filter-3-fill" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('searchChain', locale) }}</h1>
          <p>{{ t('searchChainDesc', locale) }}</p>
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
              <SiliconeButton @click.stop="addColumn()" size="small" type="success">
                <Icon icon="ri:add-line" class="w-4 h-4" />
              </SiliconeButton>
              <SiliconeButton @click.stop="searchData()" :loading="loading" size="small">
                {{ t('run', locale) }}
              </SiliconeButton>
            </div>
          </div>

          <div class="cmd-options-grid mt-4 mb-4">
            <div class="cmd-option-section">
              <div class="cmd-option-label">{{ t('filters', locale) }} ({{ columnConfigs.length }})</div>
              <div class="filters-list">
                <div v-for="(cfg, index) in columnConfigs" :key="index" class="filter-item">
                  <div class="filter-header">
                    <span class="filter-number">#{{ index + 1 }}</span>
                    <SiliconeButton @click.stop="removeColumn(index)" size="small" type="danger">
                      <Icon icon="ri:close-line" class="w-4 h-4" />
                    </SiliconeButton>
                  </div>

                  <div class="flex gap-2 mb-2">
                    <SiliconeSelect v-model="cfg.column" filterable :placeholder="t('column', locale)" size="small" class="flex-1">
                      <el-option v-for="item in tableHeader" :key="item.value" :label="item.label"
                        :value="item.value" />
                    </SiliconeSelect>

                    <SiliconeSelect v-model="cfg.mode" filterable size="small" class="flex-1">
                      <el-option v-for="option in filterModeOptions" :key="option.value" :label="option.label"
                        :value="option.value" />
                    </SiliconeSelect>
                  </div>

                  <SiliconeInput v-model="cfg.condition" :placeholder="t('valueUsePipeForMultiple', locale)" type="textarea"
                    :autosize="{ minRows: 2, maxRows: 2 }" class="w-full mb-2" />

                  <div v-if="index < columnConfigs.length - 1" class="logic-select">
                    <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('logic', locale) }}</div>
                    <SiliconeSelect v-model="logics[index]" :placeholder="t('logic', locale)" size="small" class="w-full">
                      <el-option v-for="option in logicOptions" :key="option.value" :label="option.label"
                        :value="option.value" />
                    </SiliconeSelect>
                  </div>
                </div>

                <div v-if="columnConfigs.length === 0" class="empty-filters">
                  {{ t('clickAddButtonToAddFilters', locale) }}
                </div>
              </div>
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
            <div class="stat-card stat-green">
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

    <SiliconeDialog v-model="dialog" :title="`${t('searchChain', locale)} - ${t('searchChainDesc', locale)}`" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
.filters-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-item {
  background: linear-gradient(145deg, #f5f5f5, #e8e8e8);
  border-radius: 10px;
  padding: 12px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.filter-number {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.logic-select {
  padding-top: 8px;
  border-top: 1px dashed #ddd;
}

.empty-filters {
  text-align: center;
  padding: 24px;
  color: #999;
  font-size: 14px;
}
</style>