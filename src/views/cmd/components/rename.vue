<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { message } from "@/utils/message";
import { viewOpenFile } from "@/utils/view";
import { mdRename, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows
} from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const tableData = ref([]);
const [search, path] = [ref(""), ref("")];
const [currentRows, totalRows] = [ref(0), ref(0)];
const [dialog, isLoading] = [ref(false), ref(false)];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdRename);
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();
const filterTableData = computed(() =>
  tableData.value.filter(
    (data: any) =>
      !search.value ||
      data.col1.toLowerCase().includes(search.value.toLowerCase())
  )
);

listen("update-rows", (event: Event<number>) => {
  currentRows.value = event.payload;
});
listen("total-rows", (event: Event<number>) => {
  totalRows.value = event.payload;
});

async function selectFile() {
  tableData.value = [];
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    search.value = "";
    return;
  }

  totalRows.value = 0;

  try {
    const headers: string[] = await invoke("from_headers", {
      path: path.value,
      skiprows: skiprows.skiprows
    });
    for (let i = 0; i < headers.length; i++) {
      const colData = {
        col1: headers[i],
        col2: headers[i % headers.length]
      };
      tableData.value.push(colData);
    }
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
}

// invoke rename
async function renameData() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const headersStringArray = tableData.value.map((row: any) => row.col2);
    const headersString = headersStringArray.join(",");
    const rtime: string = await invoke("rename", {
      path: path.value,
      headers: headersString,
      progress: progress.progress,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible
    });
    message(`Rename done, elapsed time: ${rtime} s`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}

async function headerEdit(row: any) {
  return row;
}

const totalColumns = computed(() => tableData.value.length);
const renamedCount = computed(() => {
  if (!filterTableData.value) return 0;
  return filterTableData.value.filter(row => row.col2 && row.col2 !== row.col1)
    .length;
});

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => renameData(),
  onHelp: () => {
    dialog.value = !dialog.value;
  }
});

onUnmounted(() => {
  [search, path].forEach(r => (r.value = ""));
  [tableData].forEach(r => (r.value = []));
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
          <Icon icon="ri:heading" />
          Rename
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400">
          Rename the columns of a CSV
        </div>
      </div>

      <div class="flex items-center">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File
        </SiliconeButton>
        <SiliconeButton @click="renameData()" :loading="isLoading" text>
          Run
        </SiliconeButton>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <aside
        class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4"
      >
        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            SEARCH HEADER
          </label>
          <SiliconeInput
            v-model="search"
            placeholder="Type to search headers..."
            clearable
          >
            <template #prefix>
              <Icon icon="ri:search-line" class="w-4 h-4 text-gray-400" />
            </template>
          </SiliconeInput>
          <div v-if="search" class="mt-1 text-[10px] text-gray-400">
            Found {{ filterTableData.length }} / {{ totalColumns || 0 }} columns
          </div>
        </div>

        <div
          v-if="totalRows !== 0 && isFinite(currentRows / totalRows)"
          class="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs text-gray-500 dark:text-gray-400">Progress</div>
          </div>
          <SiliconeProgress
            :percentage="Math.round((currentRows / totalRows) * 100)"
          />
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
                <Icon icon="ri:scan-line" class="w-6 h-6 text-blue-500" />
              </div>
            </div>

            <div
              class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-lg font-bold text-gray-800 dark:text-white">
                    {{ totalColumns || 0 }}
                  </div>
                  <div class="text-[12px] text-gray-500 dark:text-gray-400">
                    Total Columns
                  </div>
                </div>
                <Icon icon="ri:table-line" class="w-6 h-6 text-gray-400" />
              </div>
            </div>

            <div
              class="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div
                    class="text-lg font-bold text-green-600 dark:text-green-400"
                  >
                    {{ renamedCount }}
                  </div>
                  <div class="text-[12px] text-green-600 dark:text-green-400">
                    Renamed Columns
                  </div>
                </div>
                <Icon
                  icon="ri:checkbox-circle-line"
                  class="w-6 h-6 text-green-500"
                />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div
        class="flex-1 bg-white dark:bg-gray-800 flex flex-col overflow-hidden"
      >
        <div
          v-if="path"
          class="px-2 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600"
        >
          <SiliconeText :max-lines="1">{{ path }}</SiliconeText>
        </div>

        <div class="flex-1 overflow-auto p-2">
          <SiliconeTable
            :data="filterTableData"
            :height="'100%'"
            empty-text="No data. (Ctrl+D) to Open File."
            show-overflow-tooltip
            :row-style="{ height: '50px' }"
            :cell-style="{
              borderBottom: '1px solid #f0f0f0'
            }"
            class="select-text"
          >
            <el-table-column prop="col1" label="Header" min-width="150">
              <template #default="{ row }">
                <span
                  class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ row.col1 }}
                </span>
              </template>
            </el-table-column>

            <el-table-column prop="col2" label="New Header" min-width="150">
              <template #default="{ row }">
                <SiliconeInput
                  v-model="row.col2"
                  placeholder="Enter new header name"
                  @blur="headerEdit(row)"
                  @keyup.enter="headerEdit(row)"
                  size="small"
                />
              </template>
            </el-table-column>

            <el-table-column label="Status" width="120">
              <template #default="{ row }">
                <span
                  v-if="row.col2 && row.col2 !== row.col1"
                  class="inline-flex items-center px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded"
                >
                  Changed
                </span>
                <span
                  v-else
                  class="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded"
                >
                  Unchanged
                </span>
              </template>
            </el-table-column>
          </SiliconeTable>
        </div>
      </div>
    </main>

    <SiliconeDialog
      v-model="dialog"
      title="Rename - Rename the columns of a CSV"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
