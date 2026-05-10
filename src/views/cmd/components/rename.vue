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
import { message } from "@/utils/message";
import "./common.css";

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
  } catch (e) {
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

// invoke rename
async function renameData() {
  if (path.value === "") {
    message("CSV file not selected", { type: 'warning' });
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
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:heading" />
        </div>
        <div class="cmd-header-text">
          <h1>Rename</h1>
          <p>Rename the columns of a CSV</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="cmd-main">
        <div class="p-3">
          <div class="cmd-file-selection-bar" @click="selectFile()">
            <div class="cmd-file-selection-icon">
              <Icon icon="ri:folder-open-line" />
            </div>
            <div class="cmd-file-selection-text">
              <template v-if="path">
                <span class="cmd-file-name">{{ path.split(/[/\\]/).pop() }}</span>
                <span class="cmd-file-path">{{ path }}</span>
              </template>
              <template v-else>
                <span class="cmd-file-prompt">Click to select a CSV file</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="renameData()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="cmd-stats-grid mt-4">
            <div class="cmd-stat-card">
              <div class="cmd-stat-label">Total Rows</div>
              <div class="cmd-stat-value">{{ totalRows }}</div>
            </div>
            <div class="cmd-stat-card">
              <div class="cmd-stat-label">Progress</div>
              <SiliconeProgress v-if="totalRows > 0 && isFinite(currentRows / totalRows)"
                :percentage="Math.round((currentRows / totalRows) * 100)" class="mt-2" />
            </div>
            <div class="cmd-stat-card cmd-stat-green">
              <div class="cmd-stat-label">To Rename</div>
              <div class="cmd-stat-value">{{ renamedCount }}</div>
            </div>
          </div>

          <div class="rename-search-section mt-4 mb-4">
            <div class="cmd-option-label">SEARCH HEADER</div>
            <SiliconeInput v-model="search" placeholder="Type to search headers..." clearable class="w-full">
              <template #prefix>
                <Icon icon="ri:search-line" class="w-4 h-4 text-gray-400" />
              </template>
            </SiliconeInput>
            <div v-if="search" class="mt-1 text-[10px] text-gray-400">
              Found {{ filterTableData.length }} / {{ totalColumns || 0 }} columns
            </div>
          </div>

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">COLUMN EDITOR ({{ filterTableData.length }})</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="filterTableData" :height="'350px'" show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  No data. Click above to select file.
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
                  <span v-if="row.col2 && row.col2 !== row.col1" class="status-changed">
                    Changed
                  </span>
                  <span v-else class="status-unchanged">
                    Unchanged
                  </span>
                </template>
              </el-table-column>
            </SiliconeTable>
          </div>
        </div>
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
.rename-search-section {
  display: flex;
  flex-direction: column;
}

.cmd-stat-card.cmd-stat-green .cmd-stat-value {
  color: #67c23a;
}

.status-changed {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 12px;
  color: #67c23a;
  background: rgba(103, 194, 58, 0.1);
  border-radius: 4px;
}

.dark .status-changed {
  color: #67c23a;
  background: rgba(103, 194, 58, 0.15);
}

.status-unchanged {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 12px;
  color: #999;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.dark .status-unchanged {
  color: #888;
  background: rgba(255, 255, 255, 0.05);
}
</style>
