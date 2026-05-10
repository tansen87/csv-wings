<script setup lang="ts">
import { onUnmounted, ref } from "vue";
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
} from "@/store/modules/options";
import { message } from "@/utils/message"
import "./common.css";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const mode = ref("equal");
const placeholderText = ref(
  "Search conditions, Separate by |.\nExample: tom|jack|jerry"
);
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
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

// invoke search
async function searchData() {
  if (path.value === "") {
    message("CSV file not selected", { type: 'warning' });
    return;
  }
  if (column.value.length === 0 && mode.value !== "irregular_regex") {
    message("Column not selected", { type: 'warning' });
    return;
  }
  if (
    skiprows.skiprows > 0 &&
    threads.threads !== 1 &&
    mode.value !== "irregular_regex"
  ) {
    message("threads only support skiprows = 0", { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog('Starting search process...', 'info');
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
    addLog(`Match ${res[0]} rows, elapsed time: ${res[1]} s`, 'success');
  } catch (err) {
    addLog(`Search failed: ${err.toString()}`, 'error');
  }
  loading.value = false;
}

interface FilterModeOption {
  label: string;
  value: string;
  description?: string;
}
const filterModeOptions: FilterModeOption[] = [
  // 精确匹配
  { label: "equal", value: "equal" },
  { label: "equal_multi", value: "equal_multi" },
  { label: "not_equal", value: "not_equal" },
  // 包含匹配
  { label: "contains", value: "contains" },
  { label: "contains_multi", value: "contains_multi" },
  { label: "not_contains", value: "not_contains" },
  // 前缀匹配
  { label: "starts_with", value: "starts_with" },
  { label: "starts_with_multi", value: "starts_with_multi" },
  { label: "not_starts_with", value: "not_starts_with" },
  // 后缀匹配
  { label: "ends_with", value: "ends_with" },
  { label: "ends_with_multi", value: "ends_with_multi" },
  { label: "not_ends_with", value: "not_ends_with" },
  // 正则匹配
  { label: "regex", value: "regex" },
  { label: "irregular_regex", value: "irregular_regex" },
  // 空值判�?  { label: "is_null", value: "is_null" },
  { label: "is_not_null", value: "is_not_null" },
  // 数值比�?  { label: "gt(>)", value: "gt" },
  { label: "ge(�?", value: "ge" },
  { label: "lt(<)", value: "lt" },
  { label: "le(�?", value: "le" },
  { label: "between", value: "between" }
];

const unique = ref(false);
const uniqueOpts = [
  { label: "by column", value: true },
  { label: "by input", value: false }
];

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
          <h1>Search</h1>
          <p>Filter rows matching conditions</p>
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
                <span class="cmd-file-prompt">Click to select a CSV file</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="searchData()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="cmd-options-grid mt-4 mb-4">
            <div class="cmd-option-section">
              <div class="cmd-option-label">COLUMN & MODE</div>
              <div class="flex gap-4">
                <div class="flex-1">
                  <SiliconeSelect v-model="column" filterable placeholder="Select column">
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
              <div class="cmd-option-label">CONDITION MODE</div>
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
              <div class="cmd-option-label">CONDITION</div>
              <SiliconeInput v-model="condition" :autosize="{ minRows: 12, maxRows: 12 }" type="textarea"
                :placeholder="placeholderText" class="w-full" />
            </div>
          </div>

          <div class="cmd-stats-grid mt-4" v-if="totalRows > 0">
            <div class="cmd-stat-card">
              <div class="cmd-stat-value">{{ totalRows }}</div>
              <div class="cmd-stat-label">Total</div>
            </div>
            <div class="cmd-stat-card stat-blue">
              <div class="cmd-stat-value">{{ currentRows }}</div>
              <div class="cmd-stat-label">Scanned</div>
              <SiliconeProgress v-if="totalRows > 0 && isFinite(currentRows / totalRows)"
                :percentage="Math.round((currentRows / totalRows) * 100)" class="mt-2" />
            </div>
            <div class="cmd-stat-card stat-green">
              <div class="cmd-stat-value">{{ matchRows }}</div>
              <div class="cmd-stat-label">Matched</div>
            </div>
          </div>

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'350px'" show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  No data. Click above to select file.
                </div>
              </template>
              <el-table-column v-for="column in tableColumn" :prop="column.prop" :label="column.label"
                :key="column.prop" />
            </SiliconeTable>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Search - Filter rows matching conditions" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>
