<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { mdFill, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows
} from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const [fillChar, mode] = [ref("0"), ref("fill")];
const [currentRows, totalRows] = [ref(0), ref(0)];
const modeOptions = [
  { label: "fill", value: "fill" },
  { label: "f-fill", value: "ffill" }
];
const [isLoading, dialog] = [ref(false), ref(false)];
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
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
}

// invoke fill
async function fillData() {
  if (path.value === "") {
    message("File not selected", { type: "warning" });
    return;
  }
  if (columns.value.length === 0) {
    message("Column not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
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
    message(`Fill done, elapsed time: ${rtime} s`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => fillData(),
  onHelp: () => {
    dialog.value = !dialog.value;
  }
});

onUnmounted(() => {
  [columns, path].forEach(r => (r.value = ""));
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
          <Icon icon="ri:rhythm-fill" />
          Fill
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400">
          Fill empty fields in selected columns of a CSV
        </div>
      </div>

      <div class="flex items-center">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File
        </SiliconeButton>
        <SiliconeButton @click="fillData()" :loading="isLoading" text>
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
            FILL MODE
          </label>
          <div class="mode-toggle-v h-8">
            <span
              v-for="item in modeOptions"
              :key="item.value"
              class="mode-item"
              :class="{ active: mode === item.value }"
              @click="mode = item.value"
            >
              {{ item.label }}
            </span>
          </div>
        </div>

        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            COLUMNS ({{ columns.length }})
          </label>
          <SiliconeSelect
            v-model="columns"
            multiple
            filterable
            placeholder="Select columns"
          >
            <el-option
              v-for="item in tableHeader"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </SiliconeSelect>
          <p class="mt-1 text-[10px] text-gray-400">
            Select columns to fill empty values
          </p>
        </div>

        <div v-if="mode === 'fill'" class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            FILL VALUE
          </label>
          <SiliconeTooltip
            content="The value to fill in empty fields"
            placement="right"
          >
            <SiliconeInput
              v-model="fillChar"
              placeholder="Enter fill value"
              class="w-full"
            />
          </SiliconeTooltip>
        </div>

        <div
          class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <div class="flex items-start gap-2">
            <Icon
              icon="ri:information-line"
              class="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0"
            />
            <div class="text-[12px] text-blue-700 dark:text-blue-300">
              <span v-if="mode === 'ffill'">
                Fill empty values with the last non-empty value above
              </span>
              <span v-else-if="mode === 'fill'">
                Fill empty values with the specified value
              </span>
            </div>
          </div>
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

                <div class="relative w-6 h-6 flex items-center justify-center">
                  <Icon
                    v-if="totalRows === 0 || !isFinite(currentRows / totalRows)"
                    icon="ri:scan-line"
                    class="w-6 h-6 text-blue-500"
                  />
                  <SiliconeProgress
                    v-else
                    :percentage="Math.round((currentRows / totalRows) * 100)"
                  />
                </div>
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
                    TODO {{ 0 }}
                  </div>
                  <div class="text-[12px] text-green-600 dark:text-green-400">
                    Filled Cells
                  </div>
                </div>
                <Icon
                  icon="ri:checkbox-circle-line"
                  class="w-6 h-6 text-green-500"
                />
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

        <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-500 dark:text-gray-400">
              Preview ({{ tableData?.length || 0 }} rows)
            </span>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded"
              >
                <Icon icon="ri:rhythm-fill" class="w-3.5 h-3.5" />
                Mode: {{ mode }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-2">
          <SiliconeTable
            :data="tableData"
            :height="'100%'"
            empty-text="No data. (Ctrl+D) to Open File."
            show-overflow-tooltip
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
      title="Fill - Fill empty fields in selected columns of a CSV"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
