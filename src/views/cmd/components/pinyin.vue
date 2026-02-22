<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { mdPinyin, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows
} from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const pinyinStyle = ref("upper");
const pyOptions = [
  { label: "Upper", value: "upper" },
  { label: "Lower", value: "lower" }
];
const [currentRows, totalRows] = [ref(0), ref(0)];
const [columns, path] = [ref(""), ref("")];
const [isLoading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdPinyin);
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

// invoke pinyin
async function chineseToPinyin() {
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
    const rtime: string = await invoke("pinyin", {
      path: path.value,
      columns: cols,
      progress: progress.progress,
      pinyinStyle: pinyinStyle.value,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible
    });
    message(`Convert done, elapsed time: ${rtime} s`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => chineseToPinyin(),
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
          <Icon icon="ri:translate-2" />
          Pinyin
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400">
          Convert Chinese to Pinyin in CSV
        </div>
      </div>

      <div class="flex items-center gap-2">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File
        </SiliconeButton>
        <SiliconeButton @click="chineseToPinyin()" :loading="isLoading" text>
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
            PINYIN STYLE
          </label>
          <div class="mode-toggle-v h-8">
            <span
              v-for="item in pyOptions"
              :key="item.value"
              class="mode-item"
              :class="{ active: pinyinStyle === item.value }"
              @click="pinyinStyle = item.value"
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
            placeholder="Select column(s)"
          >
            <el-option
              v-for="item in tableHeader"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </SiliconeSelect>
          <p class="mt-1 text-[10px] text-gray-400">
            Select columns containing Chinese text
          </p>
        </div>

        <div
          class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <label
            class="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-2"
          >
            STYLE PREVIEW
          </label>
          <div class="space-y-1 text-xs text-blue-700 dark:text-blue-300">
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">中文(Upper)</span>
              <span class="font-mono">ZHONGWEN</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">拼音(Lower)</span>
              <span class="font-mono">pinyin</span>
            </div>
          </div>
        </div>

        <div class="mt-auto">
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-3">
            STATISTICS
          </div>

          <div class="space-y-2">
            <div
              class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div
                    class="text-lg font-bold text-blue-600 dark:text-blue-400"
                  >
                    {{ columns.length }}
                  </div>
                  <div class="text-[12px] text-blue-600 dark:text-blue-400">
                    Selected Columns
                  </div>
                </div>
                <Icon icon="ri:translate-2" class="w-6 h-6 text-blue-500" />
              </div>
            </div>

            <div
              class="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div
                    class="text-lg font-bold text-purple-600 dark:text-purple-400"
                  >
                    {{ pinyinStyle }}
                  </div>
                  <div class="text-[12px] text-purple-600 dark:text-purple-400">
                    Output Style
                  </div>
                </div>
                <Icon icon="ri:font-size" class="w-6 h-6 text-purple-500" />
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
          </div>
        </div>
      </aside>

      <div
        class="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden"
      >
        <div
          v-if="path"
          class="px-2 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        >
          <SiliconeText :max-lines="1">{{ path }}</SiliconeText>
        </div>

        <div
          class="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-500 dark:text-gray-400">
              Preview ({{ tableData?.length || 0 }} rows)
            </span>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded"
              >
                <Icon icon="ri:translate-2" class="w-3.5 h-3.5" />
                {{ columns.length }} columns
              </span>
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded"
              >
                <Icon icon="ri:font-size" class="w-3.5 h-3.5" />
                Style: {{ pinyinStyle }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-2 min-h-0">
          <div
            class="h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
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
      </div>
    </main>

    <SiliconeDialog
      v-model="dialog"
      title="Pinyin - Convert Chinese to Pinyin in CSV"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
