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
  <el-form class="page-view flex flex-col bg-gray-50 dark:bg-[#141414]">
    <el-splitter
      v-if="path && tableData.length"
      class="flex-1"
      layout="horizontal"
    >
      <el-splitter-panel size="320" :resizable="false">
        <div class="h-full flex flex-col p-2 bg-white dark:bg-[#1d1e1f]">
          <div class="flex gap-2 mb-4">
            <SiliconeButton @click="selectFile()" style="flex: 1" text>
              Open File
            </SiliconeButton>
            <SiliconeButton
              @click="addNewColumn"
              :disabled="mode === 'cat' || mode === 'calcconv'"
              style="flex: 1"
              text
            >
              {{ columnContent }}
            </SiliconeButton>
          </div>

          <div class="mode-toggle mb-6">
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

          <div class="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
            <template v-if="mode === 'operations'">
              <div class="form-group">
                <label class="form-label">Columns</label>
                <SiliconeSelect
                  v-model="columns"
                  filterable
                  multiple
                  placeholder="Select column(s)"
                >
                  <template #header>
                    <el-checkbox
                      v-model="checkAll"
                      :indeterminate="indeterminate"
                      @change="handleCheckAll"
                    >
                      Select All
                    </el-checkbox>
                  </template>
                  <el-option
                    v-for="item in tableHeader"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </SiliconeSelect>
              </div>

              <div class="form-group">
                <label class="form-label">Operations</label>
                <SiliconeSelect
                  v-model="operations"
                  filterable
                  multiple
                  placeholder="Select operations"
                  class="w-full"
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
                <div class="form-group space-y-2">
                  <SiliconeTooltip content="old" placement="right">
                    <SiliconeInput
                      v-model="comparand"
                      placeholder="replace - from"
                    />
                  </SiliconeTooltip>
                  <SiliconeTooltip content="new" placement="right">
                    <SiliconeInput
                      v-model="replacement"
                      placeholder="replace - to"
                    />
                  </SiliconeTooltip>
                </div>
              </template>
            </template>

            <template v-if="['cat', 'calcconv'].includes(mode)">
              <div class="form-group h-full flex flex-col">
                <label class="form-label">
                  <span>Formula / Format</span>
                </label>
                <SiliconeInput
                  v-model="formatstr"
                  :autosize="{ minRows: 10, maxRows: 20 }"
                  type="textarea"
                  :placeholder="placeholderText"
                  class="flex-1 font-mono text-sm"
                />
              </div>
            </template>
          </div>

          <SiliconeLink v-if="backendCompleted">{{ backendInfo }}</SiliconeLink>
        </div>
      </el-splitter-panel>

      <el-splitter-panel class="bg-gray-50 dark:bg-[#141414] p-2 flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <SiliconeButton
            @click="applyData()"
            :loading="isLoading"
            type="success"
            text
          >
            Run
          </SiliconeButton>
          <div class="flex-grow" />
          <SiliconeTag @click="dialog = true" type="warning" size="large">
            Apply
          </SiliconeTag>
        </div>

        <div
          class="flex-1 relative bg-white dark:bg-[#1d1e1f] rounded-lg shadow-sm overflow-hidden"
        >
          <SiliconeTable
            :data="tableData"
            show-overflow-tooltip
            :height="dynamicHeight"
          >
            <el-table-column
              v-for="column in tableColumn"
              :prop="column.prop"
              :label="column.label"
              :key="column.prop"
            />
          </SiliconeTable>
        </div>

        <SiliconeText v-if="path" size="small" class="mt-1" :maxLines="1">
          {{ path }}
        </SiliconeText>
      </el-splitter-panel>
    </el-splitter>

    <el-empty v-if="!path" :image-size="160">
      <template #image>
        <Icon icon="ri:stack-line" />
        <SiliconeTag @click="dialog = true" class="w-16" type="warning">
          Apply
        </SiliconeTag>
      </template>

      <template #description>
        <div class="empty-desc mt-6">
          <div class="desc-row">
            <SiliconeTag type="success" @click="selectFile">
              Open File(s)
            </SiliconeTag>
            <SiliconeTag>Ctrl + D</SiliconeTag>
          </div>
          <div class="desc-row">
            <SiliconeTag type="info">Run</SiliconeTag>
            <SiliconeTag>Ctrl + R</SiliconeTag>
          </div>
          <div class="desc-row">
            <SiliconeTag type="info">Help</SiliconeTag>
            <SiliconeTag>Ctrl + B</SiliconeTag>
          </div>
        </div>
      </template>

      <SiliconeTag type="info">
        Apply a series of transformation functions to given CSV column(s)
      </SiliconeTag>
    </el-empty>

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

<style scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 2px;
}
.dark .form-label {
  color: #e5eaf3;
}
</style>
