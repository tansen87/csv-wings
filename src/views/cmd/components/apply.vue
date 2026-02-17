<script setup lang="ts">
import { ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import {
  FolderOpened,
  CirclePlus,
  Remove,
  Files,
  SwitchButton
} from "@element-plus/icons-vue";
import { useDark } from "@pureadmin/utils";
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
const { isDark } = useDark();
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
</script>

<template>
  <el-form class="page-container">
    <el-splitter>
      <el-splitter-panel size="280" :resizable="false">
        <div class="splitter-container mr-1">
          <div class="mb-2">
            <SiliconeButton
              @click="selectFile()"
              :icon="FolderOpened"
              text
              style="width: 132px"
            >
              Open File
            </SiliconeButton>

            <SiliconeButton
              @click="addNewColumn"
              text
              style="width: 130px"
              :disabled="mode === 'cat' || mode === 'calcconv'"
            >
              <el-icon>
                <CirclePlus v-if="newColumn" />
                <Remove v-else />
              </el-icon>
              {{ columnContent }}
            </SiliconeButton>
          </div>

          <div class="mode-toggle">
            <span
              v-for="item in modeOptions"
              :key="item.value"
              class="mode-item"
              :class="{
                active: mode === item.value,
                'active-dark': isDark && mode === item.value
              }"
              @click="mode = item.value"
            >
              {{ item.label }}
            </span>
          </div>

          <div class="mt-2 space-y-2">
            <SiliconeSelect
              v-if="mode === 'operations'"
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
                  All
                </el-checkbox>
              </template>
              <el-option
                v-for="item in tableHeader"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </SiliconeSelect>

            <SiliconeSelect
              v-if="mode === 'operations'"
              v-model="operations"
              filterable
              multiple
              placeholder="Operations"
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

            <template
              v-if="
                ['operations'].includes(mode) && operations.includes('replace')
              "
            >
              <el-tooltip content="old" effect="light" placement="right">
                <SiliconeInput
                  v-model="comparand"
                  placeholder="replace - from"
                />
              </el-tooltip>
              <el-tooltip content="new" effect="light" placement="right">
                <SiliconeInput
                  v-model="replacement"
                  placeholder="replace - to"
                />
              </el-tooltip>
            </template>

            <template v-if="['cat', 'calcconv'].includes(mode)">
              <SiliconeInput
                v-model="formatstr"
                :autosize="{ minRows: 8, maxRows: 8 }"
                type="textarea"
                :placeholder="placeholderText"
              />
            </template>
          </div>

          <el-link @click="dialog = true" class="mt-auto" underline="never">
            <template v-if="backendCompleted">
              <SiliconeText class="mb-[1px]">{{ backendInfo }}</SiliconeText>
            </template>
            <template v-else>
              <SiliconeText>Apply</SiliconeText>
            </template>
          </el-link>
        </div>
      </el-splitter-panel>

      <el-splitter-panel>
        <SiliconeButton
          @click="applyData()"
          :loading="isLoading"
          :icon="SwitchButton"
          text
          round
          >Run
        </SiliconeButton>

        <SiliconeTable
          :data="tableData"
          :height="dynamicHeight"
          show-overflow-tooltip
          tooltip-effect="light"
          class="mt-2"
        >
          <el-table-column
            v-for="column in tableColumn"
            :prop="column.prop"
            :label="column.label"
            :key="column.prop"
          />
        </SiliconeTable>

        <SiliconeText truncated :max-lines="1" class="mt-2">
          <el-icon><Files /></el-icon>{{ path }}
        </SiliconeText>
      </el-splitter-panel>
    </el-splitter>

    <SiliconeDialog
      v-model="dialog"
      title="Apply - Apply a series of transformation functions to given CSV column/s"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
