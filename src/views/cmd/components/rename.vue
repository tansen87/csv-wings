<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { viewOpenFile } from "@/utils/view";
import { mdRename, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows
} from "@/store/modules/options";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Rename] ${msg}`, type);
};

const tableData = ref([]);
const [search, path] = [ref(""), ref("")];
const [currentRows, totalRows] = [ref(0), ref(0)];
const [dialog, loading] = [ref(false), ref(false)];
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

listen("update-rename-rows", (event: Event<number>) => {
  currentRows.value = event.payload;
});
listen("total-rename-rows", (event: Event<number>) => {
  totalRows.value = event.payload;
});

async function selectFile() {
  tableData.value = [];
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    search.value = "";
    addLog('File selection cancelled', 'info');
    return;
  }

  totalRows.value = 0;

  try {
    addLog(`Selected file: ${path.value}`, 'info');
    const headers: string[] = await invoke("from_headers", {
      path: path.value,
      skiprows: skiprows.skiprows
    });
    addLog(`Found ${headers.length} columns`, 'success');
    for (let i = 0; i < headers.length; i++) {
      const colData = {
        col1: headers[i],
        col2: headers[i % headers.length]
      };
      tableData.value.push(colData);
    }
  } catch (e) {
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

// invoke rename
async function renameData() {
  if (path.value === "") {
    addLog("CSV file not selected", 'warning');
    return;
  }

  try {
    loading.value = true;
    const renamedCount = tableData.value.filter(row => row.col2 && row.col2 !== row.col1).length;
    addLog(`Starting rename operation with ${renamedCount} columns to rename`, 'info');

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
    addLog(`Rename done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Rename failed: ${e}`, 'error');
  }
  loading.value = false;
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

onUnmounted(() => {
  [search, path].forEach(r => (r.value = ""));
  [tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:heading" />
          Rename
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400 tracking-wider">
          Rename the columns of a CSV
        </div>
      </div>
    </SiliconeCard>

    <el-scrollbar class="flex-1 px-4 pb-4 min-h-0">
      <div class="flex flex-col gap-4">
        <SiliconeCard>
          <div class="flex justify-between items-center mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              FILE SELECTION
            </div>
            <div class="flex items-center">
              <SiliconeButton @click="selectFile()" size="small" text>
                <Icon icon="ri:folder-open-line" class="w-4 h-4" />
              </SiliconeButton>
              <SiliconeButton @click="renameData()" :loading="loading" size="small" text>
                <Icon icon="ri:play-large-line" class="w-4 h-4" />
              </SiliconeButton>
            </div>
          </div>

          <div v-if="path" class="mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              SELECTED FILE
            </div>
            <SiliconeText :max-lines="1" class="mb-2">{{ path }}</SiliconeText>
          </div>

          <div class="grid grid-cols-4 gap-4 mb-4">
            <div class="h-full">
              <div class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 h-full">
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
            </div>
            <div class="h-full">
              <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 h-full">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {{ currentRows }}
                    </div>
                    <div class="text-[12px] text-blue-600 dark:text-blue-400">
                      Scanned Rows
                    </div>
                  </div>
                  <div class="relative w-6 h-6 flex items-center justify-center">
                    <Icon v-if="totalRows === 0 || !isFinite(currentRows / totalRows)" icon="ri:scan-line"
                      class="w-6 h-6 text-blue-500" />
                    <SiliconeProgress v-else :percentage="Math.round((currentRows / totalRows) * 100)" />
                  </div>
                </div>
              </div>
            </div>
            <div class="h-full">
              <div class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 h-full">
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
            </div>
            <div class="h-full">
              <div class="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 h-full">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-lg font-bold text-green-600 dark:text-green-400">
                      {{ renamedCount }}
                    </div>
                    <div class="text-[12px] text-green-600 dark:text-green-400">
                      Renamed Columns
                    </div>
                  </div>
                  <Icon icon="ri:checkbox-circle-line" class="w-6 h-6 text-green-500" />
                </div>
              </div>
            </div>
          </div>
        </SiliconeCard>

        <SiliconeCard>
          <div class="mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              SEARCH HEADER
            </div>
            <SiliconeInput v-model="search" placeholder="Type to search headers..." clearable class="w-full mb-4">
              <template #prefix>
                <Icon icon="ri:search-line" class="w-4 h-4 text-gray-400" />
              </template>
            </SiliconeInput>
            <div v-if="search" class="mt-1 text-[10px] text-gray-400 mb-4">
              Found {{ filterTableData.length }} / {{ totalColumns || 0 }} columns
            </div>
            
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
              COLUMN EDITOR
            </div>
            <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="filterTableData" :height="'400px'"
              show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center gap-2">
                  No data. Click
                  <Icon icon="ri:folder-open-line" class="w-4 h-4" />
                  to select file.
                </div>
              </template>
              <el-table-column prop="col1" label="Header" min-width="150">
                <template #default="{ row }">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ row.col1 }}
                  </span>
                </template>
              </el-table-column>

              <el-table-column prop="col2" label="New Header" min-width="150">
                <template #default="{ row }">
                  <SiliconeInput v-model="row.col2" placeholder="Enter new header name" @blur="headerEdit(row)"
                    @keyup.enter="headerEdit(row)" size="small" />
                </template>
              </el-table-column>

              <el-table-column label="Status" width="120">
                <template #default="{ row }">
                  <span v-if="row.col2 && row.col2 !== row.col1"
                    class="inline-flex items-center px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded">
                    Changed
                  </span>
                  <span v-else
                    class="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded">
                    Unchanged
                  </span>
                </template>
              </el-table-column>
            </SiliconeTable>
            </div>
          </div>
        </SiliconeCard>

        <SiliconeCard>
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
            USAGE
          </div>
          <div class="flex flex-col gap-2">
            <SiliconeText type="info">1. Click
              <Icon icon="ri:folder-open-line" class="w-4 h-4 inline align-middle" /> to select a CSV file
            </SiliconeText>
            <SiliconeText type="info">2. Use the search box to find specific headers</SiliconeText>
            <SiliconeText type="info">3. Enter new header names in the "New Header" column</SiliconeText>
            <SiliconeText type="info">4. Check the status column to see which headers have been changed</SiliconeText>
            <SiliconeText type="info">5. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to run the rename operation
            </SiliconeText>
            <SiliconeText type="info">6. Check the output log for details</SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Rename - Rename the columns of a CSV" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
:deep(.silicone-card) {
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}
</style>
