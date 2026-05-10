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
import "./common.css";

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
      <div class="cmd-header-content">
        <div class="cmd-header-icon">
          <Icon icon="ri:exchange-2-line" />
        </div>
        <div class="cmd-header-text">
          <h1>Convert</h1>
          <p>Convert between different file formats</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="cmd-main">
        <div class="p-3">
          <div class="cmd-file-selection-bar mb-4" @click="selectFile()">
            <div class="cmd-file-selection-icon">
              <Icon icon="ri:folder-open-line" />
            </div>
            <div class="cmd-file-selection-text">
              <template v-if="path">
                <span class="cmd-file-name">{{ fileSelect.length }} file(s) selected</span>
              </template>
              <template v-else>
                <span class="cmd-file-prompt">Click to select files</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="convert()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="flex justify-center">
            <div class="cmd-mode-toggle py-1">
              <span v-for="item in modeOptions" :key="item.value" class="cmd-mode-item mx-0.5 w-24"
                :class="{ active: activeTab === item.value }" @click="activeTab = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <div class="cmd-options-grid mt-4 mb-4">
            <template v-if="activeTab === 'excel'">
              <div class="cmd-option-section">
                <div class="cmd-option-label">CONVERT MODE</div>
                <div class="cmd-mode-toggle-inline">
                  <span v-for="item in sheetsOptions" :key="String(item.value)" class="cmd-toggle-item"
                    :class="{ active: allSheets === item.value }" @click="allSheets = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
              <div class="cmd-option-section">
                <div class="cmd-option-label">WRITE SHEET NAME</div>
                <div class="cmd-mode-toggle-inline">
                  <span v-for="item in writeOptions" :key="String(item.value)" class="cmd-toggle-item"
                    :class="{ active: writeSheetname === item.value }" @click="writeSheetname = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
            </template>

            <template v-if="activeTab === 'fmt'">
              <div class="cmd-option-section">
                <div class="cmd-option-label">QUOTE CHARACTER</div>
                <div class="cmd-mode-toggle-inline">
                  <span v-for="item in quoteOptions" :key="item.value" class="cmd-toggle-item"
                    :class="{ active: quote === item.value }" @click="quote = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
              <div class="cmd-option-section">
                <div class="cmd-option-label">QUOTE STYLE</div>
                <div class="cmd-mode-toggle-inline">
                  <span v-for="item in fmtOptions" :key="item.value" class="cmd-toggle-item"
                    :class="{ active: quoteStyle === item.value }" @click="quoteStyle = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
            </template>

            <template v-if="activeTab === 'csv'">
              <div class="cmd-option-section">
                <div class="cmd-option-label">MODE</div>
                <div class="cmd-mode-toggle-inline">
                  <span v-for="item in csvModeOptions" :key="item.value" class="cmd-toggle-item"
                    :class="{ active: csvMode === item.value }" @click="csvMode = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
              <div class="cmd-option-section">
                <div class="cmd-option-label">CHUNK SIZE</div>
                <SiliconeInput v-model="chunksize" class="w-full" />
              </div>
            </template>

            <template v-if="activeTab === 'encoding'">
              <div class="cmd-option-section">
                <div class="cmd-option-label">BOM</div>
                <div class="cmd-mode-toggle-inline">
                  <span v-for="item in bomOptions" :key="String(item.value)" class="cmd-toggle-item"
                    :class="{ active: bom === item.value }" @click="bom = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
              <div class="cmd-option-section">
                <div class="cmd-option-label">ENCODING</div>
                <SiliconeSelect v-model="manualEncoding" placeholder="Auto Detect" clearable class="w-full">
                  <el-option v-for="item in encodingOptions" :key="item.value" :label="item.label"
                    :value="item.value" />
                </SiliconeSelect>
              </div>
            </template>

            <template v-if="activeTab === 'jsonl'">
              <div class="cmd-option-section">
                <div class="cmd-option-label">ERROR HANDLING</div>
                <div class="cmd-mode-toggle-inline">
                  <span v-for="item in iErrOptions" :key="String(item.value)" class="cmd-toggle-item"
                    :class="{ active: ignoreErr === item.value }" @click="ignoreErr = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </div>
            </template>
          </div>

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">FILE LIST ({{ fileSelect.length }})</span>
            <span class="cmd-mode-badge" v-if="activeTab === 'fmt'" size="small">Format CSV</span>
            <span class="cmd-mode-badge" v-else-if="activeTab === 'encoding'" size="small">To UTF-8</span>
            <span class="cmd-mode-badge" v-else-if="activeTab === 'excel'" size="small">Excel to CSV</span>
            <span class="cmd-mode-badge" v-else-if="activeTab === 'csv'" size="small">CSV to Xlsx</span>
            <span class="cmd-mode-badge" v-else-if="activeTab === 'dbf'" size="small">DBF to CSV</span>
            <span class="cmd-mode-badge" v-else-if="activeTab === 'json'" size="small">Json to CSV</span>
            <span class="cmd-mode-badge" v-else-if="activeTab === 'jsonl'" size="small">JSONL to CSV</span>
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
