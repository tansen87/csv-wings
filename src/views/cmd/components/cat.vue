<script setup lang="ts">
import { ref, watch, reactive, onUnmounted } from "vue";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { Loading } from "@element-plus/icons-vue";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mdCat, useMarkdown } from "@/utils/markdown";
import { message, closeAllMessage } from "@/utils/message";
import { trimOpenFile } from "@/utils/view";
import { useQuoting, useSkiprows } from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

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
const [isLoading, backendCompleted, dialog] = [
  ref(false),
  ref(false),
  ref(false)
];
const { dynamicHeight } = useDynamicHeight(82);
const { mdShow } = useMarkdown(mdCat);
const quoting = useQuoting();
const skiprows = useSkiprows();

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

    message("Fetching Excel sheets...", {
      type: "info",
      duration: 0,
      icon: Loading
    });

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

    backendInfo.value = "Sheet detection completed";
    backendCompleted.value = true;
  } catch (err) {
    message(err.toString(), { type: "error" });
    closeAllMessage();
  } finally {
    closeAllMessage();
  }
}

async function selectFile() {
  fileSelect.value = [];
  fileSheet.value = [];
  mapSheets.value = null;
  backendInfo.value = "";
  backendCompleted.value = false;

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
    } else {
      backendCompleted.value = true;
    }
  } catch (err) {
    closeAllMessage();
    message(err.toString(), { type: "error" });
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

async function concatData() {
  if (path.value === "") {
    message("No files selected", { type: "warning" });
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
    isLoading.value = true;
    let rtime: string;

    if (mode.value === "excel") {
      rtime = await invoke("cat_excel", {
        path: path.value,
        outputPath,
        skiprows: skiprows.skiprows,
        quoting: quoting.quoting,
        sheetMapping: allSheets.value ? [] : fileSheet.value,
        allSheets: allSheets.value
      });
    } else {
      rtime = await invoke("cat_csv", {
        path: path.value,
        outputPath,
        quoting: quoting.quoting,
        skiprows: skiprows.skiprows
      });
    }

    backendInfo.value = `Merge completed in ${rtime}s`;
    message(backendInfo.value, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error" });
  } finally {
    isLoading.value = false;
  }
}

const removeFile = index => {
  fileSelect.value.splice(index, 1);
};

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => concatData(),
  onHelp: () => {
    dialog.value = !dialog.value;
  }
});

onUnmounted(() => {
  [path, backendInfo].forEach(r => (r.value = ""));
  [fileSelect, fileSheet].forEach(r => (r.value = []));
});
</script>

<template>
  <el-form class="page-view">
    <header
      class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800"
    >
      <div class="flex items-center gap-4">
        <h1
          class="text-xl font-bold dark:text-white flex items-center gap-4"
          @click="dialog = true"
        >
          <Icon icon="ri:merge-cells-vertical" />
          Cat
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="mode-toggle w-40">
          <span
            v-for="item in modeOptions"
            :key="item.value"
            class="mode-item"
            :class="{ active: mode === item.value }"
            @click="mode = item.value"
          >
            {{ item.label }}
          </span>
        </div>
      </div>

      <div>
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File(s)
        </SiliconeButton>

        <SiliconeButton @click="concatData()" :loading="isLoading" text>
          Run
        </SiliconeButton>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <aside
        class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4 hidden md:flex"
      >
        <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
          STATISTICS
        </div>
        <div class="space-y-4">
          <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div class="text-2xl font-bold text-gray-800 dark:text-white">
              {{ fileSelect.length }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              Files Loaded
            </div>
          </div>
        </div>

        <div v-if="mode === 'excel'" class="flex flex-col mt-4">
          <span
            class="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-2"
          >
            SHEETS
          </span>

          <SiliconeTooltip content="Merge all sheets or select one per file">
            <div class="mode-toggle">
              <span
                v-for="item in sheetsOptions"
                :key="String(item.value)"
                @click="allSheets = item.value"
                class="mode-item"
                :class="{ active: allSheets === item.value }"
              >
                {{ item.label }}
              </span>
            </div>
          </SiliconeTooltip>
        </div>

        <div class="mt-auto">
          <div v-if="backendCompleted" class="text-xs text-gray-400">
            {{ backendInfo }}
          </div>
        </div>
      </aside>

      <div
        class="flex-1 bg-white dark:bg-gray-800 flex flex-col overflow-hidden"
      >
        <div class="flex-1 overflow-auto p-2">
          <SiliconeTable
            :data="fileSelect"
            :height="'100%'"
            empty-text="No data. (Ctrl+D) to Open File(s)."
            show-overflow-tooltip
            :row-style="{ height: '50px' }"
            :cell-style="{
              borderBottom: '1px solid #f0f0f0'
            }"
          >
            <el-table-column prop="filename" label="File Name" />
            <el-table-column label="Options">
              <template #default="scope">
                <template
                  v-if="
                    mode === 'excel' &&
                    scope.row.sheets &&
                    scope.row.sheets.length > 0
                  "
                >
                  <SiliconeSelect
                    v-model="scope.row.selectSheet"
                    placeholder="Select sheet"
                    size="small"
                    class="mb-[1px]"
                  >
                    <el-option
                      v-for="sheet in scope.row.sheets"
                      :key="sheet"
                      :label="sheet"
                      :value="sheet"
                    />
                  </SiliconeSelect>
                </template>
              </template>
            </el-table-column>

            <el-table-column width="55">
              <template #default="scope">
                <SiliconeTag @click="removeFile(scope.$index)" type="danger">
                  <Icon icon="ri:delete-bin-line" />
                </SiliconeTag>
              </template>
            </el-table-column>
          </SiliconeTable>
        </div>
      </div>
    </main>

    <SiliconeDialog
      v-model="dialog"
      title="Cat - Merge multiple CSV or Excel files"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
