<script setup lang="ts">
import { ref, watch, reactive, onUnmounted } from "vue";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mdCat, useMarkdown } from "@/utils/markdown";
import { trimOpenFile } from "@/utils/view";
import { useQuoting, useSkiprows } from "@/store/modules/options";
import { message } from "@/utils/message";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const mode = ref("csv");
const modeOptions = [
  { label: "Csv", value: "csv" },
  { label: "Excel", value: "excel" }
];
const [backendInfo, path] = [ref(""), ref("")];
const fileSelect = ref<
  Array<{
    filename: string;
    selectSheet?: string;
    sheets?: string[];
    message?: string;
  }>
>([]);
const [loading, dialog] = [
  ref(false),
  ref(false)
];
const { dynamicHeight } = useDynamicHeight(82);
const { mdShow } = useMarkdown(mdCat);
const quoting = useQuoting();
const skiprows = useSkiprows();

const addLog = (message: string, type: string = 'info') => {
  emit('add-log', `[Cat] ${message}`, type);
};

const allSheets = ref(true);
const mapSheets = ref<Record<string, string[]> | null>(null);
const fileSheet = ref<Array<{ filename: string; sheetname: string }>>([]);
const sheetsOptions = [
  { label: "All Sheets", value: true },
  { label: "One Sheet", value: false }
];

// Watch selectSheet changes to update fileSheet
watch(
  () => fileSelect.value.map(f => f.selectSheet),
  (newVal, oldVal) => {
    newVal.forEach((sheet, idx) => {
      if (sheet !== oldVal?.[idx]) {
        const filename = fileSelect.value[idx].filename;
        const record = { filename, sheetname: sheet || "" };
        const existing = fileSheet.value.findIndex(
          r => r.filename === filename
        );
        if (existing >= 0) {
          fileSheet.value[existing] = record;
        } else {
          fileSheet.value.push(record);
        }
      }
    });
  },
  { deep: true }
);

// Helper: get sheets by filename
function getSheetsForFile(fileName: string): string[] {
  return mapSheets.value?.[fileName] || [];
}

async function loadExcelSheets() {
  if (!path.value || fileSelect.value.length === 0) return;

  try {
    // 避免重复加载:检查是否已有 sheets
    const alreadyLoaded = fileSelect.value.some(
      f => f.sheets && f.sheets.length > 0
    );
    if (alreadyLoaded) return;

    addLog('Fetching Excel sheets...', 'info');

    const result = await invoke<
      [Record<string, string[]>, Record<string, string>]
    >("map_excel_sheets", { path: path.value });
    mapSheets.value = result[0];

    fileSelect.value.forEach(file => {
      const sheets = getSheetsForFile(file.filename) || [];
      file.sheets = sheets;
      if (sheets.length > 0) {
        file.selectSheet = sheets[0]; // default to first
      }
    });

    addLog("Sheet detection completed", 'success');
  } catch (e) {
    addLog(`loadExcelSheets failed: ${e}`, 'error');
  }
}

async function openFile() {
  fileSelect.value = [];
  fileSheet.value = [];
  mapSheets.value = null;

  try {
    const trimFile = await trimOpenFile(true, "Files", ["*"], {
      includeStatus: true
    });
    path.value = trimFile.filePath;

    // Create reactive rows with explicit fields
    fileSelect.value = trimFile.fileInfo.map(f =>
      reactive({
        filename: f.filename,
        selectSheet: "",
        sheets: [],
        infoMsg: "",
        status: undefined,
        message: ""
      })
    );

    if (mode.value === "excel") {
      await loadExcelSheets();
    }
  } catch (e) {
    addLog(`Failed to open file: ${e}`, 'error');
  }
}

// Watch mode change to auto-load sheets
watch(
  () => mode.value,
  async (newMode, oldMode) => {
    if (newMode === "excel" && oldMode === "csv") {
      // Only load if files are already selected
      if (path.value && fileSelect.value.length > 0) {
        await loadExcelSheets();
      }
    }
    // Optional: reset excel-specific state when switching back to CSV
    if (newMode === "csv") {
      fileSheet.value = [];
      mapSheets.value = null;
    }
  }
);

async function run() {
  if (path.value === "") {
    message("No files selected", { type: 'warning' });
    return;
  }

  const outputPath = await save({
    title: "Export Csv",
    defaultPath: `cat_${new Date().getTime()}`,
    filters: [
      {
        name: "CSV",
        extensions: ["csv"]
      }
    ]
  });

  if (!outputPath) return;

  try {
    loading.value = true;
    addLog(`Starting merge process for ${fileSelect.value.length} files...`, 'info');
    let rtime: string;

    if (mode.value === "excel") {
      addLog('Processing Excel files...', 'info');
      rtime = await invoke("cat_excel", {
        path: path.value,
        outputPath,
        skiprows: skiprows.skiprows,
        quoting: quoting.quoting,
        sheetMapping: allSheets.value ? [] : fileSheet.value,
        allSheets: allSheets.value
      });
    } else {
      addLog('Processing CSV files...', 'info');
      rtime = await invoke("cat_csv", {
        path: path.value,
        outputPath,
        quoting: quoting.quoting,
        skiprows: skiprows.skiprows
      });
    }

    addLog(`Merge completed in ${rtime}s`, 'success');
  } catch (e) {
    addLog(`cat failed: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
}

const removeFile = index => {
  const removedFile = fileSelect.value[index];
  fileSelect.value.splice(index, 1);
  message(`Removed file: ${removedFile.filename}`, { type: 'info' });
};

onUnmounted(() => {
  [path, backendInfo].forEach(r => (r.value = ""));
  [fileSelect, fileSheet].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="header-content">
        <div class="header-icon" @click="dialog = true">
          <Icon icon="ri:merge-cells-vertical" />
        </div>
        <div class="header-text">
          <h1>Cat</h1>
          <p>Merge CSV or Excel files</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="cat-main">
        <div class="p-3">
          <div class="file-selection-bar mb-4" @click="openFile()">
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
              <SiliconeButton @click.stop="run()" :loading="loading" size="small">
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

          <div v-if="mode === 'excel'" class="mb-4 mt-4">
            <SiliconeTooltip content="Merge all sheets or select one per file" placement="right">
              <div class="mode-toggle">
                <span v-for="item in sheetsOptions" :key="String(item.value)" @click="allSheets = item.value"
                  class="mode-item mx-0.5" :class="{ active: allSheets === item.value }">
                  {{ item.label }}
                </span>
              </div>
            </SiliconeTooltip>
          </div>

          <div class="preview-header mt-4">
            <span class="preview-title">FILE LIST ({{ fileSelect.length }})</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="fileSelect" :height="'300px'" show-overflow-tooltip :row-style="{ height: '40px' }"
              :cell-style="{
                borderBottom: '1px solid #f0f0f0'
              }">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  No data. Click above to select files.
                </div>
              </template>
              <el-table-column prop="filename" label="File Name" min-width="150" />
              <el-table-column label="Options" min-width="150">
                <template #default="scope">
                  <template v-if="
                    mode === 'excel' &&
                    scope.row.sheets &&
                    scope.row.sheets.length > 0
                  ">
                    <SiliconeSelect v-model="scope.row.selectSheet" placeholder="Select sheet" size="small"
                      class="mb-[1px]">
                      <el-option v-for="sheet in scope.row.sheets" :key="sheet" :label="sheet" :value="sheet" />
                    </SiliconeSelect>
                  </template>
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

    <SiliconeDialog v-model="dialog" title="Cat - Merge multiple CSV or Excel files" width="70%">
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

.cat-main {
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
