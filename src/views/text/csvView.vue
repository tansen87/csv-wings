<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { message } from "@/utils/message";
import { viewOpenFile } from "@/utils/view";
import GotoDialog from "@/views/text/gotoDialog.vue";
import { useShortcuts } from "@/utils/globalShortcut";
import { useFileView } from "@/store/modules/fileView";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows,
  useThreads
} from "@/store/modules/options";
import { listen } from "@tauri-apps/api/event";

const props = defineProps<{
  path: string | null;
}>();
const [indexing, filtering, renaming] = [ref(false), ref(false), ref(false)];
const showGotoDialog = ref(false);
const showSearchDialog = ref(false);
const tableHeader = ref<string[]>([]);
const tableData = ref<Record<string, string>[]>([]);
const tableRows = ref<number>(0);
const currentDataLine = ref(1);
const VISIBLE_LINE_COUNT = 200;
const path_inner = ref("");

interface TaskProgress {
  current: number;
  total: number;
  visible: boolean;
}
const progressMap = reactive(new Map<string, TaskProgress>());
const visibleProgress = computed(() => {
  const result: Record<string, TaskProgress> = {};
  for (const [key, state] of progressMap.entries()) {
    if (state.visible) {
      result[key] = state;
    }
  }
  return result;
});
function getPercent(state: { current: number; total: number }) {
  if (state.total <= 0) return 0;
  return Math.min(100, Math.round((state.current / state.total) * 100));
}

function getTaskLabel(taskName: string): string {
  const labels: Record<string, string> = {
    search: "Filtering...",
    rename: "Renaming...",
    load: "Loading data..."
  };
  return labels[taskName] || taskName;
}
function ensureProgress(taskName: string) {
  if (!progressMap.has(taskName)) {
    progressMap.set(taskName, { current: 0, total: 0, visible: true });
  }
  return progressMap.get(taskName)!;
}
function finishProgress(taskName: string) {
  const state = progressMap.get(taskName);
  if (state) {
    state.visible = false;
    setTimeout(() => {
      if (progressMap.get(taskName)?.visible === false) {
        progressMap.delete(taskName);
      }
    }, 3000);
  }
}

interface ColumnConfig {
  column: string;
  mode: string;
  condition: string;
}
const columnConfigs = ref<ColumnConfig[]>([
  { column: "", mode: "equal", condition: "" }
]);
const logics = ref<string[]>([]);
watch(
  columnConfigs,
  newConfigs => {
    const n = newConfigs.length;
    logics.value = Array(n > 0 ? n - 1 : 0).fill("and");
  },
  { deep: true, immediate: true }
);
function addColumn() {
  columnConfigs.value.push({
    column: "",
    mode: "equal",
    condition: ""
  });
}
function removeColumn(index: number) {
  if (columnConfigs.value.length <= 1) return;
  columnConfigs.value.splice(index, 1);
}
async function executeSearch() {
  if (!path_inner.value) {
    message("Please open a CSV file first", { type: "warning" });
    return;
  }

  const validConfigs = columnConfigs.value.filter(
    cfg => cfg.column.trim() !== "" && cfg.condition.trim() !== ""
  );

  if (validConfigs.length === 0) {
    message("Please fill in at least one valid filtering condition", {
      type: "warning"
    });
    return;
  }

  const TASK_NAME = "search";
  const progressState = ensureProgress(TASK_NAME);
  const unlistenUpdate = await listen("update-search-rows", event => {
    progressState.current = event.payload as number;
  });
  const unlistenTotal = await listen("total-search-rows", event => {
    progressState.total = event.payload as number;
  });

  try {
    filtering.value = true;
    const res: [string, string] = await invoke("search_chain", {
      path: path_inner.value,
      configs: validConfigs,
      logics: logics.value,
      progress: useProgress().progress,
      quoting: useQuoting().quoting,
      flexible: useFlexible().flexible,
      skiprows: useSkiprows().skiprows,
      threads: useThreads().threads
    });

    const [matchCount, timeStr] = res;

    showSearchDialog.value = false;

    message(
      `Filter done: ${matchCount} rows matched, elapsed ${parseFloat(
        timeStr
      ).toFixed(1)} s`,
      { type: "success" }
    );
  } catch (e) {
    message(`filter failed: ${e}`, { type: "error" });
  } finally {
    filtering.value = false;
    finishProgress(TASK_NAME);
    unlistenUpdate();
    unlistenTotal();
  }
}

