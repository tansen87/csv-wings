<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { ElIcon } from "element-plus";
import { Icon } from "@iconify/vue";
import { CloseBold, Select, Loading } from "@element-plus/icons-vue";
import {
  useDynamicHeight,
  filterFileStatus,
  ListenEvent,
  updateEvent
} from "@/utils/utils";
import { closeAllMessage, message } from "@/utils/message";
import { trimOpenFile } from "@/utils/view";
import {
  useDelimiter,
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows,
  useThreads
} from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const [activeTab, chunksize, csvMode, quote, quoteStyle] = [
  ref("excel"),
  ref("700000"),
  ref("one"),
  ref('"'),
  ref("necessary")
];
const [backendInfo, path] = [ref(""), ref("")];
const [sheetOptions, fileSheet] = [ref([]), ref([])];
const [allSheets, isLoading, backendCompleted, writeSheetname, ignoreErr, bom] =
  [ref(true), ref(false), ref(false), ref(false), ref(false), ref(false)];

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
  { label: "FormtCsv", value: "fmt" },
  { label: "EncodingCsv", value: "encoding" },
  { label: "Excel2Csv", value: "excel" },
  { label: "Csv2Xlsx", value: "csv" },
  { label: "Access2Csv", value: "access" },
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
const { dynamicHeight } = useDynamicHeight(162);
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
  backendCompleted.value = false;
  backendInfo.value = "";
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
      message("get excel sheets...", {
        type: "info",
        duration: 0,
        icon: Loading
      });
      mapSheets.value = await invoke<ExcelSheetMap>("map_excel_sheets", {
        path: path.value
      });
      sheetsData.value = mapSheets.value[0];
      for (const fileName in sheetsData.value) {
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
      closeAllMessage();
      backendInfo.value = "get excel sheets done";
      backendCompleted.value = true;
    }

    // encoding 模式自动检测编码
    if (activeTab.value === "encoding" && fileSelect.value.length > 0) {
      message("detecting encoding...", {
        type: "info",
        duration: 0,
        icon: Loading
      });

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
          message(
            `编码检测置信度较低 (${(result.confidence * 100).toFixed(
              1
            )}%),建议手动确认`,
            {
              type: "warning",
              duration: 5000
            }
          );
        }

        closeAllMessage();
        backendInfo.value = `detected: ${result.encoding} (${(
          result.confidence * 100
        ).toFixed(1)}%)`;
        backendCompleted.value = true;
      } catch (err) {
        closeAllMessage();
        message(`编码检测失败：${err.toString()}`, { type: "error" });
      }
    }
  } catch (err) {
    closeAllMessage();
    message(err.toString(), { type: "error" });
  }
}

