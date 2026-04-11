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
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2">
          <Icon icon="ri:exchange-2-line" />
          Convert
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400 tracking-wider">
          Convert between different file formats
        </div>
        <el-scrollbar
          type="horizontal"
          :wrap-style="{ whiteSpace: 'nowrap' }"
          :view-style="{ display: 'inline-block' }"
          class="ml-auto mode-toggle"
        >
          <span
            v-for="item in modeOptions"
            :key="item.value"
            class="mode-item px-3 py-1 inline-block mx-1 rounded-xl"
            :class="{ active: activeTab === item.value }"
            @click="activeTab = item.value"
          >
            {{ item.label }}
          </span>
        </el-scrollbar>
      </div>
    </SiliconeCard>

    <el-scrollbar class="flex-1 px-4 pb-4 min-h-0">
      <div class="flex flex-col gap-4">
        <SiliconeCard>
          <div class="flex justify-between items-center mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              FILE SELECTION
            </div>
            <div class="flex items-center">
              <SiliconeButton @click="selectFile()" size="small" text>
                <Icon icon="ri:folder-open-line" class="w-4 h-4" />
              </SiliconeButton>
              <SiliconeButton
                @click="convert()"
                :loading="loading"
                size="small"
                text
              >
                <Icon icon="ri:play-large-line" class="w-4 h-4" />
              </SiliconeButton>
            </div>
          </div>

          <div class="mb-4">
            <!-- Excel to CSV -->
            <template v-if="activeTab === 'excel'">
              <div>
                <div class="option-label">
                  <span>Convert Mode</span>
                </div>
                <SiliconeTooltip
                  content="Convert all sheets or one sheet"
                  placement="right"
                >
                  <div class="mode-toggle">
                    <span
                      v-for="item in sheetsOptions"
                      :key="String(item.value)"
                      class="mode-item px-3 py-1 mx-1 w-24"
                      :class="{ active: allSheets === item.value }"
                      @click="allSheets = item.value"
                    >
                      {{ item.label }}
                    </span>
                  </div>
                </SiliconeTooltip>
              </div>

              <div class="mt-3">
                <div class="option-label">
                  <span>Sheet Name</span>
                </div>
                <SiliconeTooltip
                  content="When set True, write sheet name"
                  placement="right"
                >
                  <div class="mode-toggle">
                    <span
                      v-for="item in writeOptions"
                      :key="String(item.value)"
                      class="mode-item px-3 py-1 mx-1 w-24"
                      :class="{ active: writeSheetname === item.value }"
                      @click="writeSheetname = item.value"
                    >
                      {{ item.label }}
                    </span>
                  </div>
                </SiliconeTooltip>
              </div>
            </template>

            <!-- Format CSV -->
            <template v-if="activeTab === 'fmt'">
              <div>
                <div class="option-label">
                  <span>Quote Character</span>
                </div>
                <div class="mode-toggle">
                  <span
                    v-for="item in quoteOptions"
                    :key="item.value"
                    class="mode-item px-3 py-1 mx-1 w-24"
                    :class="{ active: quote === item.value }"
                    @click="quote = item.value"
                  >
                    {{ item.label }}
                  </span>
                </div>
              </div>

              <div class="mt-3">
                <div class="option-label">
                  <span>Quote Style</span>
                </div>
                <div class="mode-toggle">
                  <span
                    v-for="item in fmtOptions"
                    :key="item.value"
                    class="mode-item px-3 py-1 mx-1"
                    :class="{ active: quoteStyle === item.value }"
                    @click="quoteStyle = item.value"
                  >
                    {{ item.label }}
                  </span>
                </div>
              </div>
            </template>

            <!-- CSV to XLSX -->
            <template v-if="activeTab === 'csv'">
              <div>
                <div class="option-label">
                  <span>Mode</span>
                </div>
                <SiliconeTooltip
                  content="When set One, write multiple sheets of xlsx"
                  placement="right"
                >
                  <div class="mode-toggle">
                    <span
                      v-for="item in csvModeOptions"
                      :key="item.value"
                      class="mode-item px-3 py-1 mx-1 w-24"
                      :class="{ active: csvMode === item.value }"
                      @click="csvMode = item.value"
                    >
                      {{ item.label }}
                    </span>
                  </div>
                </SiliconeTooltip>
              </div>

              <div class="mt-3">
                <div class="option-label">
                  <span>Chunk Size</span>
                </div>
                <SiliconeTooltip content="Split every N rows into a sheet">
                  <SiliconeInput v-model="chunksize" class="w-full" />
                </SiliconeTooltip>
              </div>
            </template>

            <!-- JSONL to CSV -->
            <template v-if="activeTab === 'jsonl'">
              <div>
                <div class="option-label">
                  <span>Error Handling</span>
                </div>
                <SiliconeTooltip
                  content="When set True, ignore errors"
                  placement="right"
                >
                  <div class="mode-toggle">
                    <span
                      v-for="item in iErrOptions"
                      :key="String(item.value)"
                      class="mode-item px-3 py-1 mx-1 w-24"
                      :class="{ active: ignoreErr === item.value }"
                      @click="ignoreErr = item.value"
                    >
                      {{ item.label }}
                    </span>
                  </div>
                </SiliconeTooltip>
              </div>
            </template>

            <!-- Encoding to UTF-8 -->
            <template v-if="activeTab === 'encoding'">
              <div>
                <div class="option-label">
                  <span>BOM</span>
                </div>
                <div class="mode-toggle">
                  <span
                    v-for="item in bomOptions"
                    :key="String(item.value)"
                    class="mode-item px-3 py-1 mx-1 w-24"
                    :class="{ active: bom === item.value }"
                    @click="bom = item.value"
                  >
                    {{ item.label }}
                  </span>
                </div>
              </div>

              <div class="mt-3">
                <div class="option-label">
                  <span>Encoding</span>
                </div>
                <SiliconeTooltip
                  content="Manual selection of encoding (leave blank for automatic detection)"
                >
                  <SiliconeSelect
                    v-model="manualEncoding"
                    placeholder="Auto Detect"
                    clearable
                    class="w-full"
                  >
                    <el-option
                      v-for="item in encodingOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </SiliconeSelect>
                </SiliconeTooltip>
              </div>
            </template>
          </div>
        </SiliconeCard>

        <SiliconeCard>
          <div class="flex items-center justify-between mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              FILES ({{ fileSelect.length }})
            </div>
            <div class="flex items-center gap-2">
              <SiliconeTag v-if="activeTab === 'fmt'" size="small">
                Format CSV
              </SiliconeTag>
              <SiliconeTag v-else-if="activeTab === 'encoding'" size="small">
                Other Encoding To UTF-8
              </SiliconeTag>
              <SiliconeTag v-else-if="activeTab === 'excel'" size="small">
                Excel to CSV
              </SiliconeTag>
              <SiliconeTag v-else-if="activeTab === 'csv'" size="small">
                CSV to Xlsx
              </SiliconeTag>
              <SiliconeTag v-else-if="activeTab === 'dbf'" size="small">
                DBF to CSV
              </SiliconeTag>
              <SiliconeTag v-else-if="activeTab === 'json'" size="small">
                Json to CSV
              </SiliconeTag>
              <SiliconeTag v-else-if="activeTab === 'jsonl'" size="small">
                JSONL to CSV
              </SiliconeTag>
            </div>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable
              :data="fileSelect"
              :height="'400px'"
              show-overflow-tooltip
              :key="activeTab"
            >
              <template #empty>
                <div class="flex items-center justify-center gap-2">
                  No data. Click
                  <Icon icon="ri:folder-open-line" class="w-4 h-4" />
                  to select files.
                </div>
              </template>
              <el-table-column prop="filename" label="File" min-width="200">
                <template #default="scope">
                  <span>
                    {{ scope.row.filename }}
                  </span>
                </template>
              </el-table-column>

              <el-table-column
                prop="status"
                label="Status"
                width="90"
                :filters="[
                  { text: '✓', value: 'success' },
                  { text: '✗', value: 'error' }
                ]"
                :filter-method="filterFileStatus"
              >
                <template #default="scope">
                  <div class="flex items-center">
                    <ElIcon
                      v-if="scope.row.status === 'loading'"
                      class="is-loading"
                    >
                      <Loading />
                    </ElIcon>
                    <ElIcon v-else-if="scope.row.status === 'success'">
                      <Select />
                    </ElIcon>
                    <ElIcon v-else-if="scope.row.status === 'error'">
                      <CloseBold />
                    </ElIcon>
                  </div>
                </template>
              </el-table-column>

              <el-table-column
                prop="message"
                label="Message"
                :filters="[
                  { text: 'No worksheet', value: 'zero' },
                  { text: '1 worksheet', value: 'one' },
                  { text: 'Multiple worksheets', value: 'many' }
                ]"
                :filter-method="filterBySheetCount"
              >
                <template #default="scope">
                  <template v-if="activeTab === 'excel'">
                    <SiliconeSelect
                      v-model="scope.row.selectSheet"
                      placeholder="Select a sheet"
                      class="mb-[1px]"
                      @change="updateFileSheet(scope.row)"
                      :disabled="
                        !scope.row.sheets || scope.row.sheets.length === 0
                      "
                      size="small"
                    >
                      <el-option
                        v-for="sheet in scope.row.sheets"
                        :key="sheet"
                        :label="sheet"
                        :value="sheet"
                      />
                    </SiliconeSelect>
                    <span
                      v-if="scope.row.message && scope.row.status !== 'loading'"
                      class="text-xs text-gray-500 dark:text-gray-400"
                    >
                      {{ scope.row.message || scope.row.status }}
                    </span>
                  </template>
                  <template v-else-if="activeTab === 'fmt'">
                    <SiliconeProgress
                      v-if="
                        scope.row.totalRows > 0 &&
                        isFinite(scope.row.currentRows / scope.row.totalRows)
                      "
                      :percentage="
                        Math.round(
                          (scope.row.currentRows / scope.row.totalRows) * 100
                        )
                      "
                    />
                    <span v-else-if="scope.row.status === 'error'">
                      {{ scope.row.message }}
                    </span>
                  </template>
                  <template v-else-if="activeTab === 'encoding'">
                    <span v-if="detectedEncoding">
                      {{ detectedEncoding }} ({{
                        (encodingConfidence * 100).toFixed(1)
                      }}%)
                    </span>
                    <span
                      v-else-if="scope.row.status === 'error'"
                      class="text-xs text-red-500"
                    >
                      {{ scope.row.message }}
                    </span>
                  </template>
                  <template v-else>
                    <span
                      v-if="scope.row.status === 'error'"
                      class="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded"
                    >
                      {{ scope.row.message }}
                    </span>
                  </template>
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
            <SiliconeText type="info"
              >1. Click
              <Icon
                icon="ri:folder-open-line"
                class="w-4 h-4 inline align-middle"
              />
              to select one or more files
            </SiliconeText>
            <SiliconeText type="info"
              >2. Choose conversion mode from the list</SiliconeText
            >
            <SiliconeText type="info"
              >3. Configure conversion options based on the selected
              mode</SiliconeText
            >
            <SiliconeText type="info"
              >4. For Excel files, select the sheets to convert</SiliconeText
            >
            <SiliconeText type="info"
              >5. Preview the file list and status</SiliconeText
            >
            <SiliconeText type="info"
              >6. Click
              <Icon
                icon="ri:play-large-line"
                class="w-4 h-4 inline align-middle"
              />
              to run the conversion
            </SiliconeText>
            <SiliconeText type="info"
              >7. Check the output log for details</SiliconeText
            >
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>
  </div>
</template>

<style scoped>
:deep(.silicone-card) {
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}

.option-label span {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.dark .option-label span {
  color: #e5e7eb;
}
</style>
