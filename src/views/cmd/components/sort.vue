<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpened, Files, SwitchButton } from "@element-plus/icons-vue";
import { useDark } from "@pureadmin/utils";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { mdSort, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";

const mode = ref("Sort");
const modeOptions = [
  { label: "Sort", value: "Sort" },
  { label: "ExtSort", value: "ExtSort" }
];
const numOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const reverseOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const [column, path] = [ref(""), ref("")];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const [isLoading, dialog, numeric, reverse] = [
  ref(false),
  ref(false),
  ref(false),
  ref(false)
];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdSort);
const { isDark } = useDark();
const quoting = useQuoting();
const skiprows = useSkiprows();
const flexible = useFlexible();

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

// invoke sort
async function sortData() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }
  if (column.value.length === 0 && mode.value !== "index") {
    message("Column not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    let rtime: string;
    if (mode.value == "Sort") {
      rtime = await invoke("sort", {
        path: path.value,
        column: column.value,
        numeric: numeric.value,
        reverse: reverse.value,
        quoting: quoting.quoting,
        skiprows: skiprows.skiprows,
        flexible: flexible.flexible
      });
    } else if (mode.value == "ExtSort") {
      rtime = await invoke("extsort", {
        path: path.value,
        column: column.value,
        reverse: reverse.value,
        quoting: quoting.quoting
      });
    }
    message(`${mode.value} done, elapsed time: ${rtime} s`, {
      type: "success"
    });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}
</script>

<template>
  <el-form class="page-container">
    <el-splitter>
      <el-splitter-panel size="200" :resizable="false">
        <div class="splitter-container mr-1">
          <SiliconeButton @click="selectFile()" :icon="FolderOpened" text>
            Open File
          </SiliconeButton>

          <div class="mode-toggle mt-2">
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

          <el-tooltip
            content="Numeric (when set to True, sort by numerical size)"
            effect="light"
            placement="right"
          >
            <div class="mode-toggle mt-2">
              <span
                v-for="item in numOptions"
                :key="String(item.value)"
                class="mode-item"
                :class="{
                  active: numeric === item.value,
                  'active-dark': isDark && numeric === item.value
                }"
                @click="numeric = item.value"
              >
                {{ item.label }}
              </span>
            </div>
          </el-tooltip>

          <el-tooltip
            content="Reverse (when set to False, sort from small to large)"
            effect="light"
            placement="right"
          >
            <div class="mode-toggle mt-2 mb-2">
              <span
                v-for="item in reverseOptions"
                :key="String(item.value)"
                class="mode-item"
                :class="{
                  active: reverse === item.value,
                  'active-dark': isDark && reverse === item.value
                }"
                @click="reverse = item.value"
              >
                {{ item.label }}
              </span>
            </div>
          </el-tooltip>

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

          <el-link @click="dialog = true" class="mt-auto" underline="never">
            <SiliconeText class="mb-[1px]">Sort</SiliconeText>
          </el-link>
        </div>
      </el-splitter-panel>

      <el-splitter-panel>
        <SiliconeButton
          @click="sortData()"
          :loading="isLoading"
          :icon="SwitchButton"
          text
          class="ml-1 mb-2"
          >Run
        </SiliconeButton>

        <SiliconeTable
          :data="tableData"
          :height="dynamicHeight"
          show-overflow-tooltip
          tooltip-effect="light"
        >
          <el-table-column
            v-for="column in tableColumn"
            :prop="column.prop"
            :label="column.label"
            :key="column.prop"
          />
        </SiliconeTable>

        <SiliconeText class="mt-2" truncated :max-lines="1">
          <el-icon><Files /></el-icon>{{ path }}
        </SiliconeText>
      </el-splitter-panel>
    </el-splitter>

    <SiliconeDialog
      v-model="dialog"
      title="Sort - Sorts CSV data lexicographically"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
