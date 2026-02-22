<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { CheckboxValueType } from "element-plus";
import { mdApply, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useQuoting,
  useSkiprows,
  useThreads
} from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const [
  isLoading,
  checkAll,
  indeterminate,
  newColumn,
  dialog,
  backendCompleted
] = [ref(false), ref(false), ref(false), ref(false), ref(false), ref(false)];
const [operations, tableHeader, tableColumn, tableData] = [
  ref([]),
  ref([]),
  ref([]),
  ref([])
];
const [path, comparand, replacement, formatstr, backendInfo] = [
  ref(""),
  ref(""),
  ref(""),
  ref(""),
  ref("")
];
const mode = ref("operations");
const modeOptions = [
  { label: "Operations", value: "operations" },
  { label: "CalcConv", value: "calcconv" },
  { label: "DynFmt", value: "cat" }
];
const placeholderText = ref("format str... \nExample: {col1} + {col2}");
const columnContent = ref("no column");
const columns = ref<CheckboxValueType[]>([]);
const { dynamicHeight } = useDynamicHeight(120);
watch(columns, val => {
  if (val.length === 0) {
    checkAll.value = false;
    indeterminate.value = false;
  } else if (val.length === tableHeader.value.length) {
    checkAll.value = true;
    indeterminate.value = false;
  } else {
    indeterminate.value = true;
  }
});
const handleCheckAll = (val: CheckboxValueType) => {
  indeterminate.value = false;
  if (val) {
    columns.value = tableHeader.value.map(_ => _.value);
  } else {
    columns.value = [];
  }
};
const { mdShow } = useMarkdown(mdApply);
const quoting = useQuoting();
const skiprows = useSkiprows();
const flexible = useFlexible();
const threads = useThreads();

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    return;
  }

  backendCompleted.value = false;
  backendInfo.value = "";

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

// invoke apply
async function applyData() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }

  let finalColumns = [...columns.value];
  if (
    (mode.value === "cat" || mode.value === "calcconv") &&
    finalColumns.length === 0 &&
    tableHeader.value.length > 0
  ) {
    finalColumns = [tableHeader.value[0].value];
  }

  if (mode.value === "operations" && finalColumns.length === 0) {
    message("Column not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const result: string = await invoke("apply", {
      path: path.value,
      columns: finalColumns.join("|"),
      mode: mode.value,
      operations: operations.value.join("|"),
      comparand: comparand.value,
      replacement: replacement.value,
      formatstr: formatstr.value,
      newColumn: newColumn.value,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible,
      threads: threads.threads
    });
    backendCompleted.value = true;
    backendInfo.value = `Apply done, elapsed time: ${result} s`;
    message(backendInfo.value, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}

function addNewColumn() {
  if (mode.value === "cat" || mode.value === "calcconv") {
    newColumn.value = true;
    return;
  }
  newColumn.value = !newColumn.value;
  columnContent.value = newColumn.value ? "add column" : "no column";
}

watch(mode, newMode => {
  if (newMode === "cat" || newMode === "calcconv") {
    newColumn.value = true;
    columnContent.value = "add column";
  } else {
    columnContent.value = newColumn.value ? "add column" : "no column";
  }
});

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => applyData(),
  onHelp: () => {
    dialog.value = !dialog.value;
  }
});

