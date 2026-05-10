<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { ElIcon } from "element-plus";
import { Icon } from "@iconify/vue";
import { CloseBold, Select, Loading } from "@element-plus/icons-vue";
import { filterFileStatus, ListenEvent, updateEvent } from "@/utils/utils";
import { trimOpenFile } from "@/utils/view";
import {
  useDelimiter,
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows,
  useThreads
} from "@/store/modules/options";

const emit = defineEmits<{
  (e: "add-log", message: string, type: string): void;
}>();

const addLog = (msg: string, type = "info") => {
  emit("add-log", `[Convert] ${msg}`, type);
};

const [activeTab, chunksize, csvMode, quote, quoteStyle] = [
  ref("excel"),
  ref("1000000"),
  ref("one"),
  ref('"'),
  ref("necessary")
];
const path = ref("");
const [sheetOptions, fileSheet] = [ref([]), ref([])];
const [allSheets, loading, writeSheetname, ignoreErr, bom] = [
  ref(true),
  ref(false),
  ref(false),
  ref(false),
  ref(false)
];

// 编码相关
const [detectedEncoding, encodingConfidence, manualEncoding] = [
  ref(""),
  ref(0),
  ref("")
];
const encodingOptions = [
  { label: "Auto", value: "" },
  { label: "简体中文 (GBK)", value: "GBK" },
  { label: "UTF-8", value: "UTF-8" },
  { label: "UTF-16LE", value: "UTF-16LE" },
  { label: "UTF-16BE", value: "UTF-16BE" }
];

const modeOptions = [
  { label: "FormatCsv", value: "fmt" },
  { label: "EncodingCsv", value: "encoding" },
  { label: "Excel2Csv", value: "excel" },
  { label: "Csv2Xlsx", value: "csv" },
  { label: "Dbf2Csv", value: "dbf" },
  { label: "Json2Csv", value: "json" },
  { label: "NdJson2Csv", value: "jsonl" }
];
const sheetsOptions = [
  { label: "All", value: true },
  { label: "One", value: false }
];
const writeOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const quoteOptions = [
  { label: "'", value: "'" },
  { label: '"', value: '"' }
];
const csvModeOptions = [
  { label: "One", value: "one" },
  { label: "Multi", value: "multi" }
];
const iErrOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const fmtOptions = [
  { label: "Necessary", value: "necessary" },
  { label: "Always", value: "always" },
  { label: "NonNumeric", value: "non_numeric" },
  { label: "Never", value: "never" }
];
const bomOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const sheetsData = ref({});
const fileSelect = ref<ListenEvent[]>([]);
const quoting = useQuoting();
const flexible = useFlexible();
const progress = useProgress();
const skiprows = useSkiprows();
const threads = useThreads();
const delimiter = useDelimiter();

interface ExcelSheetMap {
  [filename: string]: string[];
}
const mapSheets = ref<ExcelSheetMap | null>(null);

