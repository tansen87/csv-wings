<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Files, FolderOpened, SwitchButton } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import { useDynamicHeight } from "@/utils/utils";
import { toJson, viewOpenFile, mapHeaders } from "@/utils/view";
import { mdSearch, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows,
  useThreads
} from "@/store/modules/options";

const mode = ref("equal");
const placeholderText = ref(
  "Search conditions, Separate by |.\nExample: tom|jack|jerry"
);
const [currentRows, totalRows, matchRows] = [ref(0), ref(0), ref(0)];
const [column, path, condition] = [ref(""), ref(""), ref("")];
const [dialog, isLoading] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdSearch);
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();
const threads = useThreads();

listen("update-rows", (event: Event<number>) => {
  currentRows.value = event.payload;
});
listen("total-rows", (event: Event<number>) => {
  totalRows.value = event.payload;
});

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    return;
  }

  totalRows.value = 0;

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

// invoke search
async function searchData() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }
  if (column.value.length === 0 && mode.value !== "irregular_regex") {
    message("Column not selected", { type: "warning" });
    return;
  }
  if (
    skiprows.skiprows > 0 &&
    threads.threads !== 1 &&
    mode.value !== "irregular_regex"
  ) {
    message("threads only support skiprows = 0", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const res: string[] = await invoke("search", {
      path: path.value,
      column: column.value,
      mode: mode.value,
      condition: condition.value,
      progress: progress.progress,
      quoting: quoting.quoting,
      flexible: flexible.flexible,
      skiprows: skiprows.skiprows,
      threads: threads.threads
    });
    matchRows.value = Number(res[0]);
    message(`Match ${res[0]} rows, elapsed time: ${res[1]} s`, {
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
      <el-splitter-panel size="260" :resizable="false">
        <div class="splitter-container mr-1">
          <SiliconeButton @click="selectFile()" :icon="FolderOpened" text>
            Open File
          </SiliconeButton>

          <SiliconeSelect
            v-model="column"
            filterable
            placeholder="Select column"
            class="mt-2"
          >
            <el-option
              v-for="item in tableHeader"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </SiliconeSelect>

          <SiliconeTooltip content="Search mode" placement="right">
            <SiliconeSelect v-model="mode" filterable class="mt-2">
              <el-option label="equal" value="equal" />
              <el-option label="equal_multi" value="equal_multi" />
              <el-option label="not_equal" value="not_equal" />
              <el-option label="contains" value="contains" />
              <el-option label="contains_multi" value="contains_multi" />
              <el-option label="not_contains" value="not_contains" />
              <el-option label="starts_with" value="starts_with" />
              <el-option label="starts_with_multi" value="starts_with_multi" />
              <el-option label="not_starts_with" value="not_starts_with" />
              <el-option label="ends_with" value="ends_with" />
              <el-option label="ends_with_multi" value="ends_with_multi" />
              <el-option label="not_ends_with" value="not_ends_with" />
              <el-option label="regex" value="regex" />
              <el-option label="is_null" value="is_null" />
              <el-option label="is_not_null" value="is_not_null" />
              <el-option label="gt(>)" value="gt" />
              <el-option label="ge(≥)" value="ge" />
              <el-option label="lt(<)" value="lt" />
              <el-option label="le(≤)" value="le" />
              <el-option label="between" value="between" />
              <el-option label="irregular_regex" value="irregular_regex" />
            </SiliconeSelect>
          </SiliconeTooltip>

          <SiliconeInput
            v-model="condition"
            :autosize="{ minRows: 12, maxRows: 12 }"
            type="textarea"
            :placeholder="placeholderText"
            class="mt-2"
          />

          <div class="flex flex-col mt-auto">
            <SiliconeProgress
              v-if="totalRows !== 0 && isFinite(currentRows / totalRows)"
              :percentage="Math.round((currentRows / totalRows) * 100)"
              class="mb-2 ml-1"
            />
            <el-link @click="dialog = true" underline="never">
              <SiliconeText class="mb-[1px]">Search</SiliconeText>
            </el-link>
          </div>
        </div>
      </el-splitter-panel>

      <el-splitter-panel>
        <div class="flex justify-between items-center">
          <SiliconeButton
            @click="searchData()"
            :loading="isLoading"
            :icon="SwitchButton"
            text
            class="ml-1 mb-2"
            >Run
          </SiliconeButton>

          <SiliconeText v-if="matchRows" style="margin-right: 4px">
            match rows: {{ matchRows }}
          </SiliconeText>
        </div>

        <SiliconeTable
          :data="tableData"
          :height="dynamicHeight"
          show-overflow-tooltip
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
      title="Search - Filter rows matching conditions"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
