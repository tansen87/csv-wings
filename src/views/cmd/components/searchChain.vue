<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
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
import SiliconeSelect from "@/layout/silicone/siliconeSelect.vue";
import { useShortcuts } from "@/utils/globalShortcut";

interface ColumnConfig {
  column: string;
  mode: string;
  condition: string;
}

const columnConfigs = ref<ColumnConfig[]>([]);
const logics = ref<string[]>([]); // 长度 = columnConfigs.length - 1

const path = ref("");
const [currentRows, totalRows, matchRows] = [ref(0), ref(0), ref(0)];
const [dialog, isLoading] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];

const { dynamicHeight } = useDynamicHeight(120);
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
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
}

// 添加/移除列配置
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
    message("CSV file not selected", { type: "warning" });
    return;
  }
  if (columnConfigs.value.length === 0) {
    message("Add at least one column filter", { type: "warning" });
    return;
  }
  if (skiprows.skiprows > 0 && threads.threads !== 1) {
    message("threads only support skiprows = 0", { type: "warning" });
    return;
  }

  // 校验:所有列必须选中
  for (const cfg of columnConfigs.value) {
    if (!cfg.column) {
      message("All columns must be selected", { type: "warning" });
      return;
    }
  }

  try {
    isLoading.value = true;

    const res: string[] = await invoke("search_chain", {
      path: path.value,
      configs: columnConfigs.value, // [{column, mode, condition}, ...]
      logics: logics.value,
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
  } finally {
    isLoading.value = false;
  }
}

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
  [path].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <el-form class="page-view">
    <header
      class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center gap-2">
        <h1
          class="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2"
          @click="dialog = true"
        >
          <Icon icon="ri:filter-3-fill" />
          Search Chain
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400 tracking-wider">
          Multi-condition filter for CSV
        </div>
      </div>

      <div class="flex items-center">
        <SiliconeButton @click="addColumn()" text> Add Filter </SiliconeButton>
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
        class="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4"
      >
        <el-scrollbar class="flex-1 overflow-y-auto mb-4">
          <div
            class="flex items-center justify-between mb-3"
            @click="conditionsCollapsed = !conditionsCollapsed"
          >
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              FILTERS ({{ columnConfigs.length }})
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
            <div
              v-for="(cfg, index) in columnConfigs"
              :key="index"
              class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 relative group"
            >
              <SiliconeTag
                type="danger"
                @click="removeColumn(index)"
                class="absolute -top-0 -right-[-2px] w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100"
              >
                <Icon icon="ri:close-line" class="w-4 h-4" />
              </SiliconeTag>

              <div class="text-[10px] font-semibold text-gray-400 mb-2">
                FILTER #{{ index + 1 }}
              </div>

              <div class="flex gap-2 mb-2">
                <SiliconeSelect
                  v-model="cfg.column"
                  filterable
                  placeholder="Column"
                  size="small"
                >
                  <el-option
                    v-for="item in tableHeader"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </SiliconeSelect>

                <SiliconeSelect v-model="cfg.mode" filterable size="small">
                  <el-option label="equal" value="equal" />
                  <el-option label="not_equal" value="not_equal" />
                  <el-option label="contains" value="contains" />
                  <el-option label="not_contains" value="not_contains" />
                  <el-option label="starts_with" value="starts_with" />
                  <el-option label="ends_with" value="ends_with" />
                  <el-option label="regex" value="regex" />
                  <el-option label="is_null" value="is_null" />
                  <el-option label="is_not_null" value="is_not_null" />
                  <el-option label="gt (>)" value="gt" />
                  <el-option label="ge (≥)" value="ge" />
                  <el-option label="lt (<)" value="lt" />
                  <el-option label="le (≤)" value="le" />
                  <el-option label="between" value="between" />
                </SiliconeSelect>
              </div>

              <SiliconeInput
                v-model="cfg.condition"
                placeholder="Value (use | for multiple)"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 2 }"
              />

              <div
                v-if="index < columnConfigs.length - 1"
                class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600"
              >
                <SiliconeSelect
                  v-model="logics[index]"
                  placeholder="Logic"
                  size="small"
                >
                  <el-option label="AND" value="and" />
                  <el-option label="OR" value="or" />
                </SiliconeSelect>
              </div>
            </div>
          </div>
        </el-scrollbar>

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

        <div class="mt-auto">
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
        </div>
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
      title="Search Chain - Multi condition filter"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
