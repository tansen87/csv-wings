<script setup lang="ts">
import { ref, reactive, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { mdJoin, useMarkdown } from "@/utils/markdown";
import { useQuoting, useSkiprows } from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const joinType = ref("left");
const [sel1, sel2] = [ref(""), ref("")];
const [dialog, isLoading, nulls] = [ref(false), ref(false), ref(false)];
const nullOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const [
  tableHeader1,
  tableHeader2,
  tableColumn1,
  tableColumn2,
  tableData1,
  tableData2
] = [ref([]), ref([]), ref([]), ref([]), ref([]), ref([])];
const data = reactive({ path1: "", path2: "" });
const { dynamicHeight } = useDynamicHeight(50);
const { mdShow } = useMarkdown(mdJoin);
const quoting = useQuoting();
const skiprows = useSkiprows();

async function selectFile(fileIndex: number) {
  const tableHeader = fileIndex === 1 ? tableHeader1 : tableHeader2;
  const tableColumn = fileIndex === 1 ? tableColumn1 : tableColumn2;
  const tableData = fileIndex === 1 ? tableData1 : tableData2;
  const path = fileIndex === 1 ? "path1" : "path2";

  data[path] = await viewOpenFile(false, "csv", ["*"]);
  if (data[path] === null) {
    data[path] = "";
    return;
  }

  try {
    tableHeader.value = await mapHeaders(data[path], skiprows.skiprows);
    const { columnView, dataView } = await toJson(
      data[path],
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
  } catch (err) {
    message(err.toString(), { type: "error", duration: 10000 });
  }
}

// invoke join
async function joinData() {
  if (data.path1 === "" || data.path2 === "") {
    message("File not selected", { type: "warning" });
    return;
  }
  if (sel1.value.length === 0 || sel2.value.length === 0) {
    message("Column not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const rtime: string = await invoke("join", {
      path1: data.path1,
      path2: data.path2,
      sel1: sel1.value,
      sel2: sel2.value,
      joinType: joinType.value,
      nulls: nulls.value,
      quoting: quoting.quoting
    });
    message(`Join done, elapsed time: ${rtime} s`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}

useShortcuts({
  onRun: () => joinData(),
  onHelp: () => {
    dialog.value = !dialog.value;
  }
});

onUnmounted(() => {
  [sel1, sel2].forEach(r => (r.value = ""));
  [
    tableHeader1,
    tableHeader2,
    tableColumn1,
    tableColumn2,
    tableData1,
    tableData2
  ].forEach(r => (r.value = []));
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
          <Icon icon="ri:merge-cells-horizontal" />
          Join
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400">
          Joins two sets of CSV data on the specified columns
        </div>
      </div>

      <div class="flex items-center gap-2">
        <SiliconeButton @click="joinData()" :loading="isLoading" text>
          Run
        </SiliconeButton>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <aside
        class="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4"
      >
        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            DATA FILES
          </label>
          <div class="grid grid-cols-2 gap-2">
            <SiliconeButton
              @click="selectFile(1)"
              text
              class="p-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              :class="
                data.path1
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                  : ''
              "
            >
              <Icon
                icon="ri:file-text-line"
                class="w-4 h-4 mx-auto mb-1"
                :class="data.path1 ? 'text-green-500' : 'text-gray-400'"
              />
              <span
                :class="
                  data.path1
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-500 dark:text-gray-400'
                "
              >
                {{ data.path1 ? "✓ Loaded" : "Data 1" }}
              </span>
            </SiliconeButton>
            <SiliconeButton
              @click="selectFile(2)"
              text
              class="p-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              :class="
                data.path2
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                  : ''
              "
            >
              <Icon
                icon="ri:file-text-line"
                class="w-4 h-4 mx-auto mb-1"
                :class="data.path2 ? 'text-green-500' : 'text-gray-400'"
              />
              <span
                :class="
                  data.path2
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-500 dark:text-gray-400'
                "
              >
                {{ data.path2 ? "✓ Loaded" : "Data 2" }}
              </span>
            </SiliconeButton>
          </div>
        </div>

        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            JOIN COLUMNS
          </label>
          <div class="space-y-2">
            <div>
              <span
                class="text-[10px] text-gray-500 dark:text-gray-400 block mb-1"
              >
                Data 1 Column
              </span>
              <SiliconeSelect
                v-model="sel1"
                filterable
                placeholder="Select column"
              >
                <el-option
                  v-for="item in tableHeader1"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </SiliconeSelect>
            </div>

            <div>
              <span
                class="text-[10px] text-gray-500 dark:text-gray-400 block mb-1"
                >Data 2 Column
              </span>
              <SiliconeSelect
                v-model="sel2"
                filterable
                placeholder="Select column"
              >
                <el-option
                  v-for="item in tableHeader2"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </SiliconeSelect>
            </div>
          </div>
        </div>

        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            NULL HANDLING
          </label>
          <SiliconeTooltip
            content="When True, joins will work on empty fields"
            placement="top"
          >
            <div class="mode-toggle-v h-8">
              <span
                v-for="item in nullOptions"
                :key="String(item.value)"
                class="mode-item"
                :class="{ active: nulls === item.value }"
                @click="nulls = item.value"
              >
                {{ item.label }}
              </span>
            </div>
          </SiliconeTooltip>
        </div>

        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            JOIN TYPE
          </label>
          <SiliconeSelect v-model="joinType">
            <el-option label="Inner" value="inner" />
            <el-option label="Left" value="left" />
            <el-option label="Right" value="right" />
            <el-option label="Full" value="full" />
            <el-option label="Cross" value="cross" />
            <el-option label="Left Semi" value="left_semi" />
            <el-option label="Left Anti" value="left_anti" />
            <el-option label="Right Semi" value="right_semi" />
            <el-option label="Right Anti" value="right_anti" />
          </SiliconeSelect>
        </div>

        <div
          class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <div class="text-[12px] text-blue-700 dark:text-blue-300">
            <div v-if="joinType === 'inner'">
              Returns only matching rows from both datasets
            </div>
            <div v-else-if="joinType === 'left'">
              Returns all rows from data 1, matched from data 2
            </div>
            <div v-else-if="joinType === 'right'">
              Returns all rows from data 2, matched from data 1
            </div>
            <div v-else-if="joinType === 'full'">
              Returns all rows from both datasets
            </div>
            <div v-else-if="joinType === 'cross'">
              Returns cartesian product of both datasets
            </div>
          </div>
        </div>

        <div
          class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
        >
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider block mb-2"
          >
            CONFIG
          </label>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Data 1:</span>
              <span class="font-mono text-green-600 dark:text-green-400">{{
                sel1 || "-"
              }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Data 2:</span>
              <span class="font-mono text-blue-600 dark:text-blue-400">{{
                sel2 || "-"
              }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Type:</span>
              <span class="font-mono">{{ joinType }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500 dark:text-gray-400">Nulls:</span>
              <span class="font-mono">{{ nulls }}</span>
            </div>
          </div>
        </div>
      </aside>

      <div
        class="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden"
      >
        <div
          class="flex-1 flex flex-col overflow-hidden border-b border-gray-200 dark:border-gray-700"
        >
          <div
            class="px-2 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span
                  class="text-xs font-semibold text-gray-700 dark:text-gray-300"
                  >DATA1</span
                >
                <SiliconeText v-if="data.path1">{{ data.path1 }}</SiliconeText>
              </div>
            </div>
          </div>
          <div class="flex-1 overflow-auto p-2 min-h-0">
            <div
              class="h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <SiliconeTable
                :data="tableData1"
                :height="'100%'"
                empty-text="No data. (Ctrl+D) to Open File."
                show-overflow-tooltip
                class="select-text"
              >
                <el-table-column
                  v-for="column in tableColumn1"
                  :prop="column.prop"
                  :label="column.label"
                  :key="column.prop"
                />
              </SiliconeTable>
            </div>
          </div>
        </div>

        <div class="flex-1 flex flex-col overflow-hidden">
          <div
            class="px-2 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span
                  class="text-xs font-semibold text-gray-700 dark:text-gray-300"
                  >DATA2</span
                >
                <SiliconeText v-if="data.path2">{{ data.path2 }}</SiliconeText>
              </div>
            </div>
          </div>
          <div class="flex-1 overflow-auto p-2 min-h-0">
            <div
              class="h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <SiliconeTable
                :data="tableData2"
                :height="'100%'"
                empty-text="No data. (Ctrl+D) to Open File."
                show-overflow-tooltip
                class="select-text"
              >
                <el-table-column
                  v-for="column in tableColumn2"
                  :prop="column.prop"
                  :label="column.label"
                  :key="column.prop"
                  min-width="100"
                />
              </SiliconeTable>
            </div>
          </div>
        </div>
      </div>
    </main>

    <SiliconeDialog
      v-model="dialog"
      title="Join - Joins two sets of CSV data on the specified columns"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