const editableHeaders = ref<string[]>([]);
const originalHeaders = ref<string[]>([]);
watch(
  () => tableHeader.value,
  () => {
    editableHeaders.value = [...tableHeader.value];
  },
  { immediate: true }
);
watch(
  () => tableHeader.value,
  newHeaders => {
    editableHeaders.value = [...newHeaders];
    originalHeaders.value = [...newHeaders];
  },
  { immediate: true }
);
async function executeRename() {
  if (!path_inner.value) {
    message("No file opened", { type: "warning" });
    return;
  }

  const TASK_NAME = "rename";
  const progressState = ensureProgress(TASK_NAME);
  const unlistenUpdate = await listen("update-rename-rows", event => {
    progressState.current = event.payload as number;
  });
  const unlistenTotal = await listen("total-rename-rows", event => {
    progressState.total = event.payload as number;
  });

  const newHeaders = editableHeaders.value.map(h => h.trim() || "Unnamed");
  const headersString = newHeaders.join(",");

  try {
    renaming.value = true;
    const rtime: string = await invoke("rename", {
      path: path_inner.value,
      headers: headersString,
      progress: true,
      quoting: useQuoting().quoting,
      skiprows: useSkiprows().skiprows,
      flexible: useFlexible().flexible
    });
    message(
      `Columns renamed successfully in ${parseFloat(rtime).toFixed(1)} s`,
      {
        type: "success"
      }
    );
  } catch (e) {
    message(`Rename failed: ${e}`, { type: "error" });
  } finally {
    renaming.value = false;
    finishProgress(TASK_NAME);
    unlistenUpdate();
    unlistenTotal();
  }
}

async function openFile() {
  try {
    path_inner.value = await viewOpenFile(false, "csv", ["*"]);
    if (path_inner.value) {
      await loadRows(1);
    }
  } catch (e) {
    message(`failed to open file: ${e}`, { type: "error" });
  }
}

async function loadRows(targetLine: number) {
  if (!path_inner.value) return;
  const start = Math.max(1, targetLine);
  const end = start + VISIBLE_LINE_COUNT - 1;
  try {
    const jsonStr: string = await invoke("table_view", {
      path: path_inner.value,
      flexible: true,
      start,
      end
    });
    const jsonData = JSON.parse(jsonStr);
    tableHeader.value = jsonData.headers || [];
    tableData.value = jsonData.data || [];
    tableRows.value = jsonData.rows || 0;
    currentDataLine.value = targetLine;
  } catch (e) {
    message(`CSV load failed: ${e}`, { type: "error" });
    tableHeader.value = [];
    tableData.value = [];
  }
}

watch(
  () => props.path,
  async newPath => {
    if (newPath) {
      path_inner.value = newPath;
      await loadRows(1);
    } else {
      tableHeader.value = [];
      tableData.value = [];
    }
  },
  { immediate: true }
);

async function handleGotoLine(lineNumber: number) {
  const clamped = Math.max(1, lineNumber);
  await loadRows(clamped);
  message(`Jumped to data line ${clamped}`, { type: "success" });
}

