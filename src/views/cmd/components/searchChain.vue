<script setup lang="ts">
import { ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import {
  Files,
  FolderOpened,
  SwitchButton,
  CloseBold,
  Plus
} from "@element-plus/icons-vue";
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
import SiliconeSelect from "@/layout/silicone/siliconeSelect.vue";

interface ColumnConfig {
  column: string;
  mode: string;
  condition: string;
}

const columnConfigs = ref<ColumnConfig[]>([]);
const logics = ref<string[]>([]); // 长度 = columnConfigs.length - 1

const path = ref("");
const [currentRows, totalRows, matchRows] = [ref(0), ref(0), ref(0)];
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

watch(columnConfigs, newConfigs => {
  const n = newConfigs.length;
  logics.value = Array(n > 0 ? n - 1 : 0).fill("and");
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

// 添加/移除列配置
function addColumn() {
  columnConfigs.value.push({
    column: "",
    mode: "equal",
    condition: ""
  });
}

function removeColumn(index: number) {
  columnConfigs.value.splice(index, 1);
}

async function searchData() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }
  if (columnConfigs.value.length === 0) {
    message("Add at least one column filter", { type: "warning" });
    return;
  }
  if (skiprows.skiprows > 0 && threads.threads !== 1) {
    message("threads only support skiprows = 0", { type: "warning" });
    return;
  }

  // 校验:所有列必须选中
  for (const cfg of columnConfigs.value) {
    if (!cfg.column) {
      message("All columns must be selected", { type: "warning" });
      return;
    }
  }

  try {
    isLoading.value = true;

    const res: string[] = await invoke("search_chain", {
      path: path.value,
      configs: columnConfigs.value, // [{column, mode, condition}, ...]
      logics: logics.value,
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
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <el-form class="page-container">
    <el-splitter>
      <el-splitter-panel size="320" :resizable="false">
        <div class="splitter-container">
          <div class="flex justify-center">
            <SiliconeButton
              @click="selectFile()"
              :icon="FolderOpened"
              style="width: 145px"
              text
            >
              Open File
            </SiliconeButton>
            <SiliconeButton
              @click="addColumn()"
              :icon="Plus"
              style="width: 145px"
              text
            >
              Add Filter
            </SiliconeButton>
          </div>

          <div
            v-for="(cfg, index) in columnConfigs"
            :key="index"
            class="mt-2 ml-2 mr-2 p-2 border rounded"
            style="border-color: rgba(0, 0, 0, 0.1); border-radius: 12px"
          >
            <div class="flex items-center mb-2">
              <SiliconeButton
                class="ml-auto mr-auto"
                @click="removeColumn(index)"
                size="small"
                circle
                text
                type="danger"
              >
                <el-icon><CloseBold /></el-icon>
              </SiliconeButton>
            </div>

            <div class="flex gap-2 mb-2">
              <SiliconeSelect
                v-model="cfg.column"
                filterable
                placeholder="Select column"
                style="width: 150px"
              >
                <el-option
                  v-for="item in tableHeader"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </SiliconeSelect>

              <SiliconeSelect
                v-model="cfg.mode"
                filterable
                placeholder="Mode"
                style="width: 150px"
              >
                <el-option label="equal" value="equal" />
                <el-option label="not_equal" value="not_equal" />
                <el-option label="contains" value="contains" />
                <el-option label="not_contains" value="not_contains" />
                <el-option label="starts_with" value="starts_with" />
                <el-option label="not_starts_with" value="not_starts_with" />
                <el-option label="ends_with" value="ends_with" />
                <el-option label="not_ends_with" value="not_ends_with" />
                <el-option label="regex" value="regex" />
                <el-option label="is_null" value="is_null" />
                <el-option label="is_not_null" value="is_not_null" />
                <el-option label="gt(>)" value="gt" />
                <el-option label="ge(≥)" value="ge" />
                <el-option label="lt(<)" value="lt" />
                <el-option label="le(≤)" value="le" />
                <el-option label="between" value="between" />
              </SiliconeSelect>
            </div>

            <SiliconeInput
              v-model="cfg.condition"
              placeholder="Condition (use | for multiple values, e.g. tom|jerry)"
              class="mb-2"
              type="textarea"
            />

            <SiliconeSelect
              v-if="index < columnConfigs.length - 1"
              v-model="logics[index]"
              placeholder="logic"
            >
              <el-option label="AND" value="and" />
              <el-option label="OR" value="or" />
            </SiliconeSelect>
          </div>

          <div class="flex flex-col mt-auto">
            <SiliconeProgress
              v-if="totalRows !== 0 && isFinite(currentRows / totalRows)"
              :percentage="Math.round((currentRows / totalRows) * 100)"
              class="mb-2 ml-2"
            />
            <el-link @click="dialog = true" underline="never">
              <SiliconeText class="mb-[1px]">Search Chain</SiliconeText>
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
            style="width: 120px"
            class="ml-2 mb-2"
            text
          >
            Run
          </SiliconeButton>
          <el-text v-if="matchRows" style="margin-right: 8px">
            match rows: {{ matchRows }}
          </el-text>
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
