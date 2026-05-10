<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { CheckboxValueType } from "element-plus";
import { mdApply, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";
import "./common.css";

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
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:stack-line" />
        </div>
        <div class="cmd-header-text">
          <h1>Apply</h1>
          <p>Apply transformation functions to CSV column(s)</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="cmd-main">
        <div class="p-3">
          <!-- File selection -->
          <div class="cmd-file-selection-bar mb-4" @click="selectFile">
            <div class="cmd-file-selection-icon">
              <Icon icon="ri:folder-open-line" />
            </div>
            <div class="cmd-file-selection-text">
              <template v-if="path">
                <span class="cmd-file-name">{{ path.split(/[/\\]/).pop() }}</span>
                <span class="cmd-file-path">{{ path }}</span>
              </template>
              <template v-else>
                <span class="cmd-file-prompt">Click to select a CSV file</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeTag @click.stop="addNewColumn" :disabled="mode === 'cat' || mode === 'calcconv'" text
                class="cursor-pointer">
                {{ columnContent }}
              </SiliconeTag>
              <SiliconeButton @click.stop="applyData()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <!-- Mode toggle -->
          <div class="flex justify-center">
            <div class="cmd-mode-toggle py-1">
              <span v-for="item in modeOptions" :key="item.value" class="cmd-mode-item mx-0.5 w-28"
                :class="{ active: mode === item.value }" @click="mode = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <!-- Options -->
          <div class="cmd-options-grid mt-4">
            <template v-if="mode === 'operations'">
              <div class="cmd-option-section">
                <div class="cmd-option-label">COLUMNS ({{ columns.length }})</div>
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
              <div class="cmd-option-section">
                <div class="cmd-option-label">OPERATIONS ({{ operations.length }})</div>
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

              <template v-if="operations.includes('replace')">
                <div class="cmd-option-panel">
                  <div class="cmd-option-panel-title">REPLACE OPTIONS</div>
                  <div class="cmd-option-panel-content">
                    <SiliconeInput v-model="comparand" placeholder="Find (old)" size="small" />
                    <SiliconeInput v-model="replacement" placeholder="Replace with (new)" size="small" />
                  </div>
                </div>
              </template>

              <template v-if="operations.includes('round')">
                <div class="cmd-option-panel">
                  <div class="cmd-option-panel-title">ROUND OPTIONS</div>
                  <div class="cmd-option-panel-content">
                    <SiliconeInput v-model="formatstr" placeholder="round place" size="small" />
                  </div>
                </div>
              </template>
            </template>

            <template v-if="['cat', 'calcconv'].includes(mode)">
              <div class="cmd-option-section full-width">
                <div class="cmd-option-label">FORMULA / FORMAT</div>
                <SiliconeInput v-model="formatstr" :autosize="{ minRows: 4, maxRows: 6 }" type="textarea"
                  :placeholder="placeholderText" class="w-full" />
              </div>
            </template>
          </div>
        </div>

        <!-- Table -->
        <div class="p-3 mt-[-8px]">
          <div class="cmd-preview-header">
            <span class="cmd-preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
            <span class="cmd-mode-badge">Mode: {{ mode }}</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'400px'" show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  No data. Click above to select file.
                </div>
              </template>
              <el-table-column v-for="column in tableColumn" :prop="column.prop" :label="column.label"
                :key="column.prop" />
            </SiliconeTable>
          </div>
        </div>
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