// invoke convert
async function convert() {
  if (path.value === "") {
    message("File not selected", { type: "warning" });
    return;
  }
  try {
    isLoading.value = true;
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
    } else if (activeTab.value === "access") {
      rtime = await invoke("access2csv", {
        path: path.value,
        wtrSep: delimiter.delimiter
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
    message(`${activeTab.value} done, elapsed time: ${rtime} s`, {
      type: "success"
    });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => convert()
});

onUnmounted(() => {
  [path, detectedEncoding, manualEncoding].forEach(r => (r.value = ""));
});
</script>

<template>
  <el-form class="page-view">
    <header
      class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center gap-4">
        <h1
          class="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2"
        >
          <Icon icon="ri:exchange-2-line" />
          Convert
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File(s)
        </SiliconeButton>
        <SiliconeButton @click="convert()" :loading="isLoading" text>
          Run
        </SiliconeButton>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <aside
        class="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4 overflow-hidden"
      >
        <div class="mb-4">
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
            MODE
          </div>
          <div class="mode-toggle-v h-[128px] overflow-y-auto">
            <span
              v-for="item in modeOptions"
              :key="item.value"
              class="mode-item"
              :class="{ active: activeTab === item.value }"
              @click="activeTab = item.value"
            >
              {{ item.label }}
            </span>
          </div>
        </div>

        <div class="border-t border-gray-200 dark:border-gray-700 my-3" />

        <div
          class="text-xs font-semibold text-gray-400 tracking-wider mb-3 flex items-center justify-between"
        >
          <span>OPTIONS</span>
        </div>

        <el-scrollbar class="flex-1">
          <div class="space-y-4">
            <!-- Excel to CSV 选项 -->
            <template v-if="activeTab === 'excel'">
              <div class="option-group">
                <div class="option-label">
                  <span>Convert Mode</span>
                  <SiliconeTooltip
                    content="Convert all sheets or not"
                    placement="right"
                  >
                    <Icon
                      icon="ri:question-line"
                      class="w-4 h-4 text-gray-400 cursor-help"
                    />
                  </SiliconeTooltip>
                </div>
                <div class="mode-toggle-v h-[32px]">
                  <span
                    v-for="item in sheetsOptions"
                    :key="String(item.value)"
                    class="mode-item"
                    :class="{ active: allSheets === item.value }"
                    @click="allSheets = item.value"
                  >
                    {{ item.label }}
                  </span>
                </div>
              </div>

              <div class="option-group">
                <div class="option-label">
                  <span>Sheet Name</span>
                  <SiliconeTooltip
                    content="When set True, write sheet name"
                    placement="right"
                  >
                    <Icon
                      icon="ri:question-line"
                      class="w-4 h-4 text-gray-400 cursor-help"
                    />
                  </SiliconeTooltip>
                </div>
                <div class="mode-toggle-v h-[32px]">
                  <span
                    v-for="item in writeOptions"
                    :key="String(item.value)"
                    class="mode-item"
                    :class="{ active: writeSheetname === item.value }"
                    @click="writeSheetname = item.value"
                  >
                    {{ item.label }}
                  </span>
                </div>
              </div>
            </template>

            <!-- Format CSV 选项 -->
            <template v-if="activeTab === 'fmt'">
              <div class="option-group">
                <div class="option-label">
                  <span>Quote Character</span>
                  <SiliconeTooltip content="Quote character" placement="right">
                    <Icon
                      icon="ri:question-line"
                      class="w-4 h-4 text-gray-400 cursor-help"
                    />
                  </SiliconeTooltip>
                </div>
                <div class="mode-toggle-v h-[32px]">
                  <span
                    v-for="item in quoteOptions"
                    :key="item.value"
                    class="mode-item"
                    :class="{ active: quote === item.value }"
                    @click="quote = item.value"
                  >
                    {{ item.label }}
                  </span>
                </div>
              </div>

              <div class="option-group">
                <div class="option-label">
                  <span>Quote Style</span>
                  <SiliconeTooltip content="Quote style" placement="right">
                    <Icon
                      icon="ri:question-line"
                      class="w-4 h-4 text-gray-400 cursor-help"
                    />
                  </SiliconeTooltip>
                </div>
                <div class="mode-toggle-v h-[64px]">
                  <span
                    v-for="item in fmtOptions"
                    :key="item.value"
                    class="mode-item"
                    :class="{ active: quoteStyle === item.value }"
                    @click="quoteStyle = item.value"
                  >
                    {{ item.label }}
                  </span>
                </div>
              </div>
            </template>

            <!-- CSV to XLSX 选项 -->
            <template v-if="activeTab === 'csv'">
              <div class="option-group">
                <div class="option-label">
                  <span>Mode</span>
                  <SiliconeTooltip content="CSV to XLSX mode" placement="right">
                    <Icon
                      icon="ri:question-line"
                      class="w-4 h-4 text-gray-400 cursor-help"
                    />
                  </SiliconeTooltip>
                </div>
                <div class="mode-toggle-v h-[32px]">
                  <span
                    v-for="item in csvModeOptions"
                    :key="item.value"
                    class="mode-item"
                    :class="{ active: csvMode === item.value }"
                    @click="csvMode = item.value"
                  >
                    {{ item.label }}
                  </span>
                </div>
              </div>

              <div class="option-group">
                <div class="option-label">
                  <span>Chunk Size</span>
                  <SiliconeTooltip
                    content="Split every N rows into a sheet"
                    placement="right"
                  >
                    <Icon
                      icon="ri:question-line"
                      class="w-4 h-4 text-gray-400 cursor-help"
                    />
                  </SiliconeTooltip>
                </div>
                <SiliconeInput v-model="chunksize" placeholder="10000" />
              </div>
            </template>

            <!-- JSONL to CSV 选项 -->
            <template v-if="activeTab === 'jsonl'">
              <div class="option-group">
                <div class="option-label">
                  <span>Error Handling</span>
                  <SiliconeTooltip content="Ignore errors" placement="right">
                    <Icon
                      icon="ri:question-line"
                      class="w-4 h-4 text-gray-400 cursor-help"
                    />
                  </SiliconeTooltip>
                </div>
                <div class="mode-toggle-v h-[32px]">
                  <span
                    v-for="item in iErrOptions"
                    :key="String(item.value)"
                    class="mode-item"
                    :class="{ active: ignoreErr === item.value }"
                    @click="ignoreErr = item.value"
                  >
                    {{ item.label }}
                  </span>
                </div>
              </div>
            </template>

            <!-- Encoding 选项 -->
            <template v-if="activeTab === 'encoding'">
              <div class="option-group">
                <div class="option-label">
                  <span>BOM</span>
                  <SiliconeTooltip content="BOM" placement="right">
                    <Icon
                      icon="ri:question-line"
                      class="w-4 h-4 text-gray-400 cursor-help"
                    />
                  </SiliconeTooltip>
                </div>
                <div class="mode-toggle-v h-[32px]">
                  <span
                    v-for="item in bomOptions"
                    :key="String(item.value)"
                    class="mode-item"
                    :class="{ active: bom === item.value }"
                    @click="bom = item.value"
                  >
                    {{ item.label }}
                  </span>
                </div>
              </div>

              <div class="option-group">
                <div class="option-label">
                  <span>Encoding</span>
                  <SiliconeTooltip
                    content="Manual selection of encoding (leave blank for automatic detection)"
                    placement="right"
                  >
                    <Icon
                      icon="ri:question-line"
                      class="w-4 h-4 text-gray-400 cursor-help"
                    />
                  </SiliconeTooltip>
                </div>
                <SiliconeSelect
                  v-model="manualEncoding"
                  placeholder="Auto Detect"
                  clearable
                >
                  <el-option
                    v-for="item in encodingOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </SiliconeSelect>
              </div>
            </template>
          </div>
        </el-scrollbar>

        <div class="mt-4 pt-4">
          <text
            v-if="backendCompleted && activeTab === 'excel'"
            class="text-xs text-gray-500 dark:text-gray-400"
          >
            {{ backendInfo }}
          </text>
        </div>
      </aside>

      <div
        class="flex-1 bg-white dark:bg-gray-800 flex flex-col overflow-hidden"
      >
        <div
          class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-2">
            <SiliconeTag v-if="fileSelect.length" type="info" size="small">
              {{ fileSelect.length }} files
            </SiliconeTag>
            <SiliconeTag v-else type="info" size="small">
              No files loaded
            </SiliconeTag>
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
            <SiliconeTag v-else-if="activeTab === 'access'" size="small">
              Access to CSV
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

        <div class="flex-1 overflow-auto p-2">
          <SiliconeTable
            :data="fileSelect"
            :height="dynamicHeight"
            show-overflow-tooltip
            :key="activeTab"
            empty-text="No data. (Ctrl+D) to Open File(s)."
          >
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
                  <ElIcon v-if="scope.row.status === 'loading'">
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
      </div>
    </main>
  </el-form>
</template>

<style scoped>
.option-group {
  margin-bottom: 16px;
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
