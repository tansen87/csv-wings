<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { CheckboxValueType } from "element-plus";
import { mdApply, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Apply] ${msg}`, type);
};

const [loading, checkAll, indeterminate, newColumn, dialog, backendCompleted] =
  [ref(false), ref(false), ref(false), ref(false), ref(false), ref(false)];
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

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    addLog('File selection cancelled', 'info');
    return;
  }

  try {
    addLog(`Selected file: ${path.value}`, 'info');
    tableHeader.value = await mapHeaders(path.value, skiprows.skiprows);
    const { columnView, dataView } = await toJson(
      path.value,
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
  } catch (e) {
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

// invoke apply
async function applyData() {
  if (path.value === "") {
    addLog("CSV file not selected", 'warning');
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
    addLog("Column not selected", 'warning');
    return;
  }

  try {
    loading.value = true;
    addLog(`Starting apply operation: ${mode.value} mode`, 'info');
    if (mode.value === 'operations' && operations.value.length > 0) {
      addLog(`Applying operations: ${operations.value.join(', ')}`, 'info');
    } else if (['cat', 'calcconv'].includes(mode.value)) {
      addLog('Using formula/format for transformation', 'info');
    }

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
      flexible: flexible.flexible
    });
    addLog(`Apply done, elapsed time: ${result} s`, 'success');
  } catch (e) {
    addLog(`Apply failed: ${e}`, 'error');
  }
  loading.value = false;
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
  <div class="flex flex-col h-full overflow-hidden">
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:function-line" />
          Apply
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400 tracking-wider">
          Apply transformation functions to CSV column(s)
        </div>
        <div class="mode-toggle ml-auto">
          <span v-for="item in modeOptions" :key="item.value" class="mode-item mx-1 w-24" :class="{ active: mode === item.value }"
            @click="mode = item.value">
            {{ item.label }}
          </span>
        </div>
      </div>
    </SiliconeCard>

    <el-scrollbar class="flex-1 px-4 pb-4 min-h-0">
      <div class="flex flex-col gap-2">
        <SiliconeCard>
          <div class="flex justify-between items-center mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              FILE SELECTION
            </div>
            <div class="flex items-center">
              <SiliconeButton @click="selectFile()" size="small" text>
                <Icon icon="ri:folder-open-line" class="w-4 h-4" />
              </SiliconeButton>
              <SiliconeButton @click="applyData()" :loading="loading" size="small" text>
                <Icon icon="ri:play-large-line" class="w-4 h-4" />
              </SiliconeButton>
            </div>
          </div>

          <div v-if="path" class="mb-2">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              SELECTED FILE
            </div>
            <SiliconeText :max-lines="1" class="mb-2">{{ path }}</SiliconeText>
          </div>

          <div class="mb-2">
            <SiliconeTag @click="addNewColumn" :disabled="mode === 'cat' || mode === 'calcconv'" text
              class="mb-2 mt-2 w-full">
              {{ columnContent }}
            </SiliconeTag>
          </div>

          <template v-if="mode === 'operations'">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
                  COLUMNS ({{ columns.length }})
                </div>
                <SiliconeSelect v-model="columns" filterable multiple placeholder="Select column(s)" class="w-full">
                  <template #header>
                    <div class="flex items-center justify-between px-2 py-1">
                      <el-checkbox v-model="checkAll" :indeterminate="indeterminate" @change="handleCheckAll">
                        All
                      </el-checkbox>
                      <span class="text-xs text-gray-400">
                        {{ columns.length }} selected
                      </span>
                    </div>
                  </template>
                  <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
                </SiliconeSelect>
              </div>
              <div>
                <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
                  OPERATIONS ({{ operations.length }})
                </div>
                <SiliconeSelect v-model="operations" filterable multiple placeholder="Select operations" class="w-full">
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
            </div>

            <template v-if="operations.includes('replace')">
              <div
                class="mt-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <label class="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-2">
                  REPLACE OPTIONS
                </label>
                <div class="space-y-2">
                  <SiliconeInput v-model="comparand" placeholder="Find (old)" size="small" />
                  <SiliconeInput v-model="replacement" placeholder="Replace with (new)" size="small" />
                </div>
              </div>
            </template>

            <template v-if="operations.includes('round')">
              <div
                class="mt-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <label class="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-2">
                  ROUND OPTIONS
                </label>
                <div class="space-y-2">
                  <SiliconeInput v-model="formatstr" placeholder="round place" size="small" />
                </div>
              </div>
            </template>
          </template>

          <template v-if="['cat', 'calcconv'].includes(mode)">
            <label class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block">
              FORMULA / FORMAT
            </label>
            <SiliconeInput v-model="formatstr" :autosize="{ minRows: 10, maxRows: 10 }" type="textarea"
              :placeholder="placeholderText" class="w-full" />
          </template>
        </SiliconeCard>

        <SiliconeCard>
          <div class="flex items-center justify-between mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              PREVIEW ({{ tableData?.length || 0 }} rows)
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded">
                <Icon icon="ri:function-line" class="w-3.5 h-3.5" />
                Mode: {{ mode }}
              </span>
            </div>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'400px'"
              empty-text="No data. Click 'Open File' to select a CSV file." show-overflow-tooltip class="select-text">
              <el-table-column v-for="column in tableColumn" :prop="column.prop" :label="column.label"
                :key="column.prop" />
            </SiliconeTable>
          </div>
        </SiliconeCard>

        <SiliconeCard>
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
            USAGE
          </div>
          <div class="flex flex-col gap-2">
            <SiliconeText type="info">1. Click
              <Icon icon="ri:folder-open-line" class="w-4 h-4 inline align-middle" /> to select a CSV file
            </SiliconeText>
            <SiliconeText type="info">2. Choose mode: Operations, CalcConv, or DynFmt</SiliconeText>
            <SiliconeText type="info">3. For Operations mode: select columns and operations</SiliconeText>
            <SiliconeText type="info">4. For CalcConv or DynFmt mode: enter formula/format</SiliconeText>
            <SiliconeText type="info">5. Preview the result in the table below</SiliconeText>
            <SiliconeText type="info">6. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to run the apply operation
            </SiliconeText>
            <SiliconeText type="info">7. Check the output log for details</SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Apply - Apply a series of transformation functions to given CSV column(s)"
      width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
:deep(.silicone-card) {
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}
</style>
