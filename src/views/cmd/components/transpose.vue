<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { mdTranspose, useMarkdown } from "@/utils/markdown";
import { useQuoting, useSkiprows } from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const [path, mode] = [ref(""), ref("memory")];
const modeOptions = [
  { label: "Memory", value: "memory" },
  { label: "Multipass", value: "multipass" }
];
const [isLoading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdTranspose);
const quoting = useQuoting();
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

// invoke transpopse
async function transposeData() {
  if (path.value === "") {
    message("File not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const rtime: string = await invoke("transpose", {
      path: path.value,
      mode: mode.value,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows
    });
    message(`Transpose done, elapsed time: ${rtime} s`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => transposeData(),
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
          <Icon icon="ri:loop-left-line" />
          Transpose
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400">
          Transpose rows/columns of a CSV
        </div>
      </div>

      <div class="flex items-center gap-2">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File
        </SiliconeButton>
        <SiliconeButton @click="transposeData()" :loading="isLoading" text>
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
            PROCESS MODE
          </label>
          <SiliconeTooltip
            content="If Memory, the entire file will be read into memory"
            placement="right"
          >
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
          </SiliconeTooltip>
          <p class="mt-1 text-[10px] text-gray-400">
            <span v-if="mode === 'memory'">
              Faster but uses more RAM for large files
            </span>
            <span v-else> Slower but memory-efficient for large files </span>
          </p>
        </div>

        <div
          class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
        >
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider block mb-2"
          >
            BEFORE → AFTER
          </label>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div
                class="font-mono bg-white dark:bg-gray-600 px-2 py-1 rounded mb-1 text-center"
              >
                A B C
              </div>
              <div
                class="font-mono bg-white dark:bg-gray-600 px-2 py-1 rounded mb-1 text-center"
              >
                D E F
              </div>
            </div>
            <div>
              <div
                class="font-mono bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-1 rounded mb-1 text-center"
              >
                A D
              </div>
              <div
                class="font-mono bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-1 rounded mb-1 text-center"
              >
                B E
              </div>
              <div
                class="font-mono bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-1 rounded text-center"
              >
                C F
              </div>
            </div>
          </div>
        </div>

        <div
          class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800"
        >
          <div class="flex items-start gap-2">
            <Icon icon="ri:alert-line" class="w-5 h-5 text-amber-500 mt-0.5" />
            <div class="text-[12px] text-amber-700 dark:text-amber-300">
              Transposing large files may take significant time and memory
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
            <span
              class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded"
            >
              <Icon icon="ri:cpu-line" class="w-3.5 h-3.5" />
              {{ mode }}
            </span>
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
      title="Transpose - Transpose rows/columns of a CSV"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
