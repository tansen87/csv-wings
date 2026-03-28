<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { FolderOpened, Guide, Position, Search } from "@element-plus/icons-vue";
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

const [loading, tableLoading] = [ref(false), ref(false)];
const showGotoDialog = ref(false);
const showSearchDialog = ref(false);
const tableHeader = ref<string[]>([]);
const tableData = ref<Record<string, string>[]>([]);
const tableRows = ref<number>(0);
const currentDataLine = ref(1);
const VISIBLE_LINE_COUNT = 200;
const path_inner = ref("");

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

const filterProgress = ref({
  visible: false,
  current: 0,
  total: 0
});
const progressPercent = computed(() => {
  if (filterProgress.value.total <= 0) return 0;
  return Math.min(
    100,
    Math.round(
      (filterProgress.value.current / filterProgress.value.total) * 100
    )
  );
});

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

  // 显示进度弹窗
  filterProgress.value = {
    visible: true,
    current: 0,
    total: 0
  };

  // 监听进度事件
  const unlistenUpdate = await listen("update-rows", event => {
    filterProgress.value.current = event.payload as number;
  });
  const unlistenTotal = await listen("total-rows", event => {
    filterProgress.value.total = event.payload as number;
  });

  try {
    loading.value = true;

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
    const elapsedSeconds = parseFloat(timeStr) || 0;

    showSearchDialog.value = false;
    filterProgress.value.visible = false;

    message(
      `Filter done: ${matchCount} rows matched, elapsed ${elapsedSeconds.toFixed(
        1
      )} seconds`,
      { type: "success" }
    );
  } catch (e) {
    filterProgress.value.visible = false;
    message(`filter failed: ${e}`, { type: "error" });
  } finally {
    loading.value = false;
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
  loading.value = true;
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
  } finally {
    loading.value = false;
  }
}

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

useShortcuts({
  onOpenFile: () => openFile(),
  onJump: () => promptGoToLine()
});
</script>

<template>
  <div class="page-view">
    <SiliconeCard shadow="never" class="h-9">
      <div class="flex p-1">
        <SiliconeButton
          size="small"
          :icon="FolderOpened"
          @click="openFile"
          :loading="loading"
          text
        />
        <SiliconeButton
          size="small"
          :icon="Position"
          :loading="loading"
          @click="showGotoDialog = true"
          text
        />
        <SiliconeButton
          size="small"
          :icon="Search"
          :loading="loading"
          text
          @click="showSearchDialog = true"
        />
        <div class="flex-grow" />
        <SiliconeButton
          size="small"
          :icon="Guide"
          :loading="loading"
          text
          @click="clearFile"
        />
      </div>
    </SiliconeCard>

    <SiliconeTable
      :data="tableData"
      border
      size="small"
      class="select-text"
      height="100%"
      v-loading="tableLoading"
      element-loading-text="Creating index for csv"
      empty-text=""
    >
      <el-table-column
        v-for="header in tableHeader"
        :key="header"
        :prop="header"
        :label="header"
        show-overflow-tooltip
      />
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
            :loading="loading"
          >
            Apply
          </SiliconeButton>
        </div>
      </template>
    </SiliconeDialog>

    <transition name="fade">
      <div
        v-if="filterProgress.visible"
        class="fixed bottom-2 right-2 shadow-lg rounded-lg z-50 border border-gray-200 dark:border-gray-700 p-1"
        style="min-width: 220px"
      >
        <div class="text-xs text-gray-500">
          {{ filterProgress.current.toLocaleString() }} /
          {{ filterProgress.total.toLocaleString() }} rows
        </div>
        <SiliconeProgress
          :percentage="progressPercent"
          :text-inside="true"
          :stroke-width="15"
        />
      </div>
    </transition>
  </div>
</template>

<style scoped>
:deep(.el-card__body) {
  padding: 0 !important;
}
</style>