function promptGoToLine() {
  showGotoDialog.value = !showGotoDialog.value;
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

function clearFile() {
  useFileView().closeFile();
}

useShortcuts({
  onOpenFile: () => openFile(),
  onJump: () => promptGoToLine()
});
</script>

<template>
  <div class="page-view">
    <SiliconeCard shadow="never" class="h-9">
      <div class="flex p-1">
        <SiliconeButton size="small" @click="openFile" text>
          <Icon icon="ri:folder-open-line" class="w-4 h-4" />
        </SiliconeButton>
        <SiliconeButton size="small" @click="showGotoDialog = true" text>
          <Icon icon="ri:navigation-line" class="w-4 h-4" />
        </SiliconeButton>
        <SiliconeButton
          size="small"
          :loading="filtering"
          @click="showSearchDialog = true"
          text
        >
          <Icon icon="ri:filter-3-line" class="w-4 h-4" />
        </SiliconeButton>
        <SiliconeButton
          size="small"
          @click="executeRename"
          :loading="renaming"
          text
        >
          <Icon icon="ri:heading" class="w-4 h-4" />
        </SiliconeButton>
        <div class="flex-grow" />
        <SiliconeButton size="small" text @click="clearFile">
          <Icon icon="ri:home-3-line" class="w-4 h-4" />
        </SiliconeButton>
      </div>
    </SiliconeCard>

    <SiliconeTable
      :data="tableData"
      border
      size="small"
      class="select-text"
      height="100%"
      v-loading="indexing"
      element-loading-text="Creating index for csv"
      empty-text=""
    >
      <el-table-column
        v-for="(header, index) in tableHeader"
        :key="header"
        :prop="header"
        :label="header"
        show-overflow-tooltip
      >
        <template #header>
          <div class="flex flex-col gap-1">
            <SiliconeInput
              v-model="editableHeaders[index]"
              size="small"
              placeholder="New header"
              @keyup.enter="executeRename"
            />
            <span
              v-if="editableHeaders[index] !== originalHeaders[index]"
              class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded"
            >
              Changed
            </span>
            <span
              v-else
              class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded"
            >
              Unchanged
            </span>
          </div>
        </template>
      </el-table-column>
    </SiliconeTable>

    <SiliconeCard v-if="path_inner" shadow="never" class="min-h-[25px]">
      <div class="flex items-center justify-between">
        <div class="truncate max-w-[80%]">
          <el-scrollbar>
            <SiliconeTag type="info">
              {{ path_inner }}
            </SiliconeTag>
          </el-scrollbar>
        </div>
        <div class="flex items-center">
          <SiliconeTag type="success">
            {{ formatNumber(tableRows) }} rows
          </SiliconeTag>
        </div>
      </div>
    </SiliconeCard>

    <GotoDialog
      v-model="showGotoDialog"
      :total-lines="tableRows"
      @go-to="handleGotoLine"
    />

    <SiliconeDialog
      v-model="showSearchDialog"
      title="Advanced Filter"
      width="560px"
      :modal="false"
      modal-penetrable
      draggable
    >
      <el-scrollbar max-height="200px">
        <div class="space-y-2">
          <template v-for="(config, index) in columnConfigs" :key="index">
            <div class="flex items-center gap-2">
              <SiliconeSelect
                v-model="config.column"
                placeholder="Column"
                filterable
                size="small"
                style="width: 300px"
              >
                <el-option
                  v-for="col in tableHeader"
                  :key="col"
                  :label="col"
                  :value="col"
                />
              </SiliconeSelect>

              <SiliconeSelect
                v-model="config.mode"
                filterable
                size="small"
                style="width: 260px"
              >
                <el-option label="equal" value="equal" />
                <el-option label="not_equal" value="not_equal" />
                <el-option label="contains" value="contains" />
                <el-option label="not_contains" value="not_contains" />
                <el-option label="starts_with" value="starts_with" />
                <el-option label="ends_with" value="ends_with" />
                <el-option label="regex" value="regex" />
                <el-option label="is_null" value="is_null" />
                <el-option label="is_not_null" value="is_not_null" />
                <el-option label="gt (>)" value="gt" />
                <el-option label="ge (≥)" value="ge" />
                <el-option label="lt (<)" value="lt" />
                <el-option label="le (≤)" value="le" />
                <el-option label="between" value="between" />
              </SiliconeSelect>

              <SiliconeInput
                v-model="config.condition"
                placeholder="Condition (use | for multiple)"
                size="small"
              />

              <SiliconeButton
                size="small"
                type="danger"
                text
                @click="removeColumn(index)"
                :disabled="columnConfigs.length === 1"
                circle
              >
                <Icon icon="ri:close-line" class="w-4 h-4" />
              </SiliconeButton>
            </div>

            <div v-if="index < logics.length" class="flex justify-center">
              <SiliconeSelect v-model="logics[index]" size="small">
                <el-option label="AND" value="and" />
                <el-option label="OR" value="or" />
              </SiliconeSelect>
            </div>
          </template>
        </div>
      </el-scrollbar>

      <template #footer>
        <div class="flex justify-end gap-2">
          <SiliconeButton size="small" @click="addColumn">
            + Add
          </SiliconeButton>
          <SiliconeButton
            size="small"
            type="primary"
            @click="executeSearch"
            :loading="filtering"
          >
            Apply
          </SiliconeButton>
        </div>
      </template>
    </SiliconeDialog>

    <div class="fixed bottom-2 right-2 z-50 space-y-2">
      <transition-group name="fade">
        <div
          v-for="(state, taskName) in visibleProgress"
          :key="taskName"
          class="shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 p-1 min-w-[260px]"
        >
          <div class="text-xs text-gray-500 mb-1">
            {{ getTaskLabel(taskName) }}
            <span class="float-right">
              {{ state.current.toLocaleString() }} /
              {{ state.total.toLocaleString() }}
            </span>
          </div>
          <SiliconeProgress
            :percentage="getPercent(state)"
            :text-inside="true"
            :stroke-width="15"
          />
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style scoped>
:deep(.el-card__body) {
  padding: 0 !important;
}
</style>
