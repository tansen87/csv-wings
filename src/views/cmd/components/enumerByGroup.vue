<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { mdEnumer, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows
} from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const path = ref("");
const [currentRows, totalRows] = [ref(0), ref(0)];
const [dialog, isLoading] = [ref(false), ref(false)];
const [tableColumn, tableData] = [ref([]), ref([])];
const sorted = ref(false);

const indexColumnName = ref("Line Number");
const groupByColumn = ref("");
const sortedOpts = [
  { label: "True", value: true },
  { label: "False", value: false }
];

const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdEnumer);
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();

// 自动设置默认分组列为第一列
watch(tableColumn, () => {
  if (tableColumn.value.length > 0 && !groupByColumn.value) {
    groupByColumn.value = tableColumn.value[0].prop;
  }
});

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
  groupByColumn.value = "";

  try {
    const { columnView, dataView } = await toJson(
      path.value,
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
    if (columnView.length > 0) {
      groupByColumn.value = columnView[0].prop;
    }
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
}

// invoke enumerate_by_group
async function enumerate() {
  if (path.value === "") {
    message("File not selected", { type: "warning" });
    return;
  }
  if (!groupByColumn.value) {
    message("Please select a column to group by", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const rtime: string = await invoke("enumer_by_group", {
      path: path.value,
      progress: progress.progress,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible,
      indexColumnName: indexColumnName.value,
      groupByColumn: groupByColumn.value,
      sorted: sorted.value
    });
    message(`Enumerate by group done, elapsed time: ${rtime} s`, {
      type: "success"
    });
  } catch (err) {
    message(err.toString(), { type: "error" });
  } finally {
    isLoading.value = false;
  }
}

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => enumerate(),
  onHelp: () => {
    dialog.value = !dialog.value;
  }
});

onUnmounted(() => {
  [path, indexColumnName, groupByColumn].forEach(r => (r.value = ""));
  [tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <el-form class="page-view">
    <header
      class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center gap-4">
        <h1
          class="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2"
          @click="dialog = true"
        >
          <Icon icon="ri:group-line" />
          Enumer Group
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400">
          Add a row number within each group
        </div>
      </div>

      <div class="flex items-center gap-2">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File
        </SiliconeButton>
        <SiliconeButton @click="enumerate()" :loading="isLoading" text>
          Run
        </SiliconeButton>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <aside
        class="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4"
      >
        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            INDEX COLUMN NAME
          </label>
          <SiliconeInput v-model="indexColumnName" placeholder="e.g. row_num" />
        </div>

        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            GROUP BY COLUMN
          </label>
          <SiliconeSelect v-model="groupByColumn" placeholder="Select column">
            <el-option
              v-for="col in tableColumn"
              :key="col.prop"
              :label="col.label"
              :value="col.prop"
            />
          </SiliconeSelect>
          <p class="mt-1 text-[10px] text-gray-400">
            Rows will be numbered starting from 1 within each group.
          </p>
          <SiliconeTooltip
            content="Only set it to True when the file is sorted"
            placement="right"
          >
            <div class="mode-toggle-v h-[30px] mt-2">
              <span
                v-for="item in sortedOpts"
                :key="String(item.value)"
                class="mode-item"
                :class="{ active: sorted === item.value }"
                @click="sorted = item.value"
              >
                {{ item.label }}
              </span>
            </div>
          </SiliconeTooltip>
        </div>

        <div
          class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <label
            class="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-2"
          >
            PREVIEW
          </label>
          <div
            class="text-xs text-blue-700 dark:text-blue-300 font-mono bg-white dark:bg-gray-700 p-2 rounded"
          >
            {{ indexColumnName }} = ROW_NUMBER() OVER (PARTITION BY
            {{ groupByColumn }})
          </div>
        </div>

        <div class="mt-auto">
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-3">
            STATISTICS
          </div>

          <div class="space-y-2">
            <div
              class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-lg font-bold text-gray-800 dark:text-white">
                    {{ totalRows }}
                  </div>
                  <div class="text-[12px] text-gray-500 dark:text-gray-400">
                    Total Rows
                  </div>
                </div>
                <Icon icon="ri:database-line" class="w-6 h-6 text-gray-400" />
              </div>
            </div>

            <div
              class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div
                    class="text-lg font-bold text-blue-600 dark:text-blue-400"
                  >
                    {{ currentRows }}
                  </div>
                  <div class="text-[12px] text-blue-600 dark:text-blue-400">
                    Scanned Rows
                  </div>
                </div>
                <div class="relative w-6 h-6 flex items-center justify-center">
                  <Icon
                    v-if="totalRows === 0 || !isFinite(currentRows / totalRows)"
                    icon="ri:scan-line"
                    class="w-6 h-6 text-blue-500"
                  />
                  <SiliconeProgress
                    v-else
                    :percentage="Math.round((currentRows / totalRows) * 100)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div
        class="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden"
      >
        <div
          v-if="path"
          class="px-2 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        >
          <SiliconeText :max-lines="1">{{ path }}</SiliconeText>
        </div>

        <div
          class="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-500 dark:text-gray-400">
              Preview ({{ tableData?.length || 0 }} rows)
            </span>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded"
              >
                <Icon icon="ri:group-line" class="w-3.5 h-3.5" />
                {{ indexColumnName }} per group: {{ groupByColumn }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-2">
          <div
            class="h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <SiliconeTable
              :data="tableData"
              :height="'100%'"
              empty-text="No data. (Ctrl+D) to Open File."
              show-overflow-tooltip
              class="select-text"
            >
              <el-table-column
                v-for="column in tableColumn"
                :prop="column.prop"
                :label="column.label"
                :key="column.prop"
              />
            </SiliconeTable>
          </div>
        </div>
      </div>
    </main>

    <SiliconeDialog
      v-model="dialog"
      title="Enumerate by Group - Add row numbers within each group (SQL ROW_NUMBER)"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
