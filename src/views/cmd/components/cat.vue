<script setup lang="ts">
import { ref, watch, reactive, onUnmounted } from "vue";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mdCat, useMarkdown } from "@/utils/markdown";
import { trimOpenFile } from "@/utils/view";
import { useQuoting, useSkiprows } from "@/store/modules/options";

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
  addLog('Opening file selection dialog...', 'info');

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

    addLog(`Selected ${fileSelect.value.length} files`, 'info');

    if (mode.value === "excel") {
      await loadExcelSheets();
    } else {
      addLog('File selection completed', 'info');
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
    addLog("No files selected", 'warning');
    return;
  }

  addLog('Opening save dialog...', 'info');
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

  if (!outputPath) {
    addLog('Save dialog cancelled', 'info');
    return;
  }

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
  addLog(`Removed file: ${removedFile.filename}`, 'info');
};

onUnmounted(() => {
  [path, backendInfo].forEach(r => (r.value = ""));
  [fileSelect, fileSheet].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:merge-cells-vertical" />
          Cat
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400 tracking-wider">
          Merge CSV or Excel files
        </div>
        <div class="mode-toggle ml-auto">
          <span v-for="item in modeOptions" :key="item.value" class="mode-item mx-1 w-24" :class="{ active: mode === item.value }"
            @click="mode = item.value">
            {{ item.label }}
          </span>
        </div>
      </div>
    </SiliconeCard>

    <el-scrollbar class="flex-1 px-4 pb-4 min-h-0">
      <div class="flex flex-col">
        <SiliconeCard>
          <div class="flex justify-between items-center mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              SELECTED FILE(S)
            </div>
            <div class="flex items-center">
              <SiliconeButton @click="openFile()" size="small" text>
                <Icon icon="ri:folder-open-line" class="w-4 h-4" />
              </SiliconeButton>
              <SiliconeButton @click="run()" :loading="loading" size="small" text>
                <Icon icon="ri:play-large-line" class="w-4 h-4" />
              </SiliconeButton>
            </div>
          </div>

          <div v-if="mode === 'excel'" class="mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              SHEETS
            </div>
            <SiliconeTooltip content="Merge all sheets or select one per file" placement="right">
              <div class="mode-toggle">
                <span v-for="item in sheetsOptions" :key="String(item.value)" @click="allSheets = item.value"
                  class="mode-item mx-1 w-24" :class="{ active: allSheets === item.value }">
                  {{ item.label }}
                </span>
              </div>
            </SiliconeTooltip>
          </div>

          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="fileSelect" :height="'300px'" show-overflow-tooltip :row-style="{ height: '40px' }"
              :cell-style="{
                borderBottom: '1px solid #f0f0f0'
              }">
              <template #empty>
                <div class="flex items-center gap-2">
                  No data. Click
                  <Icon icon="ri:folder-open-line" class="w-4 h-4" />
                  to select files.
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
        </SiliconeCard>

        <SiliconeCard>
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
            USAGE
          </div>
          <div class="flex flex-col gap-2">
            <SiliconeText type="info">1. Click
              <Icon icon="ri:folder-open-line" class="w-4 h-4 inline align-middle" /> to select files
            </SiliconeText>
            <SiliconeText type="info">2. Choose mode: Csv or Excel</SiliconeText>
            <SiliconeText type="info">3. For Excel files, select sheets mode: All Sheets or One Sheet</SiliconeText>
            <SiliconeText type="info">4. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to merge files
            </SiliconeText>
            <SiliconeText type="info">5. Check the output log for details</SiliconeText>
          </div>
        </SiliconeCard>
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
:deep(.silicone-card) {
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}
</style>
