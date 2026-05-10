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
      <div class="header-content">
        <div class="header-icon" @click="dialog = true">
          <Icon icon="ri:heading" />
        </div>
        <div class="header-text">
          <h1>Rename</h1>
          <p>Rename the columns of a CSV</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="rename-main">
        <div class="p-3">
          <div class="file-selection-bar" @click="selectFile()">
            <div class="file-selection-icon">
              <Icon icon="ri:folder-open-line" />
            </div>
            <div class="file-selection-text">
              <template v-if="path">
                <span class="file-name">{{ path.split(/[/\\]/).pop() }}</span>
                <span class="file-path">{{ path }}</span>
              </template>
              <template v-else>
                <span class="file-prompt">Click to select a CSV file</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="renameData()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="stats-grid mt-4">
            <div class="stat-card">
              <div class="stat-label">Total Rows</div>
              <div class="stat-value">{{ totalRows }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Progress</div>
              <SiliconeProgress v-if="totalRows > 0 && isFinite(currentRows / totalRows)"
                :percentage="Math.round((currentRows / totalRows) * 100)" class="mt-2" />
            </div>
            <div class="stat-card">
              <div class="stat-label">Columns</div>
              <div class="stat-value">{{ totalColumns || 0 }}</div>
            </div>
            <div class="stat-card stat-green">
              <div class="stat-label">To Rename</div>
              <div class="stat-value">{{ renamedCount }}</div>
            </div>
          </div>

          <div class="search-section mt-4 mb-4">
            <div class="option-label">SEARCH HEADER</div>
            <SiliconeInput v-model="search" placeholder="Type to search headers..." clearable class="w-full">
              <template #prefix>
                <Icon icon="ri:search-line" class="w-4 h-4 text-gray-400" />
              </template>
            </SiliconeInput>
            <div v-if="search" class="mt-1 text-[10px] text-gray-400">
              Found {{ filterTableData.length }} / {{ totalColumns || 0 }} columns
            </div>
          </div>

          <div class="preview-header">
            <span class="preview-title">COLUMN EDITOR ({{ filterTableData.length }})</span>
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
.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #409eff, #66b1ff);
  border-radius: 12px;
  font-size: 24px;
  color: white;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
  cursor: pointer;
}

.header-text h1 {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  margin: 0 0 4px 0;
}

.dark .header-text h1 {
  color: #e8e8e8;
}

.header-text p {
  font-size: 13px;
  color: #888;
  margin: 0;
}

.dark .header-text p {
  color: #999;
}

.rename-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-selection-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(145deg, #f8f8f8, #f0f0f0);
  border: 2px dashed #ddd;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.file-selection-bar:hover {
  border-color: #409eff;
  background: linear-gradient(145deg, #f0f8ff, #e6f2ff);
}

.dark .file-selection-bar {
  background: linear-gradient(145deg, #2a2a2a, #222);
  border-color: #444;
}

.dark .file-selection-bar:hover {
  border-color: #409eff;
  background: linear-gradient(145deg, #1e2a3a, #1a2535);
}

.file-selection-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #e8e8e8, #d8d8d8);
  border-radius: 10px;
  font-size: 20px;
  color: #666;
  flex-shrink: 0;
}

.dark .file-selection-icon {
  background: linear-gradient(145deg, #3a3a3a, #2d2d2d);
  color: #777;
}

.file-selection-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  flex: 1;
}

.file-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.dark .file-name {
  color: #e0e0e0;
}

.file-path {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-prompt {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.dark .file-prompt {
  color: #aaa;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  background: linear-gradient(145deg, #f5f5f5, #e8e8e8);
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.dark .stat-card {
  background: linear-gradient(145deg, #2a2a2a, #222);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.dark .stat-value {
  color: #e0e0e0;
}

.stat-card.stat-green .stat-value {
  color: #67c23a;
}

.stat-label {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.dark .stat-label {
  color: #999;
}

.search-section {
  display: flex;
  flex-direction: column;
}

.option-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: #666;
}

.dark .preview-title {
  color: #999;
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
