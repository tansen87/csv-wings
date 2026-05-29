<script setup lang="ts">
import { ref, watch, reactive, onUnmounted, computed } from "vue";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mdCat, useMarkdown } from "@/utils/markdown";
import { trimOpenFile } from "@/utils/view";
import { useQuoting, useSkiprows } from "@/store/modules/setting";
import { message } from "@/utils/message";
import { useLocale, t } from "@/store/modules/locale";
import { storeToRefs } from "pinia";
import "./common.css";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const localeStore = useLocale();
const { locale } = storeToRefs(localeStore);

const mode = ref("csv");
const modeOptions = computed(() => [
  { label: t('csv', locale.value), value: "csv" },
  { label: t('excel', locale.value), value: "excel" }
]);
const [backendInfo, path] = [ref(""), ref("")];
const fileSelect = ref<
  Array<{
    filename: string;
    selectSheet?: string;
    sheets?: string[];
    infoMsg?: string;
    status?: string;
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
const sheetsOptions = computed(() => [
  { label: t('allSheets', locale.value), value: true },
  { label: t('oneSheet', locale.value), value: false }
]);

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

    addLog(t('fetchingExcelSheets', locale.value), 'info');

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

    addLog(t('sheetDetectionCompleted', locale.value), 'success');
  } catch (e) {
    addLog(`${t('loadExcelSheetsFailed', locale.value)}: ${e}`, 'error');
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
    addLog(`${t('failedToOpenFile', locale.value)}: ${e}`, 'error');
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
    message(t('noFilesSelected', locale.value), { type: 'warning' });
    return;
  }

  const outputPath = await save({
    title: t('exportCsv', locale.value),
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
    addLog(`${t('startingMergeProcess', locale.value)} ${fileSelect.value.length} ${t('files', locale.value)}...`, 'info');
    let rtime: string;

    if (mode.value === "excel") {
      addLog(t('processingExcelFiles', locale.value), 'info');
      rtime = await invoke("cat_excel", {
        path: path.value,
        outputPath,
        skiprows: skiprows.skiprows,
        quoting: quoting.quoting,
        sheetMapping: allSheets.value ? [] : fileSheet.value,
        allSheets: allSheets.value
      });
    } else {
      addLog(t('processingCsvFiles', locale.value), 'info');
      rtime = await invoke("cat_csv", {
        path: path.value,
        outputPath,
        quoting: quoting.quoting,
        skiprows: skiprows.skiprows
      });
    }

    addLog(`${t('mergeCompleted', locale.value)} ${rtime}s`, 'success');
  } catch (e) {
    addLog(`${t('catFailed', locale.value)}: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
}

const removeFile = index => {
  const removedFile = fileSelect.value[index];
  fileSelect.value.splice(index, 1);
  message(`${t('removedFile', locale.value)}: ${removedFile.filename}`, { type: 'info' });
};

onUnmounted(() => {
  [path, backendInfo].forEach(r => (r.value = ""));
  [fileSelect, fileSheet].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:merge-cells-vertical" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('cat', locale) }}</h1>
          <p>{{ t('catDesc', locale) }}</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="cmd-main">
        <div class="p-3">
          <div class="cmd-file-selection-bar mb-4" @click="openFile()">
            <div class="cmd-file-selection-icon">
              <Icon icon="ri:folder-open-line" />
            </div>
            <div class="cmd-file-selection-text">
              <template v-if="path">
                <span class="cmd-file-name">{{ fileSelect.length }} {{ t('file', locale) }}(s) {{ t('selected', locale) }}</span>
              </template>
              <template v-else>
                <span class="cmd-file-prompt">{{ t('clickToSelectFiles', locale) }}</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="run()" :loading="loading" size="small">
                {{ t('run', locale) }}
              </SiliconeButton>
            </div>
          </div>

          <div class="flex justify-center">
            <div class="cmd-mode-toggle py-1">
              <span v-for="item in modeOptions" :key="item.value" class="cmd-mode-item mx-0.5 w-28"
                :class="{ active: mode === item.value }" @click="mode = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <div v-if="mode === 'excel'" class="mb-4 mt-4 flex justify-center">
            <SiliconeTooltip :content="t('mergeAllSheetsOrSelect', locale)">
              <div class="cmd-mode-toggle py-1">
                <span v-for="item in sheetsOptions" :key="String(item.value)" @click="allSheets = item.value"
                  class="cmd-mode-item mx-0.5 w-28" :class="{ active: allSheets === item.value }">
                  {{ item.label }}
                </span>
              </div>
            </SiliconeTooltip>
          </div>

          <div class="cmd-preview-header mt-4">
            <span class="cmd-preview-title">{{ t('fileList', locale) }} ({{ fileSelect.length }})</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="fileSelect" :height="'300px'" show-overflow-tooltip :row-style="{ height: '40px' }"
              :cell-style="{
                borderBottom: '1px solid #f0f0f0'
              }">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  {{ t('noDataClickSelectFiles', locale) }}
                </div>
              </template>
              <el-table-column prop="filename" :label="t('fileName', locale)" min-width="150" />
              <el-table-column :label="t('options', locale)" min-width="150">
                <template #default="scope">
                  <template v-if="
                    mode === 'excel' &&
                    scope.row.sheets &&
                    scope.row.sheets.length > 0
                  ">
                    <SiliconeSelect v-model="scope.row.selectSheet" :placeholder="t('selectSheet', locale)" size="small"
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

    <SiliconeDialog v-model="dialog" :title="`${t('cat', locale)} - ${t('catDesc', locale)}`"
      width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>