listen("update-msg", (event: Event<string>) => {
  const [filename, rows] = event.payload.split("|");
  updateEvent(fileSelect, filename, file => {
    file.currentRows = rows;
  });
});
listen("total-msg", (event: Event<string>) => {
  const [filename, rows] = event.payload.split("|");
  updateEvent(fileSelect, filename, file => {
    file.totalRows = rows;
  });
});
listen("info", (event: Event<string>) => {
  const filename = event.payload;
  updateEvent(fileSelect, filename, file => {
    file.status = "loading";
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
  const filename = event.payload;
  updateEvent(fileSelect, filename, file => {
    file.status = "success";
  });
});

const getSheetsForFile = fileName => {
  return sheetsData.value[fileName] || [];
};

watch(
  () => fileSelect.value.map(file => file.selectSheet),
  (newVal, oldVal) => {
    newVal.forEach((selectSheet, index) => {
      if (selectSheet !== oldVal?.[index]) {
        const fileSheetRecord = {
          filename: fileSelect.value[index].filename,
          sheetname: selectSheet
        };
        const existingIndex = fileSheet.value.findIndex(
          record => record.filename === fileSheetRecord.filename
        );
        if (existingIndex > -1) {
          fileSheet.value.splice(existingIndex, 1);
        }
        fileSheet.value.push(fileSheetRecord);
      }
    });
  },
  { deep: true }
);

function updateFileSheet(file: ListenEvent) {
  if (!file.selectSheet) return;
  const existingIndex = fileSheet.value.findIndex(
    record => record.filename === file.filename
  );
  if (existingIndex > -1) {
    fileSheet.value[existingIndex].sheetname = file.selectSheet;
  } else {
    fileSheet.value.push({
      filename: file.filename,
      sheetname: file.selectSheet
    });
  }
}

const filterBySheetCount = (filterValue: string, row: any): boolean => {
  const sheetCount = row.sheets?.length ?? 0;

  switch (filterValue) {
    case "zero":
      return sheetCount === 0;
    case "one":
      return sheetCount === 1;
    case "many":
      return sheetCount > 1;
    default:
      return true;
  }
};

async function selectFile() {
  fileSelect.value = [];
  sheetsData.value = [];
  sheetOptions.value = [];
  fileSheet.value = [];
  detectedEncoding.value = "";
  encodingConfidence.value = 0;
  manualEncoding.value = "";

  try {
    const trimFile = await trimOpenFile(true, "Files", ["*"], {
      includeStatus: true
    });
    path.value = trimFile.filePath;
    fileSelect.value = trimFile.fileInfo;
    addLog(`Selected ${fileSelect.value.length} file(s)`, "info");

    if (activeTab.value === "excel") {
      addLog("Getting Excel sheets...", "info");
      mapSheets.value = await invoke<ExcelSheetMap>("map_excel_sheets", {
        path: path.value
      });
      sheetsData.value = mapSheets.value[0];
      let totalSheets = 0;
      for (const fileName in sheetsData.value) {
        totalSheets += sheetsData.value[fileName].length;
        sheetsData.value[fileName].forEach(sheet => {
          sheetOptions.value.push({
            label: `${fileName} - ${sheet}`,
            value: sheet
          });
        });
      }
      fileSelect.value.forEach(file => {
        if (!file.selectSheet && getSheetsForFile(file.filename).length > 0) {
          file.selectSheet = getSheetsForFile(file.filename)[0];
        }
        file.sheets = getSheetsForFile(file.filename);
      });
      addLog(
        `Found ${totalSheets} sheets in ${fileSelect.value.length} files`,
        "success"
      );
    }

    // encoding 模式自动检测编码
    if (activeTab.value === "encoding" && fileSelect.value.length > 0) {
      addLog("Detecting file encoding...", "info");

      try {
        const result = await invoke<{
          encoding: string;
          confidence: number;
          bom: boolean;
        }>("detect_file_encoding", {
          path: path.value,
          bom: bom.value
        });

        detectedEncoding.value = result.encoding;
        encodingConfidence.value = result.confidence;

        // 置信度低时提示用户手动选择
        if (result.confidence < 0.7) {
          const warningMessage = `编码检测置信度较低 (${(
            result.confidence * 100
          ).toFixed(1)}%),建议手动确认`;
          addLog(warningMessage, "warning");
        } else {
          addLog(
            `Detected encoding: ${result.encoding} (${(
              result.confidence * 100
            ).toFixed(1)}% confidence)`,
            "success"
          );
        }
      } catch (e) {
        addLog(`编码检测失败：${e}`, "error");
      }
    }
  } catch (e) {
    addLog(`File selection failed: ${e}`, "error");
  }
}

// invoke convert
async function convert() {
  if (path.value === "") {
    addLog("File not selected", "warning");
    return;
  }
  try {
    loading.value = true;
    addLog(`Starting conversion: ${activeTab.value} mode`, "info");
    let rtime: string;
    if (activeTab.value === "excel") {
      const mapFileSheet = fileSheet.value.map(item => ({
        filename: item.filename,
        sheetname: item.sheetname
      }));
      rtime = await invoke("excel2csv", {
        path: path.value,
        skiprows: skiprows.skiprows,
        mapFileSheet: mapFileSheet,
        allSheets: allSheets.value,
        writeSheetname: writeSheetname.value,
        threads: threads.threads
      });
    } else if (activeTab.value === "fmt") {
      rtime = await invoke("csv2csv", {
        path: path.value,
        wtrSep: delimiter.delimiter,
        quote: quote.value,
        quoteStyle: quoteStyle.value,
        quoting: quoting.quoting,
        progress: progress.progress,
        skiprows: skiprows.skiprows,
        flexible: flexible.flexible
      });
    } else if (activeTab.value === "encoding") {
      rtime = await invoke("encoding2utf8", {
        path: path.value,
        bom: bom.value,
        quoting: quoting.quoting,
        forceEncoding: manualEncoding.value || null
      });
    } else if (activeTab.value === "dbf") {
      rtime = await invoke("dbf2csv", {
        path: path.value,
        wtrSep: delimiter.delimiter
      });
    } else if (activeTab.value === "csv") {
      rtime = await invoke("csv2xlsx", {
        path: path.value,
        csvMode: csvMode.value,
        chunksize: chunksize.value,
        quoting: quoting.quoting,
        skiprows: skiprows.skiprows
      });
    } else if (activeTab.value === "json") {
      rtime = await invoke("json2csv", {
        path: path.value,
        wtrSep: delimiter.delimiter
      });
    } else if (activeTab.value === "jsonl") {
      rtime = await invoke("jsonl2csv", {
        path: path.value,
        wtrSep: delimiter.delimiter,
        ignoreErr: ignoreErr.value
      });
    }
    addLog(`${activeTab.value} done, elapsed time: ${rtime} s`, "success");
  } catch (e) {
    addLog(`Conversion failed: ${e}`, "error");
  }
  loading.value = false;
}

onUnmounted(() => {
  [path, detectedEncoding, manualEncoding].forEach(r => (r.value = ""));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="header-content">
        <div class="header-icon">
          <Icon icon="ri:exchange-2-line" />
        </div>
        <div class="header-text">
          <h1>Convert</h1>
          <p>Convert between different file formats</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="convert-main">
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
              <SiliconeButton @click.stop="convert()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="mode-toggle py-1">
            <span v-for="item in modeOptions" :key="item.value" class="mode-item mx-0.5"
              :class="{ active: activeTab === item.value }" @click="activeTab = item.value">
              {{ item.label }}
            </span>
          </div>

          <div class="options-grid mt-4 mb-4">
            <template v-if="activeTab === 'excel'">
              <div class="option-section">
                <div class="option-label">CONVERT MODE</div>
                <div class="mode-toggle-inline">
                  <span v-for="item in sheetsOptions" :key="String(item.value)" class="toggle-item"
                    :class="{ active: allSheets === item.value }" @click="allSheets = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
              <div class="option-section">
                <div class="option-label">WRITE SHEET NAME</div>
                <div class="mode-toggle-inline">
                  <span v-for="item in writeOptions" :key="String(item.value)" class="toggle-item"
                    :class="{ active: writeSheetname === item.value }" @click="writeSheetname = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
            </template>

            <template v-if="activeTab === 'fmt'">
              <div class="option-section">
                <div class="option-label">QUOTE CHARACTER</div>
                <div class="mode-toggle-inline">
                  <span v-for="item in quoteOptions" :key="item.value" class="toggle-item"
                    :class="{ active: quote === item.value }" @click="quote = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
              <div class="option-section">
                <div class="option-label">QUOTE STYLE</div>
                <div class="mode-toggle-inline">
                  <span v-for="item in fmtOptions" :key="item.value" class="toggle-item"
                    :class="{ active: quoteStyle === item.value }" @click="quoteStyle = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
            </template>

            <template v-if="activeTab === 'csv'">
              <div class="option-section">
                <div class="option-label">MODE</div>
                <div class="mode-toggle-inline">
                  <span v-for="item in csvModeOptions" :key="item.value" class="toggle-item"
                    :class="{ active: csvMode === item.value }" @click="csvMode = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
              <div class="option-section">
                <div class="option-label">CHUNK SIZE</div>
                <SiliconeInput v-model="chunksize" class="w-full" />
              </div>
            </template>

            <template v-if="activeTab === 'encoding'">
              <div class="option-section">
                <div class="option-label">BOM</div>
                <div class="mode-toggle-inline">
                  <span v-for="item in bomOptions" :key="String(item.value)" class="toggle-item"
                    :class="{ active: bom === item.value }" @click="bom = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
              <div class="option-section">
                <div class="option-label">ENCODING</div>
                <SiliconeSelect v-model="manualEncoding" placeholder="Auto Detect" clearable class="w-full">
                  <el-option v-for="item in encodingOptions" :key="item.value" :label="item.label"
                    :value="item.value" />
                </SiliconeSelect>
              </div>
            </template>

            <template v-if="activeTab === 'jsonl'">
              <div class="option-section">
                <div class="option-label">ERROR HANDLING</div>
                <div class="mode-toggle-inline">
                  <span v-for="item in iErrOptions" :key="String(item.value)" class="toggle-item"
                    :class="{ active: ignoreErr === item.value }" @click="ignoreErr = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
            </template>
          </div>


          <div class="preview-header">
            <span class="preview-title">FILE LIST ({{ fileSelect.length }})</span>
            <span class="mode-badge" v-if="activeTab === 'fmt'" size="small">Format CSV</span>
            <span class="mode-badge" v-else-if="activeTab === 'encoding'" size="small">To UTF-8</span>
            <span class="mode-badge" v-else-if="activeTab === 'excel'" size="small">Excel to CSV</span>
            <span class="mode-badge" v-else-if="activeTab === 'csv'" size="small">CSV to Xlsx</span>
            <span class="mode-badge" v-else-if="activeTab === 'dbf'" size="small">DBF to CSV</span>
            <span class="mode-badge" v-else-if="activeTab === 'json'" size="small">Json to CSV</span>
            <span class="mode-badge" v-else-if="activeTab === 'jsonl'" size="small">JSONL to CSV</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="fileSelect" :height="'350px'" show-overflow-tooltip :key="activeTab"
              :row-style="{ height: '40px' }" :cell-style="{ borderBottom: '1px solid #f0f0f0' }">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  No data. Click above to select files.
                </div>
              </template>
              <el-table-column prop="filename" label="File Name" min-width="150" />
              <el-table-column prop="status" width="70">
                <template #default="scope">
                  <ElIcon v-if="scope.row.status === 'loading'" class="is-loading">
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
              <el-table-column prop="message" label="Message" :filters="[
                { text: 'No worksheet', value: 'zero' },
                { text: '1 worksheet', value: 'one' },
                { text: 'Multiple worksheets', value: 'many' }
              ]" :filter-method="filterBySheetCount" min-width="150">
                <template #default="scope">
                  <template v-if="activeTab === 'excel'">
                    <SiliconeSelect v-model="scope.row.selectSheet" placeholder="Select a sheet" class="mb-[1px]"
                      @change="updateFileSheet(scope.row)"
                      :disabled="!scope.row.sheets || scope.row.sheets.length === 0" size="small">
                      <el-option v-for="sheet in scope.row.sheets" :key="sheet" :label="sheet" :value="sheet" />
                    </SiliconeSelect>
                    <span v-if="scope.row.message && scope.row.status !== 'loading'"
                      class="text-xs text-gray-500 dark:text-gray-400">
                      {{ scope.row.message || scope.row.status }}
                    </span>
                  </template>
                  <template v-else-if="activeTab === 'fmt'">
                    <SiliconeProgress
                      v-if="scope.row.totalRows > 0 && isFinite(scope.row.currentRows / scope.row.totalRows)"
                      :percentage="Math.round((scope.row.currentRows / scope.row.totalRows) * 100)" />
                    <span v-else-if="scope.row.status === 'error'">
                      {{ scope.row.message }}
                    </span>
                  </template>
                  <template v-else-if="activeTab === 'encoding'">
                    <span v-if="detectedEncoding">
                      {{ detectedEncoding }} ({{ (encodingConfidence * 100).toFixed(1) }}%)
                    </span>
                    <span v-else-if="scope.row.status === 'error'" class="text-xs text-red-500">
                      {{ scope.row.message }}
                    </span>
                  </template>
                  <template v-else>
                    <span v-if="scope.row.status === 'error'"
                      class="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                      {{ scope.row.message }}
                    </span>
                  </template>
                </template>
              </el-table-column>
            </SiliconeTable>
          </div>
        </div>
      </div>
    </el-scrollbar>
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

.convert-main {
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
  max-width: 640px;
}

.mode-item {
  max-width: 100px;
  text-align: center;
}

.mode-toggle-inline {
  display: flex;
  gap: 4px;
}

.toggle-item {
  flex: 1;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;
  background: var(--el-fill-color-light, #f5f7fa);
}

.toggle-item:hover {
  background-color: #e9e9e9;
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.15),
    0 2px 5px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.toggle-item.active {
  background-color: #d8d7d7;
  color: #000000;
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.2),
    0 2px 5px rgba(0, 0, 0, 0.2);
}

.dark .toggle-item {
  background: #3a3a3a;
  color: #c0c0c0;
}

.dark .toggle-item:hover {
  background-color: #4a4a4a;
}

.dark .toggle-item.active {
  background-color: #d8d7d7;
  color: #000000;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.option-section {
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

.mode-badge {
  font-size: 12px;
  color: #666;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
}

.dark .mode-badge {
  color: #999;
  background: rgba(255, 255, 255, 0.05);
}
</style>
