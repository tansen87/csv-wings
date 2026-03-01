<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { mdSlice, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const mode = ref("lines");
const modeOptions = [
  { label: "Lines", value: "lines" },
  { label: "Index", value: "index" }
];
const [path, start, end] = [ref(""), ref("1"), ref("10")];
const [isLoading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdSlice);
const quoting = useQuoting();
const flexible = useFlexible();
const skiprows = useSkiprows();

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

// invoke slice
async function sliceData() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const rtime: string = await invoke("slice", {
      path: path.value,
      quoting: quoting.quoting,
      flexible: flexible.flexible,
      start: start.value,
      end: end.value,
      skiprows: skiprows.skiprows,
      mode: mode.value
    });
    message(`Slice done, elapsed time: ${rtime} s`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => sliceData(),
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
      <div class="flex items-center gap-4">
        <h1
          class="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2"
          @click="dialog = true"
        >
          <Icon icon="ri:crop-line" />
          Slice
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400">
          Returns rows of a CSV file in the specified range
        </div>
      </div>

      <div class="flex items-center">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File
        </SiliconeButton>
        <SiliconeButton @click="sliceData()" :loading="isLoading" text>
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
            SLICE MODE
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
            ROW RANGE
          </label>

          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span
                class="text-sm text-gray-600 dark:text-gray-300 w-12 shrink-0"
              >
                Start
              </span>
              <SiliconeInput
                v-model="start"
                placeholder="Start (e.g. 0)"
                class="flex-1"
              />
            </div>

            <div class="flex items-center gap-2">
              <span
                class="text-sm text-gray-600 dark:text-gray-300 w-12 shrink-0"
              >
                End
              </span>
              <SiliconeInput
                v-model="end"
                placeholder="End (e.g. 100)"
                class="flex-1"
              />
            </div>
          </div>
        </div>

        <div
          v-if="start || end"
          class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <div class="flex items-center gap-2">
            <Icon icon="ri:brackets-line" class="w-5 h-5 text-blue-500" />
            <span class="text-xs text-blue-700 dark:text-blue-300">
              Range: <span class="font-mono">{{ start || 0 }}</span> to
              <span class="font-mono">{{ end || "end" }}</span>
            </span>
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
                    {{ parseInt(end) - parseInt(start) }}
                  </div>
                  <div class="text-[12px] text-blue-600 dark:text-blue-400">
                    Sliced Rows
                  </div>
                </div>
                <Icon icon="ri:crop-line" class="w-6 h-6 text-blue-500" />
              </div>
            </div>

            <div
              class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-lg font-bold text-gray-800 dark:text-white">
                    TODO
                  </div>
                  <div class="text-[12px] text-gray-500 dark:text-gray-400">
                    Total Rows
                  </div>
                </div>
                <Icon icon="ri:database-line" class="w-6 h-6 text-gray-400" />
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
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded"
              >
                <Icon icon="ri:crop-line" class="w-3.5 h-3.5" />
                {{ start || 0 }} - {{ end || "end" }}
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
      title="Slice - Returns rows of a CSV file in the specified range"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