onUnmounted(() => {
  [path, comparand, replacement, formatstr, backendInfo].forEach(
    r => (r.value = "")
  );
  [operations, tableHeader, tableColumn, tableData].forEach(
    r => (r.value = [])
  );
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
          <Icon icon="ri:function-line" />
          Apply
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400">
          Apply transformation functions to CSV column(s)
        </div>
      </div>

      <div class="flex items-center">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File
        </SiliconeButton>
        <SiliconeButton @click="applyData()" :loading="isLoading" text>
          Run
        </SiliconeButton>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <aside
        class="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4"
      >
        <SiliconeTag
          @click="addNewColumn"
          :disabled="mode === 'cat' || mode === 'calcconv'"
          text
        >
          {{ columnContent }}
        </SiliconeTag>

        <div class="mb-3 mt-3">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            MODE
          </label>
          <div class="mode-toggle h-8 w-full">
            <div
              v-for="item in modeOptions"
              :key="item.value"
              class="mode-item"
              :class="{ active: mode === item.value }"
              @click="mode = item.value"
            >
              {{ item.label }}
            </div>
          </div>
        </div>

        <template v-if="mode === 'operations'">
          <div class="mb-3">
            <label
              class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
            >
              COLUMNS
            </label>
            <SiliconeSelect
              v-model="columns"
              filterable
              multiple
              placeholder="Select column(s)"
            >
              <template #header>
                <div class="flex items-center justify-between px-2 py-1">
                  <el-checkbox
                    v-model="checkAll"
                    :indeterminate="indeterminate"
                    @change="handleCheckAll"
                  >
                    All
                  </el-checkbox>
                  <span class="text-xs text-gray-400">
                    {{ columns.length }} selected
                  </span>
                </div>
              </template>
              <el-option
                v-for="item in tableHeader"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </SiliconeSelect>
          </div>

          <div class="mb-3">
            <label
              class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
            >
              OPERATIONS ({{ operations.length }})
            </label>
            <SiliconeSelect
              v-model="operations"
              filterable
              multiple
              placeholder="Select operations"
            >
              <el-option label="Copy" value="copy" />
              <el-option label="Len" value="len" />
              <el-option label="Lower" value="lower" />
              <el-option label="Upper" value="upper" />
              <el-option label="Trim" value="trim" />
              <el-option label="Ltrim" value="ltrim" />
              <el-option label="Rtrim" value="rtrim" />
              <el-option label="Replace" value="replace" />
              <el-option label="Round" value="round" />
              <el-option label="Squeeze" value="squeeze" />
              <el-option label="Strip" value="strip" />
              <el-option label="Reverse" value="reverse" />
              <el-option label="Abs" value="abs" />
              <el-option label="Neg" value="neg" />
              <el-option label="Normalize" value="normalize" />
            </SiliconeSelect>
          </div>

          <template v-if="operations.includes('replace')">
            <div
              class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <label
                class="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-2"
              >
                REPLACE OPTIONS
              </label>
              <div class="space-y-2">
                <SiliconeInput
                  v-model="comparand"
                  placeholder="Find (old)"
                  size="small"
                />
                <SiliconeInput
                  v-model="replacement"
                  placeholder="Replace with (new)"
                  size="small"
                />
              </div>
            </div>
          </template>
        </template>

        <template v-if="['cat', 'calcconv'].includes(mode)">
          <div class="flex-1 flex flex-col min-h-0">
            <label
              class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
            >
              FORMULA / FORMAT
            </label>
            <SiliconeInput
              v-model="formatstr"
              :autosize="{ minRows: 10, maxRows: 12 }"
              type="textarea"
              :placeholder="placeholderText"
              class="flex-1 font-mono text-sm"
            />
          </div>
        </template>

        <div
          v-if="backendCompleted"
          class="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
        >
          <div class="flex items-center gap-2">
            <Icon icon="ri:check-circle-line" class="w-4 h-4 text-green-500" />
            <span class="text-xs text-green-700 dark:text-green-300">
              {{ backendInfo }}
            </span>
          </div>
        </div>

        <div class="mt-auto pt-4">
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
                    Columns
                  </div>
                </div>
                <Icon icon="ri:table-line" class="w-6 h-6 text-blue-500" />
              </div>
            </div>

            <div
              v-if="mode === 'operations'"
              class="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div
                    class="text-lg font-bold text-purple-600 dark:text-purple-400"
                  >
                    {{ operations.length }}
                  </div>
                  <div class="text-[12px] text-purple-600 dark:text-purple-400">
                    Operations
                  </div>
                </div>
                <Icon icon="ri:function-line" class="w-6 h-6 text-purple-500" />
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
          class="px-2 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
          v-if="path"
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
                <Icon icon="ri:function-line" class="w-3.5 h-3.5" />
                Mode: {{ mode }}
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
      title="Apply - Apply a series of transformation functions to given CSV column(s)"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
