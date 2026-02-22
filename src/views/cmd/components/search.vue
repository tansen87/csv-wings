<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { message } from "@/utils/message";
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
import { useShortcuts } from "@/utils/globalShortcut";

const mode = ref("equal");
const placeholderText = ref(
  "Search conditions, Separate by |.\nExample: tom|jack|jerry"
);
const [currentRows, totalRows, matchRows] = [ref(0), ref(0), ref(0)];
const [column, path, condition] = [ref(""), ref(""), ref("")];
const [dialog, isLoading] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(121);
const { mdShow } = useMarkdown(mdSearch);
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();
const threads = useThreads();

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
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
}

// invoke search
async function searchData() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }
  if (column.value.length === 0 && mode.value !== "irregular_regex") {
    message("Column not selected", { type: "warning" });
    return;
  }
  if (
    skiprows.skiprows > 0 &&
    threads.threads !== 1 &&
    mode.value !== "irregular_regex"
  ) {
    message("threads only support skiprows = 0", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const res: string[] = await invoke("search", {
      path: path.value,
      column: column.value,
      mode: mode.value,
      condition: condition.value,
      progress: progress.progress,
      quoting: quoting.quoting,
      flexible: flexible.flexible,
      skiprows: skiprows.skiprows,
      threads: threads.threads
    });
    matchRows.value = Number(res[0]);
    message(`Match ${res[0]} rows, elapsed time: ${res[1]} s`, {
      type: "success"
    });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
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
  // 空值判断
  { label: "is_null", value: "is_null" },
  { label: "is_not_null", value: "is_not_null" },
  // 数值比较
  { label: "gt(>)", value: "gt" },
  { label: "ge(≥)", value: "ge" },
  { label: "lt(<)", value: "lt" },
  { label: "le(≤)", value: "le" },
  { label: "between", value: "between" }
];

const conditionsCollapsed = ref(false);
const statisticsCollapsed = ref(false);

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => searchData(),
  onHelp: () => {
    dialog.value = !dialog.value;
  }
});

onUnmounted(() => {
  [column, path, condition].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <el-form class="page-view">
    <header
      class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center gap-4">
        <h1
          class="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2"
          @click="dialog = true"
        >
          <Icon icon="ri:filter-2-line" />
          Search
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400 tracking-wider">
          Filter rows matching conditions
        </div>
      </div>

      <div class="flex items-center gap-2">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File
        </SiliconeButton>
        <SiliconeButton @click="searchData()" :loading="isLoading" text>
          Run
        </SiliconeButton>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <aside
        class="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4 min-w-[280px]"
      >
        <div class="mb-4">
          <div
            class="flex items-center justify-between cursor-pointer mb-3"
            @click="conditionsCollapsed = !conditionsCollapsed"
          >
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              CONDITIONS
            </div>
            <Icon
              :icon="
                conditionsCollapsed
                  ? 'ri:arrow-down-s-line'
                  : 'ri:arrow-up-s-line'
              "
              class="text-gray-400"
            />
          </div>

          <div v-show="!conditionsCollapsed" class="space-y-3">
            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-500 dark:text-gray-400"
                >Column</label
              >
              <SiliconeSelect
                v-model="column"
                filterable
                placeholder="Select column"
              >
                <el-option
                  v-for="item in tableHeader"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </SiliconeSelect>
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-500 dark:text-gray-400">
                Mode
              </label>
              <SiliconeSelect v-model="mode" filterable>
                <el-option
                  v-for="option in filterModeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </SiliconeSelect>
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-xs text-gray-500 dark:text-gray-400">
                Condition
              </label>
              <SiliconeInput
                v-model="condition"
                :autosize="{ minRows: 4, maxRows: 4 }"
                type="textarea"
                :placeholder="placeholderText"
              />
            </div>
          </div>
        </div>

        <div
          v-if="totalRows !== 0 && isFinite(currentRows / totalRows)"
          class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs text-gray-500 dark:text-gray-400">Progress</div>
          </div>
          <SiliconeProgress
            :percentage="Math.round((currentRows / totalRows) * 100)"
          />
        </div>

        <el-scrollbar min-size="1" class="mt-auto overflow-y-auto">
          <div
            class="flex items-center justify-between cursor-pointer mb-3"
            @click="statisticsCollapsed = !statisticsCollapsed"
          >
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              STATISTICS
            </div>
            <Icon
              :icon="
                statisticsCollapsed
                  ? 'ri:arrow-down-s-line'
                  : 'ri:arrow-up-s-line'
              "
              class="text-gray-400"
            />
          </div>

          <div v-show="!statisticsCollapsed" class="space-y-2">
            <div
              class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-lg font-bold text-gray-800 dark:text-white">
                    {{ totalRows }}
                  </div>
                  <div class="text-[12px] text-gray-500 dark:text-gray-400">
                    Total
                  </div>
                </div>
                <Icon icon="ri:database-line" class="w-6 h-6 text-gray-400" />
              </div>
            </div>

            <div
              class="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div
                    class="text-lg font-bold text-green-600 dark:text-green-400"
                  >
                    {{ matchRows }}
                  </div>
                  <div class="text-[12px] text-green-600 dark:text-green-400">
                    Matched
                  </div>
                </div>
                <Icon
                  icon="ri:checkbox-circle-line"
                  class="w-6 h-6 text-green-500"
                />
              </div>
            </div>

            <div
              class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div
                    class="text-lg font-bold text-blue-600 dark:text-blue-400"
                  >
                    {{ currentRows }}
                  </div>
                  <div class="text-[12px] text-blue-600 dark:text-blue-400">
                    Scanned
                  </div>
                </div>
                <Icon icon="ri:scan-line" class="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>
        </el-scrollbar>
      </aside>

      <div
        class="flex-1 bg-white dark:bg-gray-800 flex flex-col overflow-hidden"
      >
        <div
          v-if="path"
          class="px-2 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600"
        >
          <SiliconeText :max-lines="1">{{ path }}</SiliconeText>
        </div>

        <div class="flex-1 overflow-auto p-2">
          <SiliconeTable
            :data="tableData"
            :height="'100%'"
            empty-text="No data. (Ctrl+D) to Open File."
            show-overflow-tooltip
            :cell-style="{
              borderBottom: '1px solid #f0f0f0'
            }"
            class="select-text"
          >
            <el-table-column
              v-for="column in tableColumn"
              :prop="column.prop"
              :label="column.label"
              :key="column.prop"
            />
          </SiliconeTable>
        </div>
      </div>
    </main>

    <SiliconeDialog
      v-model="dialog"
      title="Search - Filter rows matching conditions"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
