<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { FolderOpened, Files, SwitchButton } from "@element-plus/icons-vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { mdInsert, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows
} from "@/store/modules/options";

const [isLoading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const [currentRows, totalRows] = [ref(0), ref(0)];
const [path, column, position, values] = [ref(""), ref(""), ref(""), ref("")];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdInsert);

const skiprows = useSkiprows();
const quoting = useQuoting();
const flexible = useFlexible();
const progress = useProgress();

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
    column.value = "";
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

// invoke insert
async function insertData() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const rtime: string = await invoke("insert", {
      path: path.value,
      column: column.value,
      position: position.value,
      values: values.value,
      skiprows: skiprows.skiprows,
      quoting: quoting.quoting,
      flexible: flexible.flexible,
      progress: progress.progress
    });
    message(`Insert done, elapsed time: ${rtime} s`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}
</script>

<template>
  <el-form class="page-container">
    <el-splitter>
      <el-splitter-panel size="180" :resizable="false">
        <div class="splitter-container mr-1">
          <SiliconeButton @click="selectFile()" :icon="FolderOpened" text>
            Open File
          </SiliconeButton>

          <div class="mt-2 space-y-2">
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

            <el-tooltip content="position" effect="light" placement="right">
              <SiliconeInput
                v-model="position"
                placeholder="position: left|right|1"
              />
            </el-tooltip>

            <el-tooltip content="values" effect="light" placement="right">
              <SiliconeInput v-model="values" placeholder="values: 1||CNY" />
            </el-tooltip>
          </div>

          <div class="flex flex-col mt-auto">
            <SiliconeProgress
              v-if="totalRows !== 0 && isFinite(currentRows / totalRows)"
              :percentage="Math.round((currentRows / totalRows) * 100)"
              class="mb-2 ml-1"
            />
            <el-link @click="dialog = true" underline="never">
              <SiliconeText class="mb-[1px]">Insert</SiliconeText>
            </el-link>
          </div>
        </div>
      </el-splitter-panel>

      <el-splitter-panel>
        <SiliconeButton
          @click="insertData()"
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
      title="Insert - Insert columns through index"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
