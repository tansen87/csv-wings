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
} from "@/store/modules/options";
import "./common.css";
import { message } from "@/utils/message";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Select] ${msg}`, type);
};

const path = ref("");
const [currentRows, totalRows] = [ref(0), ref(0)];
const selMode = ref("include");
const selModeOptions = [
  { label: "Include", value: "include" },
  { label: "Exclude", value: "exclude" }
];
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
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

// invoke select
async function selectColumns() {
  if (path.value === "") {
    message("CSV file not selected", { type: 'warning' });
    return;
  }
  if (selColumns.value.length === 0) {
    message("Column not selected", { type: 'warning' });
    return;
  }

  try {
    isLoading.value = true;
    const selectedCount = selColumns.value.length;
    const totalCount = originalColumns.value.length;
    addLog(`Starting select operation: ${selMode.value} ${selectedCount} of ${totalCount} columns`, 'info');

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
    addLog(`Select done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Select failed: ${e}`, 'error');
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
          <h1>Select</h1>
          <p>Select, drop, re-order columns</p>
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
                <span class="cmd-file-prompt">Click to select a CSV file</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="selectColumns()" :loading="isLoading" size="small">
                Run
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
              <div class="cmd-option-label">COLUMNS ({{ selColumns.length }} / {{ originalColumns.length }})</div>
              <SiliconeSelect v-model="selColumns" multiple filterable placeholder="Select columns" class="w-full">
                <template #header>
                  <div class="flex items-center justify-between px-2 py-1">
                    <el-checkbox v-model="checkAll" :indeterminate="indeterminate" @change="handleCheckAll"
                      class="text-xs">
                      All
                    </el-checkbox>
                    <span class="text-xs text-gray-400">
                      {{ selColumns.length }} selected
                    </span>
                  </div>
                </template>
                <el-option v-for="item in originalColumns" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>
          </div>

          <div class="cmd-stats-grid mt-4" v-if="totalRows > 0">
            <div class="cmd-stat-card">
              <div class="cmd-stat-label">Total Rows</div>
              <div class="cmd-stat-value">{{ totalRows }}</div>
            </div>
            <div class="cmd-stat-card cmd-stat-blue">
              <div class="cmd-stat-label">Progress</div>
              <SiliconeProgress v-if="totalRows > 0 && isFinite(currentRows / totalRows)"
                :percentage="Math.round((currentRows / totalRows) * 100)" class="mt-2" />
            </div>
          </div>

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
            <span class="cmd-mode-badge">Mode: {{ selMode }}</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="displayedTableData" :height="'350px'" show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  No data. Click above to select file.
                </div>
              </template>
              <el-table-column v-for="column in displayedColumns" :key="column.value" :prop="column.value"
                :label="column.label" />
            </SiliconeTable>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Select - Select, drop, re-order columns" width="70%">
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