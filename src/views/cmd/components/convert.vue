<script setup lang="ts">
import { onUnmounted, ref, watch, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { ElIcon } from "element-plus";
import { Icon } from "@iconify/vue";
import { CloseBold, Select, Loading } from "@element-plus/icons-vue";
import { ListenEvent, updateEvent } from "@/utils/utils";
import { trimOpenFile } from "@/utils/view";
import {
  useDelimiter,
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows,
  useThreads
} from "@/store/modules/options";
import { useLocale, t } from "@/store/modules/locale";
import { storeToRefs } from "pinia";
import "./common.css";
import { message } from "@/utils/message";

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

const localeStore = useLocale();
const { locale } = storeToRefs(localeStore);

const encodingOptions = computed(() => [
  { label: t('auto', locale.value), value: "" },
  { label: "GBK", value: "GBK" },
  { label: "UTF-8", value: "UTF-8" },
  { label: "UTF-16LE", value: "UTF-16LE" },
  { label: "UTF-16BE", value: "UTF-16BE" }
]);

const modeOptions = computed(() => [
  { label: t('formatCsv', locale.value), value: "fmt" },
  { label: t('encodingCsv', locale.value), value: "encoding" },
  { label: t('excel2Csv', locale.value), value: "excel" },
  { label: t('csv2Xlsx', locale.value), value: "csv" },
  { label: t('dbf2Csv', locale.value), value: "dbf" },
  { label: t('json2Csv', locale.value), value: "json" },
  { label: t('ndJson2Csv', locale.value), value: "jsonl" }
]);

const sheetsOptions = computed(() => [
  { label: t('all', locale.value), value: true },
  { label: t('one', locale.value), value: false }
]);

const writeOptions = computed(() => [
  { label: t('true', locale.value), value: true },
  { label: t('false', locale.value), value: false }
]);

const quoteOptions = [
  { label: "'", value: "'" },
  { label: '"', value: '"' }
];

const csvModeOptions = computed(() => [
  { label: t('one', locale.value), value: "one" },
  { label: t('multi', locale.value), value: "multi" }
]);

const iErrOptions = computed(() => [
  { label: t('true', locale.value), value: true },
  { label: t('false', locale.value), value: false }
]);

const fmtOptions = computed(() => [
  { label: t('necessary', locale.value), value: "necessary" },
  { label: t('always', locale.value), value: "always" },
  { label: t('nonNumeric', locale.value), value: "non_numeric" },
  { label: t('never', locale.value), value: "never" }
]);

const bomOptions = computed(() => [
  { label: t('true', locale.value), value: true },
  { label: t('false', locale.value), value: false }
]);

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

    if (activeTab.value === "excel") {
      addLog(t('gettingExcelSheets', locale.value), "info");
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
        `${t('found', locale.value)} ${totalSheets} ${t('sheets', locale.value)} ${t('in', locale.value)} ${fileSelect.value.length} ${t('files', locale.value)}`,
        "success"
      );
    }

    // encoding 模式自动检测编码
    if (activeTab.value === "encoding" && fileSelect.value.length > 0) {
      addLog(t('detectingFileEncoding', locale.value), "info");

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
          const warningMessage = `${t('encodingConfidenceLow', locale.value)} (${(
            result.confidence * 100
          ).toFixed(1)}%),${t('suggestManualConfirm', locale.value)}`;
          addLog(warningMessage, "warning");
        } else {
          addLog(
            `${t('detectedEncoding', locale.value)}: ${result.encoding} (${(
              result.confidence * 100
            ).toFixed(1)}% ${t('confidence', locale.value)})`,
            "success"
          );
        }
      } catch (e) {
        addLog(`${t('encodingDetectionFailed', locale.value)}：${e}`, "error");
      }
    }
  } catch (e) {
    addLog(`${t('fileSelectionFailed', locale.value)}: ${e}`, "error");
  }
}

