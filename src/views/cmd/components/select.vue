<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { CheckboxValueType } from "element-plus";
import { Icon } from "@iconify/vue";
import { viewOpenFile, mapHeaders, toJson } from "@/utils/view";
import { useDynamicHeight } from "@/utils/utils";
import { mdSelect, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows
} from "@/store/modules/setting";
import "./common.css";
import { message } from "@/utils/message";
import { useLocale, t } from "@/store/modules/locale";
import { storeToRefs } from "pinia";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const localeStore = useLocale();
const { locale } = storeToRefs(localeStore);

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Select] ${msg}`, type);
};

const path = ref("");
const [currentRows, totalRows] = [ref(0), ref(0)];
const selMode = ref("include");
const selModeOptions = computed(() => [
  { label: t('include', locale.value), value: "include" },
  { label: t('exclude', locale.value), value: "exclude" }
]);
const [originalColumns, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const [isLoading, dialog, checkAll, indeterminate] = [
  ref(false),
  ref(false),
  ref(false),
  ref(false)
];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdSelect);
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();
const selColumns = ref<CheckboxValueType[]>([]);

watch(selColumns, val => {
  if (val.length === 0) {
    checkAll.value = false;
    indeterminate.value = false;
  } else if (val.length === originalColumns.value.length) {
    checkAll.value = true;
    indeterminate.value = false;
  } else {
    indeterminate.value = true;
  }
});

const handleCheckAll = (val: CheckboxValueType) => {
  indeterminate.value = false;
  if (val) {
    selColumns.value = originalColumns.value.map(_ => _.value);
  } else {
    selColumns.value = [];
  }
};

listen("update-rows", (event: Event<number>) => {
  currentRows.value = event.payload;
});
listen("total-rows", (event: Event<number>) => {
  totalRows.value = event.payload;
});

async function selectFile() {
  originalColumns.value = [];
  totalRows.value = 0;
  selColumns.value = [];

  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    return;
  }

  try {
    originalColumns.value = await mapHeaders(path.value, skiprows.skiprows);
    selColumns.value = originalColumns.value.map(col => col.value);
    const { dataView } = await toJson(path.value, skiprows.skiprows);
    tableData.value = dataView;
  } catch (e) {
    addLog(`${t('failedToLoadFile', locale.value)}: ${e}`, 'error');
  }
}

async function selectColumns() {
  if (path.value === "") {
    message(t('csvFileNotSelected', locale.value), { type: 'warning' });
    return;
  }
  if (selColumns.value.length === 0) {
    message(t('columnNotSelected', locale.value), { type: 'warning' });
    return;
  }

  try {
    isLoading.value = true;
    const selectedCount = selColumns.value.length;
    const totalCount = originalColumns.value.length;
    addLog(`${t('startingSelect', locale.value)}: ${selMode.value} ${selectedCount} ${t('of', locale.value)} ${totalCount} ${t('columns', locale.value)}`, 'info');

    const selCols = Object.values(selColumns.value).join("|");
    const rtime: string = await invoke("select", {
      path: path.value,
      selCols: selCols,
      selMode: selMode.value,
      progress: progress.progress,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible
    });
    addLog(`${t('selectDone', locale.value)}, ${t('elapsedTime', locale.value)}: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`${t('selectFailed', locale.value)}: ${e}`, 'error');
  }
  isLoading.value = false;
}

const displayedColumns = computed(() => {
  if (selMode.value === "include") {
    const colMap = new Map(originalColumns.value.map(col => [col.value, col]));
    return selColumns.value.map(val => colMap.get(val)).filter(Boolean);
  } else {
    const excludedSet = new Set(selColumns.value);
    return originalColumns.value.filter(col => !excludedSet.has(col.value));
  }
});

const displayedTableData = computed(() => {
  const cols = displayedColumns.value;
  if (cols.length === 0) return [];

  const props = cols.map(col => col.value);
  return tableData.value.map(row => {
    const newRow: Record<string, any> = {};
    for (const prop of props) {
      newRow[prop] = row[prop];
    }
    return newRow;
  });
});

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [originalColumns, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:check-double-line" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('select', locale) }}</h1>
          <p>{{ t('selectDesc', locale) }}</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="select-main">
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
              <SiliconeButton @click.stop="selectColumns()" :loading="isLoading" size="small">
                {{ t('run', locale) }}
              </SiliconeButton>
            </div>
          </div>

          <div class="flex justify-center">
            <div class="cmd-mode-toggle py-1">
              <span v-for="item in selModeOptions" :key="item.value" class="cmd-mode-item mx-0.5 w-24"
                :class="{ active: selMode === item.value }" @click="selMode = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <div class="cmd-options-grid mt-4 mb-4">
            <div class="cmd-option-section">
              <div class="cmd-option-label">{{ t('columns', locale) }} ({{ selColumns.length }} / {{ originalColumns.length }})</div>
              <SiliconeSelect v-model="selColumns" multiple filterable :placeholder="t('selectColumns', locale)" class="w-full">
                <template #header>
                  <div class="flex items-center justify-between px-2 py-1">
                    <el-checkbox v-model="checkAll" :indeterminate="indeterminate" @change="handleCheckAll"
                      class="text-xs">
                      {{ t('all', locale) }}
                    </el-checkbox>
                    <span class="text-xs text-gray-400">
                      {{ selColumns.length }} {{ t('selected', locale) }}
                    </span>
                  </div>
                </template>
                <el-option v-for="item in originalColumns" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
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
            <span class="cmd-mode-badge">{{ t('mode', locale) }}: {{ selMode === 'include' ? t('include', locale) : t('exclude', locale) }}</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="displayedTableData" :height="'350px'" show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  {{ t('noData', locale) }}
                </div>
              </template>
              <el-table-column v-for="column in displayedColumns" :key="column.value" :prop="column.value"
                :label="column.label" />
            </SiliconeTable>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" :title="`${t('select', locale)} - ${t('selectDesc', locale)}`" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
.cmd-stat-card.cmd-stat-blue .cmd-stat-value {
  color: #409eff;
}
</style>