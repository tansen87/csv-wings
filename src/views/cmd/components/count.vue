<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { ElIcon } from "element-plus";
import { Loading, CloseBold, Select } from "@element-plus/icons-vue";
import { Icon } from "@iconify/vue";
import { shortFileName, useDynamicHeight, updateEvent } from "@/utils/utils";
import { useMarkdown, mdCount } from "@/utils/markdown";
import { useSkiprows } from "@/store/modules/options";
import { message } from "@/utils/message";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const mode = ref("count");
const modeOptions = [
  { label: "Count", value: "count" },
  { label: "Check", value: "check" }
];
const path = ref("");
const [dialog, loading] = [ref(false), ref(false)];
const fileSelect = ref([]);
const { dynamicHeight } = useDynamicHeight(82);
const { mdShow } = useMarkdown(mdCount);
const skiprows = useSkiprows();

const addLog = (message: string, type: string = 'info') => {
  emit('add-log', `[Count] ${message}`, type);
};

listen("info", (event: Event<string>) => {
  const filename = event.payload;
  updateEvent(fileSelect, filename, file => {
    file.status = "";
  });
});
listen("err", (event: Event<string>) => {
  const [filename, message] = event.payload.split("|");
  updateEvent(fileSelect, filename, file => {
    file.status = "error";
    file.message = message;
  });
});
listen("success", (event: Event<string>) => {
  const [filename, message] = event.payload.split("|");
  updateEvent(fileSelect, filename, file => {
    file.status = "success";
    file.message = message;
  });
});

const successCount = computed(() => {
  return fileSelect.value.filter(f => f.status === "success").length;
});
const failedCount = computed(() => {
  return fileSelect.value.filter(f => f.status === "error").length;
});
const totalRows = computed(() => {
  return fileSelect.value
    .filter(f => f.status === "success")
    .reduce((sum, f) => sum + (parseInt(f.message) || 0), 0) as number;
});

async function selectFile() {
  const selected = await open({
    multiple: true,
    filters: [
      {
        name: "csv",
        extensions: ["*"]
      }
    ]
  });
  if (Array.isArray(selected)) {
    path.value = selected.join("|").toString();
    const nonEmptyRows = selected.filter((row: any) => row.trim() !== "");
    fileSelect.value = nonEmptyRows.map((file: any) => {
      return { filename: shortFileName(file), status: " " };
    });
  } else if (selected === null) {
    return;
  } else {
    path.value = selected;
    fileSelect.value = [{ filename: shortFileName(selected), status: " " }];
  }
}

async function countData() {
  if (path.value === "") {
    message("CSV file not selected", { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(`Starting ${mode.value}...`, 'info');
    const rtime: string = await invoke("count", {
      path: path.value,
      mode: mode.value,
      skiprows: skiprows.skiprows
    });
    addLog(`${mode.value} done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`${e}`, 'error');
  }
  loading.value = false;
}

const removeFile = index => {
  const removedFile = fileSelect.value[index];
  fileSelect.value.splice(index, 1);
  message(`Removed file: ${removedFile.filename}`, { type: 'info' });
};

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [fileSelect].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="header-content">
        <div class="header-icon" @click="dialog = true">
          <Icon icon="ri:numbers-line" />
        </div>
        <div class="header-text">
          <h1>Count</h1>
          <p>Count or check CSV files</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="count-main">
        <div class="p-3">
          <div class="file-selection-bar mb-4" @click="selectFile()">
            <div class="file-selection-icon">
              <Icon icon="ri:folder-open-line" />
            </div>
            <div class="file-selection-text">
              <template v-if="path">
                <span class="file-name">{{ fileSelect.length }} file(s) selected</span>
              </template>
              <template v-else>
                <span class="file-prompt">Click to select files</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="countData()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="mode-toggle py-1">
            <span v-for="item in modeOptions" :key="item.value" class="mode-item mx-0.5"
              :class="{ active: mode === item.value }" @click="mode = item.value">
              {{ item.label }}
            </span>
          </div>

          <div v-if="fileSelect.length > 0" class="stats-grid mt-4">
            <div class="stat-card stat-success">
              <div class="stat-value">{{ successCount }}</div>
              <div class="stat-label">Succeed</div>
            </div>
            <div class="stat-card stat-error">
              <div class="stat-value">{{ failedCount }}</div>
              <div class="stat-label">Failed</div>
            </div>
            <div v-if="mode === 'count'" class="stat-card stat-total">
              <div class="stat-value">{{ totalRows }}</div>
              <div class="stat-label">Total Rows</div>
            </div>
          </div>

          <div class="preview-header mt-4">
            <span class="preview-title">FILE LIST ({{ fileSelect.length }})</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="fileSelect" :height="'300px'" show-overflow-tooltip :row-style="{ height: '40px' }"
              :cell-style="{
                borderBottom: '1px solid #f0f0f0'
              }" class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  No data. Click above to select files.
                </div>
              </template>
              <el-table-column prop="filename" label="File" min-width="150" />
              <el-table-column prop="status" width="70">
                <template #default="scope">
                  <ElIcon v-if="scope.row.status === ''" class="is-loading">
                    <Loading />
                  </ElIcon>
                  <ElIcon v-else-if="scope.row.status === 'success'">
                    <Select />
                  </ElIcon>
                  <ElIcon v-else-if="scope.row.status === 'error'">
                    <CloseBold />
                  </ElIcon>
                </template>
              </el-table-column>
              <el-table-column prop="message" label="Message" min-width="100">
                <template #default="scope">
                  <span v-if="scope.row.status === 'error'"
                    class="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                    {{ scope.row.message }}
                  </span>
                  <span v-else-if="scope.row.status === 'success'"
                    class="text-xs text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                    {{ scope.row.message }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column width="60">
                <template #default="scope">
                  <SiliconeTag @click="removeFile(scope.$index)" type="danger">
                    <Icon icon="ri:delete-bin-line" />
                  </SiliconeTag>
                </template>
              </el-table-column>
            </SiliconeTable>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Count - Count the rows of CSV files" width="70%">
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

.count-main {
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

.mode-toggle {
  display: flex;
  justify-content: center;
  margin: 0 auto;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 12px;
  max-width: 200px;
}

.mode-item {
  text-align: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-card {
  padding: 12px 16px;
  background: linear-gradient(145deg, #f8f8f8, #f0f0f0);
  border-radius: 10px;
  border: 1px solid #e0e0e0;
}

.dark .stat-card {
  background: linear-gradient(145deg, #2a2a2a, #222);
  border-color: #333;
}

.stat-success {
  background: linear-gradient(145deg, #f0fff4, #e6fff0);
  border-color: #67c23a;
}

.dark .stat-success {
  background: linear-gradient(145deg, #1a2a20, #152518);
  border-color: #2d4a2d;
}

.stat-error {
  background: linear-gradient(145deg, #fff0f0, #ffe6e6);
  border-color: #f56c6c;
}

.dark .stat-error {
  background: linear-gradient(145deg, #2a1a1a, #251515);
  border-color: #4a2d2d;
}

.stat-total {
  background: linear-gradient(145deg, #f0f4ff, #e6ebff);
  border-color: #409eff;
}

.dark .stat-total {
  background: linear-gradient(145deg, #1a1e2a, #151825);
  border-color: #2d3a4a;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #333;
}

.dark .stat-value {
  color: #e8e8e8;
}

.stat-success .stat-value {
  color: #67c23a;
}

.stat-error .stat-value {
  color: #f56c6c;
}

.stat-total .stat-value {
  color: #409eff;
}

.stat-label {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.dark .stat-label {
  color: #999;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.preview-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
