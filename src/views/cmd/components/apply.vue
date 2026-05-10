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
    <div class="p-3">
      <div class="header-content">
        <div class="header-icon" @click="dialog = true">
          <Icon icon="ri:stack-line" />
        </div>
        <div class="header-text">
          <h1>Apply</h1>
          <p>Apply transformation functions to CSV column(s)</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="apply-main">
        <div class="p-3">
          <!-- File selection -->
          <div class="file-selection-bar" @click="selectFile">
            <div class="file-selection-icon">
              <Icon icon="ri:folder-open-line" />
            </div>
            <div class="file-selection-text">
              <template v-if="path">
                <span class="file-name">{{ path.split(/[/\\]/).pop() }}</span>
                <span class="file-path">{{ path }}</span>
              </template>
              <template v-else>
                <span class="file-prompt">Click to select a CSV file</span>
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
          <div class="mode-toggle py-1">
            <span v-for="item in modeOptions" :key="item.value" class="mode-item mx-0.5"
              :class="{ active: mode === item.value }" @click="mode = item.value">
              {{ item.label }}
            </span>
          </div>

          <!-- Options -->
          <div class="options-grid mt-4">
            <template v-if="mode === 'operations'">
              <div class="option-section">
                <div class="option-label">COLUMNS ({{ columns.length }})</div>
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
              <div class="option-section">
                <div class="option-label">OPERATIONS ({{ operations.length }})</div>
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
                <div class="option-panel">
                  <div class="option-panel-title">REPLACE OPTIONS</div>
                  <div class="option-panel-content">
                    <SiliconeInput v-model="comparand" placeholder="Find (old)" size="small" />
                    <SiliconeInput v-model="replacement" placeholder="Replace with (new)" size="small" />
                  </div>
                </div>
              </template>

              <template v-if="operations.includes('round')">
                <div class="option-panel">
                  <div class="option-panel-title">ROUND OPTIONS</div>
                  <div class="option-panel-content">
                    <SiliconeInput v-model="formatstr" placeholder="round place" size="small" />
                  </div>
                </div>
              </template>
            </template>

            <template v-if="['cat', 'calcconv'].includes(mode)">
              <div class="option-section full-width">
                <div class="option-label">FORMULA / FORMAT</div>
                <SiliconeInput v-model="formatstr" :autosize="{ minRows: 4, maxRows: 6 }" type="textarea"
                  :placeholder="placeholderText" class="w-full" />
              </div>
            </template>
          </div>
        </div>

        <!-- Table -->
        <div class="p-3 mt-[-8px]">
          <div class="preview-header">
            <span class="preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
            <span class="preview-mode">Mode: {{ mode }}</span>
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

<style scoped>
.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #409eff, #66b1ff);
  border-radius: 12px;
  font-size: 24px;
  color: white;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
  cursor: pointer;
}

.header-text h1 {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  margin: 0 0 4px 0;
}

.dark .header-text h1 {
  color: #e8e8e8;
}

.header-text p {
  font-size: 13px;
  color: #888;
  margin: 0;
}

.dark .header-text p {
  color: #999;
}

.mode-toggle {
  display: flex;
  justify-content: center;
  margin: 12px auto;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 12px;
  max-width: 280px;
}

.mode-item {
  text-align: center;
}

.apply-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-selection-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(145deg, #f8f8f8, #f0f0f0);
  border: 2px dashed #ddd;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.file-selection-bar:hover {
  border-color: #409eff;
  background: linear-gradient(145deg, #f0f8ff, #e6f2ff);
}

.dark .file-selection-bar {
  background: linear-gradient(145deg, #2a2a2a, #222);
  border-color: #444;
}

.dark .file-selection-bar:hover {
  border-color: #409eff;
  background: linear-gradient(145deg, #1e2a3a, #1a2535);
}

.file-selection-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #e8e8e8, #d8d8d8);
  border-radius: 10px;
  font-size: 20px;
  color: #666;
  flex-shrink: 0;
}

.dark .file-selection-icon {
  background: linear-gradient(145deg, #3a3a3a, #2d2d2d);
  color: #777;
}

.file-selection-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  flex: 1;
}

.file-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.dark .file-name {
  color: #e0e0e0;
}

.file-path {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-prompt {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.dark .file-prompt {
  color: #aaa;
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.option-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-section.full-width {
  width: 100%;
}

.option-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dark .option-label {
  color: #999;
}

.option-panel {
  background: linear-gradient(145deg, #f8f8f8, #f0f0f0);
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
}

.dark .option-panel {
  background: linear-gradient(145deg, #2a2a2a, #222);
  border-color: #3a3a3a;
}

.option-panel-title {
  font-size: 11px;
  font-weight: 600;
  color: #409eff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.dark .option-panel-title {
  color: #66b1ff;
}

.option-panel-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.preview-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dark .preview-title {
  color: #999;
}

.preview-mode {
  font-size: 12px;
  font-weight: 500;
  color: #409eff;
  background: rgba(64, 158, 255, 0.1);
  padding: 4px 10px;
  border-radius: 4px;
}

.dark .preview-mode {
  color: #66b1ff;
  background: rgba(64, 158, 255, 0.15);
}

:deep(.silicone-card) {
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}
</style>
