<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { FolderOpened, Files, SwitchButton } from "@element-plus/icons-vue";
import { useDark } from "@pureadmin/utils";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { mdPinyin, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows
} from "@/store/modules/options";

const pinyinStyle = ref("upper");
const pyOptions = [
  { label: "Upper", value: "upper" },
  { label: "Lower", value: "lower" }
];
const [currentRows, totalRows] = [ref(0), ref(0)];
const [columns, path] = [ref(""), ref("")];
const [isLoading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdPinyin);
const { isDark } = useDark();
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();

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

// invoke pinyin
async function chineseToPinyin() {
  if (path.value === "") {
    message("File not selected", { type: "warning" });
    return;
  }
  if (columns.value.length === 0) {
    message("Column not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const cols = Object.values(columns.value).join("|");
    const rtime: string = await invoke("pinyin", {
      path: path.value,
      columns: cols,
      progress: progress.progress,
      pinyinStyle: pinyinStyle.value,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible
    });
    message(`Convert done, elapsed time: ${rtime} s`, { type: "success" });
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

          <el-tooltip content="pinyin style" effect="light" placement="right">
            <div class="mode-toggle mt-2 mb-2">
              <span
                v-for="item in pyOptions"
                :key="item.value"
                class="mode-item"
                :class="{
                  active: pinyinStyle === item.value,
                  'active-dark': isDark && pinyinStyle === item.value
                }"
                @click="pinyinStyle = item.value"
              >
                {{ item.label }}
              </span>
            </div>
          </el-tooltip>

          <SiliconeSelect
            v-model="columns"
            multiple
            filterable
            placeholder="Select columns"
          >
            <el-option
              v-for="item in tableHeader"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </SiliconeSelect>

          <div class="flex flex-col mt-auto">
            <SiliconeProgress
              v-if="totalRows !== 0 && isFinite(currentRows / totalRows)"
              :percentage="Math.round((currentRows / totalRows) * 100)"
              class="mb-2 ml-2"
            />
            <el-link @click="dialog = true" underline="never">
              <SiliconeText class="mb-[1px]">Pinyin</SiliconeText>
            </el-link>
          </div>
        </div>
      </el-splitter-panel>

      <el-splitter-panel>
        <SiliconeButton
          @click="chineseToPinyin()"
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
      title="Pinyin - Convert Chinese to Pinyin in CSV"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
