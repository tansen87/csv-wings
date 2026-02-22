<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdStr, useMarkdown } from "@/utils/markdown";
import { message } from "@/utils/message";
import { useQuoting, useSkiprows } from "@/store/modules/options";
import { useProgress } from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const [column, path] = [ref(""), ref("")];
const [n, length, by, activeTab] = [ref("4"), ref("5"), ref("-"), ref("left")];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const [isLoading, dialog, reverse] = [ref(false), ref(false), ref(false)];
const [currentRows, totalRows] = [ref(0), ref(0)];
const reverseOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const modeOptions = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Slice", value: "slice" },
  { label: "SplitN", value: "split_n" },
  { label: "SplitMax", value: "split_max" },
  { label: "PadLeft", value: "pad_left" },
  { label: "PadRight", value: "pad_right" },
  { label: "PadBoth", value: "pad_both" }
];
const { dynamicHeight } = useDynamicHeight(120);
const quoting = useQuoting();
const progress = useProgress();
const skiprows = useSkiprows();

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

// invoke str_slice, str_split, str_pad
async function StrData() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }
  if (column.value.length === 0) {
    message("Column not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    let rtime: string;
    if (["left", "right", "slice"].includes(activeTab.value)) {
      rtime = await invoke("str_slice", {
        path: path.value,
        column: column.value,
        n: n.value,
        length: length.value,
        reverse: reverse.value,
        mode: activeTab.value,
        quoting: quoting.quoting,
        progress: progress.progress,
        skiprows: skiprows.skiprows
      });
    }
    if (["split_n", "split_max"].includes(activeTab.value)) {
      rtime = await invoke("str_split", {
        path: path.value,
        column: column.value,
        n: n.value,
        by: by.value,
        mode: activeTab.value,
        quoting: quoting.quoting,
        progress: progress.progress,
        skiprows: skiprows.skiprows
      });
    }
    if (["pad_left", "pad_right", "pad_both"].includes(activeTab.value)) {
      rtime = await invoke("str_pad", {
        path: path.value,
        column: column.value,
        length: length.value,
        fillChar: by.value,
        mode: activeTab.value,
        quoting: quoting.quoting,
        progress: progress.progress,
        skiprows: skiprows.skiprows
      });
    }
    message(`${activeTab.value} done, elapsed time: ${rtime} s`, {
      type: "success"
    });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}

const { mdShow } = useMarkdown(mdStr);

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => StrData(),
  onHelp: () => {
    dialog.value = !dialog.value;
  }
});

onUnmounted(() => {
  [path, column].forEach(r => (r.value = ""));
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
          <Icon icon="ri:text" />
          String
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400">
          String expr: slice, split, pad...
        </div>
      </div>

      <div class="flex items-center gap-2">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File
        </SiliconeButton>
        <SiliconeButton @click="StrData()" :loading="isLoading" text>
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
            OPERATION
          </label>
          <div class="mode-toggle-v h-28">
            <span
              v-for="item in modeOptions"
              :key="item.value"
              class="mode-item"
              :class="{ active: activeTab === item.value }"
              @click="activeTab = item.value"
            >
              {{ item.label }}
            </span>
          </div>
        </div>

        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            TARGET COLUMN
          </label>
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

        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            REVERSE
          </label>
          <SiliconeTooltip
            content="Reverse the result or not"
            placement="right"
          >
            <div class="mode-toggle-v h-8">
              <span
                v-for="item in reverseOptions"
                :key="String(item.value)"
                class="mode-item"
                :class="{ active: reverse === item.value }"
                @click="reverse = item.value"
              >
                {{ item.label }}
              </span>
            </div>
          </SiliconeTooltip>
        </div>

        <div class="mb-4 space-y-3">
          <div
            v-if="
              ['left', 'right', 'slice', 'split_n', 'split_max'].includes(
                activeTab
              )
            "
          >
            <label
              class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
            >
              {{ activeTab === "slice" ? "START INDEX" : "N VALUE" }}
            </label>
            <SiliconeInput
              v-model="n"
              :placeholder="activeTab === 'slice' ? 'e.g. 0' : 'e.g. 10'"
              size="small"
            />
          </div>

          <div
            v-if="
              ['slice', 'pad_left', 'pad_right', 'pad_both'].includes(activeTab)
            "
          >
            <label
              class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
            >
              {{ activeTab === "slice" ? "LENGTH" : "PAD LENGTH" }}
            </label>
            <SiliconeInput
              v-model="length"
              :placeholder="activeTab === 'slice' ? 'e.g. 5' : 'e.g. 20'"
              type="number"
              size="small"
            />
          </div>

          <div
            v-if="
              [
                'split_n',
                'split_max',
                'pad_left',
                'pad_right',
                'pad_both'
              ].includes(activeTab)
            "
          >
            <label
              class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
            >
              {{ activeTab.includes("split") ? "SPLIT BY" : "PAD CHAR" }}
            </label>
            <SiliconeInput
              v-model="by"
              :placeholder="activeTab.includes('split') ? 'e.g. ,' : 'e.g. 0'"
              size="small"
            />
          </div>
        </div>

        <div
          class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <label
            class="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-2"
          >
            CONFIG
          </label>
          <div class="space-y-1 text-xs text-blue-700 dark:text-blue-300">
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Operation:</span>
              <span class="font-mono">{{ activeTab }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Column:</span>
              <span class="font-mono">{{ column || "-" }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Reverse:</span>
              <span class="font-mono">{{ reverse }}</span>
            </div>
            <div v-if="n" class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">N:</span>
              <span class="font-mono">{{ n }}</span>
            </div>
            <div v-if="length" class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Length:</span>
              <span class="font-mono">{{ length }}</span>
            </div>
            <div v-if="by" class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">By:</span>
              <span class="font-mono">{{ by }}</span>
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
          </div>
        </div>
      </aside>

      <div
        class="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden"
      >
        <div
          v-if="path"
          class="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
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
                <Icon icon="ri:text" class="w-3.5 h-3.5" />
                {{ activeTab }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-2">
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
      title="String - String expr: slice, split, pad..."
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
