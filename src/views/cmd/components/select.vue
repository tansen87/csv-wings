<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { CheckboxValueType } from "element-plus";
import { Icon } from "@iconify/vue";
import { message } from "@/utils/message";
import { viewOpenFile, mapHeaders, toJson } from "@/utils/view";
import { useDynamicHeight } from "@/utils/utils";
import { mdSelect, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows
} from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

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

  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    return;
  }

  try {
    originalColumns.value = await mapHeaders(path.value, skiprows.skiprows);
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

// invoke select
async function selectColumns() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }
  if (selColumns.value.length === 0) {
    message("Column not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
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
    message(`Select done, elapsed time: ${rtime} s`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => selectColumns(),
  onHelp: () => {
    dialog.value = !dialog.value;
  }
});

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [originalColumns, tableColumn, tableData].forEach(r => (r.value = []));
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
          <Icon icon="ri:check-double-line" />
          Select
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400">
          Select drop re-order columns
        </div>
      </div>

      <div class="flex items-center">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File
        </SiliconeButton>
        <SiliconeButton @click="selectColumns()" :loading="isLoading" text>
          Run
        </SiliconeButton>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <aside
        class="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4"
      >
        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            SELECTION MODE
          </label>
          <div class="mode-toggle-v h-8">
            <span
              v-for="item in selModeOptions"
              :key="item.value"
              class="mode-item"
              :class="{ active: selMode === item.value }"
              @click="selMode = item.value"
            >
              {{ item.label }}
            </span>
          </div>
        </div>

        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            COLUMNS ({{ selColumns.length }} / {{ originalColumns.length }})
          </label>

          <SiliconeSelect
            v-model="selColumns"
            multiple
            filterable
            placeholder="Select columns"
          >
            <template #header>
              <div class="flex items-center justify-between px-2 py-1">
                <el-checkbox
                  v-model="checkAll"
                  :indeterminate="indeterminate"
                  @change="handleCheckAll"
                  class="text-xs"
                >
                  All
                </el-checkbox>
                <span class="text-xs text-gray-400">
                  {{ selColumns.length }} selected
                </span>
              </div>
            </template>
            <el-option
              v-for="item in originalColumns"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </SiliconeSelect>
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

        <div class="mt-auto">
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-3">
            STATISTICS
          </div>

          <div class="space-y-2">
            <div
              class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-lg font-bold text-gray-800 dark:text-white">
                    {{ originalColumns.length }}
                  </div>
                  <div class="text-[12px] text-gray-500 dark:text-gray-400">
                    Total Columns
                  </div>
                </div>
                <Icon icon="ri:table-line" class="w-6 h-6 text-gray-400" />
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
                    {{ selColumns.length }}
                  </div>
                  <div class="text-[12px] text-blue-600 dark:text-blue-400">
                    Selected Columns
                  </div>
                </div>
                <Icon
                  icon="ri:checkbox-multiple-line"
                  class="w-6 h-6 text-blue-500"
                />
              </div>
            </div>

            <div
              class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-lg font-bold text-gray-800 dark:text-white">
                    {{ totalRows }}
                  </div>
                  <div class="text-[12px] text-gray-500 dark:text-gray-400">
                    Total Rows
                  </div>
                </div>
                <Icon icon="ri:database-line" class="w-6 h-6 text-gray-400" />
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
                    Scanned Rows
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

        <div
          class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-500 dark:text-gray-400">
              Preview ({{ tableData?.length || 0 }} rows)
            </span>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400">
                Mode:
                <span class="font-medium text-gray-600 dark:text-gray-300">
                  {{ selMode }}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-2 min-h-0">
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
      title="Select - Select, drop, re-order columns"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