// invoke convert
async function convert() {
  if (path.value === "") {
    message(t('fileNotSelected', locale.value), { type: "warning" });
    return;
  }
  try {
    loading.value = true;
    addLog(`${t('startingConversion', locale.value)}: ${activeTab.value} ${t('mode', locale.value)}`, "info");
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
    addLog(`${activeTab.value} ${t('done', locale.value)}, ${t('elapsedTime', locale.value)}: ${rtime} s`, "success");
  } catch (e) {
    addLog(`${t('conversionFailed', locale.value)}: ${e}`, "error");
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
          <h1>{{ t('convert', locale) }}</h1>
          <p>{{ t('convertDesc', locale) }}</p>
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
                <span class="cmd-file-name">{{ fileSelect.length }} {{ t('file', locale) }}(s) {{ t('selected', locale)
                }}</span>
              </template>
              <template v-else>
                <span class="cmd-file-prompt">{{ t('clickToSelectFiles', locale) }}</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="convert()" :loading="loading" size="small">
                {{ t('run', locale) }}
              </SiliconeButton>
            </div>
          </div>

          <div class="flex justify-center">
            <div class="mode-toggle py-1">
              <span v-for="item in modeOptions" :key="item.value" class="mode-item mx-0.5 w-24"
                :class="{ active: activeTab === item.value }" @click="activeTab = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <div class="cmd-options-grid mt-4 mb-4">
            <template v-if="activeTab === 'excel'">
              <div class="cmd-option-row">
                <div class="cmd-option-item">
                  <div class="cmd-option-label">{{ t('convertMode', locale) }}</div>
                  <div class="mode-toggle py-1">
                    <span v-for="item in sheetsOptions" :key="String(item.value)" class="mode-item w-24 mx-0.5"
                      :class="{ active: allSheets === item.value }" @click="allSheets = item.value">
                      {{ item.label }}
                    </span>
                  </div>
                </div>
                <div class="cmd-option-item">
                  <div class="cmd-option-label">{{ t('writeSheetName', locale) }}</div>
                  <div class="mode-toggle py-1">
                    <span v-for="item in writeOptions" :key="String(item.value)" class="mode-item w-24 mx-0.5"
                      :class="{ active: writeSheetname === item.value }" @click="writeSheetname = item.value">
                      {{ item.label }}
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <template v-if="activeTab === 'fmt'">
              <div class="cmd-option-row">
                <div class="cmd-option-item">
                  <div class="cmd-option-label">{{ t('quoteCharacter', locale) }}</div>
                  <div class="mode-toggle py-1">
                    <span v-for="item in quoteOptions" :key="item.value" class="mode-item mx-0.5 w-24"
                      :class="{ active: quote === item.value }" @click="quote = item.value">
                      {{ item.label }}
                    </span>
                  </div>
                </div>
                <div class="cmd-option-item">
                  <div class="cmd-option-label">{{ t('quoteStyle', locale) }}</div>
                  <div class="mode-toggle py-1">
                    <span v-for="item in fmtOptions" :key="item.value" class="mode-item mx-0.5 w-24"
                      :class="{ active: quoteStyle === item.value }" @click="quoteStyle = item.value">
                      {{ item.label }}
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <template v-if="activeTab === 'csv'">
              <div class="cmd-option-row">
                <div class="cmd-option-item">
                  <div class="cmd-option-label">{{ t('mode', locale) }}</div>
                  <div class="mode-toggle py-1">
                    <span v-for="item in csvModeOptions" :key="item.value" class="mode-item mx-0.5 w-24"
                      :class="{ active: csvMode === item.value }" @click="csvMode = item.value">
                      {{ item.label }}
                    </span>
                  </div>
                </div>
                <div class="cmd-option-item">
                  <div class="cmd-option-label">{{ t('chunkSize', locale) }}</div>
                  <SiliconeInput v-model="chunksize" />
                </div>
              </div>
            </template>

            <template v-if="activeTab === 'encoding'">
              <div class="cmd-option-row">
                <div class="cmd-option-item">
                  <div class="cmd-option-label">BOM</div>
                  <div class="mode-toggle py-1">
                    <span v-for="item in bomOptions" :key="String(item.value)" class="mode-item mx-0.5 w-24"
                      :class="{ active: bom === item.value }" @click="bom = item.value">
                      {{ item.label }}
                    </span>
                  </div>
                </div>
                <div class="cmd-option-item">
                  <div class="cmd-option-label">{{ t('encoding', locale) }}</div>
                  <SiliconeSelect v-model="manualEncoding" :placeholder="t('autoDetect', locale)" clearable
                    style="width: 120px">
                    <el-option v-for="item in encodingOptions" :key="item.value" :label="item.label"
                      :value="item.value" />
                  </SiliconeSelect>
                </div>
              </div>
            </template>

            <template v-if="activeTab === 'jsonl'">
              <div class="cmd-option-row">
                <div class="cmd-option-item">
                  <div class="cmd-option-label">{{ t('errorHandling', locale) }}</div>
                  <div class="mode-toggle py-1">
                    <span v-for="item in iErrOptions" :key="String(item.value)" class="mode-item mx-0.5 w-24"
                      :class="{ active: ignoreErr === item.value }" @click="ignoreErr = item.value">
                      {{ item.label }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">{{ t('fileList', locale) }} ({{ fileSelect.length }})</span>
            <span class="cmd-mode-badge" v-if="activeTab === 'fmt'" size="small">{{ t('formatCsv', locale) }}</span>
            <span class="cmd-mode-badge" v-else-if="activeTab === 'encoding'" size="small">{{ t('toUtf8', locale)
            }}</span>
            <span class="cmd-mode-badge" v-else-if="activeTab === 'excel'" size="small">{{ t('excelToCsv', locale)
            }}</span>
            <span class="cmd-mode-badge" v-else-if="activeTab === 'csv'" size="small">{{ t('csvToXlsx', locale)
            }}</span>
            <span class="cmd-mode-badge" v-else-if="activeTab === 'dbf'" size="small">{{ t('dbfToCsv', locale) }}</span>
            <span class="cmd-mode-badge" v-else-if="activeTab === 'json'" size="small">{{ t('jsonToCsv', locale)
            }}</span>
            <span class="cmd-mode-badge" v-else-if="activeTab === 'jsonl'" size="small">{{ t('jsonlToCsv', locale)
            }}</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="fileSelect" :height="'350px'" show-overflow-tooltip :key="activeTab"
              :row-style="{ height: '40px' }" :cell-style="{ borderBottom: '1px solid #f0f0f0' }">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  {{ t('noDataClickSelectFiles', locale) }}
                </div>
              </template>
              <el-table-column prop="filename" :label="t('fileName', locale)" min-width="150" />
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
              <el-table-column prop="message" :label="t('message', locale)" :filters="[
                { text: t('noWorksheet', locale), value: 'zero' },
                { text: '1 ' + t('worksheet', locale), value: 'one' },
                { text: t('multipleWorksheets', locale), value: 'many' }
              ]" :filter-method="filterBySheetCount" min-width="150">
                <template #default="scope">
                  <template v-if="activeTab === 'excel'">
                    <SiliconeSelect v-model="scope.row.selectSheet" :placeholder="t('selectSheet', locale)"
                      class="mb-[1px]" @change="updateFileSheet(scope.row)"
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
.cmd-option-row {
  display: flex;
  flex-direction: row;
  gap: 32px;
  justify-content: center;
}

.cmd-option-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
