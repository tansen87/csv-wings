<script setup lang="ts">
import { ref, watch, reactive } from "vue";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import {
  FolderOpened,
  Loading,
  SwitchButton,
  Select as SelectIcon,
  CloseBold
} from "@element-plus/icons-vue";
import { useDark } from "@pureadmin/utils";
import { useDynamicHeight } from "@/utils/utils";
import { mdCat, useMarkdown } from "@/utils/markdown";
import { message, closeAllMessage } from "@/utils/message";
import { trimOpenFile } from "@/utils/view";
import { useQuoting, useSkiprows } from "@/store/modules/options";

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
    infoMsg?: string;
    status?: "loading" | "success" | "error";
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
const { isDark } = useDark();
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

listen("info", (event: Event<string>) => {
  const filename = event.payload;
  fileSelect.value.forEach(f => {
    if (f.filename === filename) f.status = "loading";
  });
});
listen("err", (event: Event<string>) => {
  const [filename, msg] = event.payload.split("|");
  fileSelect.value.forEach(f => {
    if (f.filename === filename) {
      f.status = "error";
      f.message = msg;
    }
  });
});
listen("success", (event: Event<string>) => {
  const filename = event.payload;
  fileSelect.value.forEach(f => {
    if (f.filename === filename) f.status = "success";
  });
});

async function loadExcelSheets() {
  if (!path.value || fileSelect.value.length === 0) return;

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

  try {
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
      backendInfo.value = "Files loaded";
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

  if (!outputPath) {
    message("Save cancelled", { type: "warning" });
    return;
  }

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
        output_path: outputPath,
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
</script>

<template>
  <el-form class="page-container" :style="dynamicHeight">
    <el-splitter>
      <el-splitter-panel size="200" :resizable="false">
        <div class="splitter-container mr-1">
          <SiliconeButton @click="selectFile()" :icon="FolderOpened" text>
            Open File(s)
          </SiliconeButton>

          <div class="mode-toggle mt-2">
            <span
              v-for="item in modeOptions"
              :key="item.value"
              class="mode-item"
              :class="{
                active: mode === item.value,
                'active-dark': isDark && mode === item.value
              }"
              @click="mode = item.value"
            >
              {{ item.label }}
            </span>
          </div>

          <el-tooltip
            v-if="mode === 'excel'"
            content="Merge all sheets of each file, or only one selected sheet per file"
            effect="light"
            placement="right"
          >
            <div class="mode-toggle mt-2">
              <span
                v-for="item in sheetsOptions"
                :key="String(item.value)"
                class="mode-item"
                :class="{
                  active: allSheets === item.value,
                  'active-dark': isDark && allSheets === item.value
                }"
                @click="allSheets = item.value"
              >
                {{ item.label }}
              </span>
            </div>
          </el-tooltip>

          <el-link @click="dialog = true" class="mt-auto" underline="never">
            <SiliconeText v-if="backendCompleted">
              {{ backendInfo }}
            </SiliconeText>
            <SiliconeText v-else class="mb-[1px]">Cat</SiliconeText>
          </el-link>
        </div>
      </el-splitter-panel>

      <el-splitter-panel>
        <SiliconeButton
          @click="concatData()"
          :loading="isLoading"
          :icon="SwitchButton"
          text
          class="mb-2 ml-2"
        >
          Run
        </SiliconeButton>

        <SiliconeTable
          :data="fileSelect"
          :height="dynamicHeight"
          show-overflow-tooltip
          tooltip-effect="light"
          :row-style="{ height: '40px' }"
          :cell-style="{ padding: '0 8px' }"
        >
          <el-table-column type="index" width="35" />
          <el-table-column prop="filename" label="File" />
          <el-table-column label="Status" width="80">
            <template #default="scope">
              <ElIcon v-if="scope.row.status === 'loading'" class="is-loading">
                <Loading />
              </ElIcon>
              <ElIcon
                v-else-if="scope.row.status === 'success'"
                color="#00CD66"
              >
                <SelectIcon />
              </ElIcon>
              <ElIcon v-else-if="scope.row.status === 'error'" color="#FF0000">
                <CloseBold />
              </ElIcon>
              <span v-if="scope.row.message" class="ml-1">{{
                scope.row.message
              }}</span>
            </template>
          </el-table-column>

          <el-table-column label="Options / Info">
            <template #default="scope">
              <template v-if="mode === 'excel'">
                <SiliconeSelect
                  v-model="scope.row.selectSheet"
                  placeholder="Select sheet"
                  class="mb-[1px]"
                  :disabled="!scope.row.sheets || scope.row.sheets.length === 0"
                >
                  <el-option
                    v-for="sheet in scope.row.sheets"
                    :key="sheet"
                    :label="sheet"
                    :value="sheet"
                  />
                </SiliconeSelect>
              </template>
              <!-- For CSV: show duplicate header info (if any) -->
              <template v-else>
                {{ scope.row.infoMsg }}
              </template>
            </template>
          </el-table-column>
        </SiliconeTable>
      </el-splitter-panel>
    </el-splitter>

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
