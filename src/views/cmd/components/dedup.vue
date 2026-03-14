<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { mdDedup, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const mode = ref("keep_first");
const modeOptions = [
  { label: "Keep First", value: "keep_first" },
  { label: "Keep Last", value: "keep_last" },
  { label: "Keep Duplicates", value: "keep_duplicates" },
  { label: "Unique", value: "unique" }
];
const sortedOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const [isLoading, dialog, sorted] = [ref(false), ref(false), ref(false)];
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
    return;
  }

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

// Invoke dedup
async function runDedup() {
  if (path.value === "") {
    message("File not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
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
      msg = `Found ${
        json_res.output_rows
      } duplicate rows in ${json_res.elapsed_seconds.toFixed(1)}s`;
    } else {
      msg = `Kept ${
        json_res.output_rows
      } unique rows in ${json_res.elapsed_seconds.toFixed(1)}s`;
    }
    message(msg, { type: "success" });
    outputRows.value = json_res.output_rows;
  } catch (err) {
    message(err.toString(), { type: "error" });
  } finally {
    isLoading.value = false;
  }
}

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => runDedup(),
  onHelp: () => {
    dialog.value = !dialog.value;
  }
});

onUnmounted(() => {
  columns.value = [];
  path.value = "";
  tableHeader.value = [];
  tableColumn.value = [];
  tableData.value = [];
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
          <Icon icon="ri:filter-line" />
          Dedup
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400">
          Remove duplicate rows based on selected columns
        </div>
      </div>

      <div class="flex items-center">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File
        </SiliconeButton>
        <SiliconeButton @click="runDedup()" :loading="isLoading" text>
          Run
        </SiliconeButton>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <aside
        class="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4 max-h-screen overflow-hidden"
      >
        <div class="mb-4 shrink-0">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            DEDUP MODE
          </label>
          <div class="mode-toggle-v h-[60px] w-full">
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

        <div class="mb-4 shrink-0">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            COLUMNS ({{ columns.length }})
          </label>
          <SiliconeSelect
            v-model="columns"
            multiple
            filterable
            placeholder="Select columns (empty = all)"
          >
            <el-option
              v-for="item in tableHeader"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </SiliconeSelect>
          <p class="mt-1 text-[10px] text-gray-400">
            Leave empty to deduplicate on all columns
          </p>
        </div>

        <div class="mb-4 shrink-0">
          <div class="mode-toggle h-[30px] w-full">
            <span
              v-for="item in sortedOptions"
              :key="String(item.value)"
              class="mode-item"
              :class="{ active: sorted === item.value }"
              @click="sorted = item.value"
            >
              {{ item.label }}
            </span>
          </div>
          <p class="mt-1 text-[10px] text-gray-400">
            Enable O(1) memory mode if file is sorted on selected columns
          </p>
        </div>

        <div
          class="mb-4 shrink-0 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <div class="flex items-start gap-2">
            <Icon
              icon="ri:information-line"
              class="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0"
            />
            <div class="text-[12px] text-blue-700 dark:text-blue-300">
              <span v-if="mode === 'keep_first'">
                Keep the first occurrence of each duplicate group.
              </span>
              <span v-else-if="mode === 'keep_last'">
                Keep the last occurrence of each duplicate group.
              </span>
              <span v-else-if="mode === 'keep_duplicates'">
                Output only the rows that are duplicates.
              </span>
              <span v-else-if="mode === 'unique'"> Get unique values </span>
            </div>
          </div>
        </div>

        <el-scrollbar class="mt-auto overflow-y-auto pb-2">
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-3">
            STATISTICS
          </div>
          <div class="space-y-2">
            <div
              class="p-2 rounded-lg border"
              :class="{
                'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800':
                  mode !== 'keep_duplicates',
                'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800':
                  mode === 'keep_duplicates'
              }"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div
                    class="text-lg font-bold"
                    :class="{
                      'text-green-600 dark:text-green-400':
                        mode !== 'keep_duplicates',
                      'text-orange-600 dark:text-orange-400':
                        mode === 'keep_duplicates'
                    }"
                  >
                    {{ outputRows }}
                  </div>
                  <div
                    class="text-[12px]"
                    :class="{
                      'text-green-600 dark:text-green-400':
                        mode !== 'keep_duplicates',
                      'text-orange-600 dark:text-orange-400':
                        mode === 'keep_duplicates'
                    }"
                  >
                    {{
                      mode === "keep_duplicates"
                        ? "Duplicate Rows"
                        : "Unique Rows Kept"
                    }}
                  </div>
                </div>
                <Icon
                  icon="ri:file-list-line"
                  class="w-6 h-6"
                  :class="{
                    'text-green-500': mode !== 'keep_duplicates',
                    'text-orange-500': mode === 'keep_duplicates'
                  }"
                />
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

        <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-500 dark:text-gray-400">
              Preview ({{ tableData?.length || 0 }} rows)
            </span>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded"
              >
                <Icon icon="ri:filter-line" class="w-3.5 h-3.5" />
                Mode: {{ modeOptions.find(m => m.value === mode)?.label }}
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
      title="Dedup - Remove duplicate rows based on selected columns"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
