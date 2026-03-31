<script setup lang="ts">
import { ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import { viewOpenFile } from "@/utils/view";
import GotoDialog from "@/views/text/gotoDialog.vue";
import { useFileView } from "@/store/modules/fileView";
import { useSearch } from "@/views/text/fn/useSearch";
import { useTaskProgress } from "@/views/text/fn/useProgress";
import { useContextMenu } from "@/views/text/fn/useContextMenu";
import { useEdit } from "@/views/text/fn/useEdit";
import { useQuoting } from "@/store/modules/options";

const props = defineProps<{
  path: string | null;
}>();
const indexing = ref(false);
const showGotoDialog = ref(false);
const originalHeader = ref<string[]>([]);
const tableHeader = ref<string[]>([]);
const tableData = ref<Record<string, string>[]>([]);
const tableRows = ref<number>(0);
const currentDataLine = ref(1);
const VISIBLE_LINE_COUNT = 100;
const path_inner = ref("");
const { visibleProgress, ensureProgress, finishProgress } = useTaskProgress();
const search = useSearch(path_inner, ensureProgress, finishProgress);
const contextMenu = useContextMenu({
  path: path_inner,
  tableHeader,
  ensureProgress,
  finishProgress
});
const originalDataSnapshot = ref<Record<number, Record<string, string>>>({});
const edit = useEdit(
  {
    tableHeader,
    originalHeader,
    currentDataLine,
    originalDataSnapshot,
    tableData
  },
  path_inner,
  ensureProgress,
  finishProgress
);

function getPercent(state: { current: number; total: number }) {
  if (state.total <= 0) return 0;
  return Math.min(100, Math.round((state.current / state.total) * 100));
}
function getTaskLabel(taskName: string): string {
  const labels: Record<string, string> = {
    search: "Filtering...",
    insert: "Inserting...",
    save: "Saving..."
  };
  return labels[taskName] || taskName;
}

function initHeaders(headers: string[]) {
  tableHeader.value = [...headers];
  originalHeader.value = [...headers];
}

async function openFile() {
  try {
    indexing.value = true;
    path_inner.value = await viewOpenFile(false, "csv", ["*"]);
    if (path_inner.value) {
      await loadRows(1);
    }
  } catch (e) {
    message(`failed to open file: ${e}`, { type: "error" });
  } finally {
    indexing.value = false;
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
    const mergedData = jsonData.data.map((row, idx) => {
      const globalLine = start + idx;
      return edit.editCache.value.has(globalLine)
        ? { ...edit.editCache.value.get(globalLine) }
        : { ...row };
    });

    tableHeader.value = jsonData.headers || [];
    tableData.value = mergedData;
    tableRows.value = jsonData.rows || 0;
    currentDataLine.value = targetLine;
    currentDataLine.value = start;
    initHeaders(tableHeader.value);

    for (let i = 0; i < jsonData.data.length; i++) {
      const globalLine = start + i;
      // 如果用户还没编辑过这一行,就记录原始值
      if (!edit.editCache.value.has(globalLine)) {
        originalDataSnapshot.value[globalLine] = { ...jsonData.data[i] };
      }
    }
  } catch (e) {
    if (e.includes("The CSV file was modified after the index file")) {
      ElMessageBox.confirm(
        "The CSV file has been modified externally. Would you like to re-create the index?",
        "Index Outdated",
        {
          confirmButtonText: "Recreate Index",
          cancelButtonText: "Cancel",
          type: "warning"
        }
      ).then(async () => {
        try {
          indexing.value = true;
          await invoke("csv_idx", {
            path: path_inner.value,
            quoting: useQuoting().quoting,
            skiprows: 0
          });
          await loadRows(targetLine);
          message("Index recreated and data reloaded.", { type: "success" });
        } catch (reindexError) {
          message(`Failed to recreate index: ${reindexError}`, {
            type: "error"
          });
        } finally {
          indexing.value = false;
        }
      });
    } else {
      message(`CSV load failed: ${e}`, { type: "error" });
    }
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

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

function clearFile() {
  useFileView().closeFile();
}
</script>

<template>
  <div class="page-view">
    <SiliconeCard shadow="never" class="h-9">
      <div class="flex p-1">
        <SiliconeTooltip content="Open">
          <SiliconeButton size="small" @click="openFile" text>
            <Icon icon="ri:folder-open-line" class="w-4 h-4" />
          </SiliconeButton>
        </SiliconeTooltip>
        <SiliconeTooltip content="Jump">
          <SiliconeButton size="small" @click="showGotoDialog = true" text>
            <Icon icon="ri:navigation-line" class="w-4 h-4" />
          </SiliconeButton>
        </SiliconeTooltip>
        <SiliconeTooltip content="Filter">
          <SiliconeButton
            size="small"
            :loading="search.filtering.value"
            @click="search.showSearchDialog.value = true"
            text
          >
            <Icon icon="ri:filter-3-line" class="w-4 h-4" />
          </SiliconeButton>
        </SiliconeTooltip>
        <SiliconeTooltip content="Save">
          <SiliconeButton
            size="small"
            @click="() => edit.saveEdits(null)"
            :loading="edit.saving.value"
            text
          >
            <Icon icon="ri:save-line" class="w-4 h-4" />
          </SiliconeButton>
        </SiliconeTooltip>
        <SiliconeTooltip content="Save as">
          <SiliconeButton
            size="small"
            @click="edit.saveAsNewFile"
            :loading="edit.saving.value"
            text
          >
            <Icon icon="ri:file-copy-line" class="w-4 h-4" />
          </SiliconeButton>
        </SiliconeTooltip>
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
      <el-table-column fixed width="100" align="center">
        <template #default="{ $index }">
          <span
            :class="{
              'text-blue-500': edit.isLineModified(currentDataLine + $index)
            }"
          >
            {{ currentDataLine + $index }}
            <span
              v-if="edit.isLineModified(currentDataLine + $index)"
              class="ml-1 text-blue-400"
            >
              ●
            </span>
          </span>
        </template>
      </el-table-column>

      <el-table-column
        v-for="(origHeader, index) in originalHeader"
        :key="index"
        :prop="origHeader"
        :label="tableHeader[index]"
      >
        <template #header>
          <div class="flex flex-col gap-1">
            <SiliconeInput
              v-model="tableHeader[index]"
              size="small"
              placeholder="New header"
            />
            <span
              v-if="tableHeader[index] !== origHeader"
              class="text-[10px] text-blue-400 dark:text-blue-400 rounded h-[20px]"
            >
              Changed
            </span>
            <span v-else class="text-[10px] text-gray-400 rounded h-[20px]">
              Unchanged
            </span>
          </div>
        </template>

        <template #default="{ row, $index, column }">
          <SiliconeInput
            v-model="row[column.property]"
            size="small"
            @blur="edit.onCellEdit($index, column.property)"
            :class="{
              'rounded-[12px] bg-blue-50 dark:bg-blue-900/30':
                edit.isCellModified(
                  currentDataLine + $index,
                  edit.getNewHeaderByOriginal(column.property) ||
                    column.property
                )
            }"
          />
        </template>
      </el-table-column>
    </SiliconeTable>

    <div v-if="path_inner" class="flex items-center justify-between">
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

    <GotoDialog
      v-model="showGotoDialog"
      :total-lines="tableRows"
      @go-to="handleGotoLine"
    />

    <SiliconeDialog
      class="context-menu-dialog"
      v-model="contextMenu.showMenu.value"
      width="200px"
      :modal="false"
      :show-close="false"
      :destroy-on-close="true"
      draggable
      :style="{
        left: contextMenu.menuPosition.x + 'px',
        top: contextMenu.menuPosition.y + 'px',
        margin: 0
      }"
    >
      <div
        class="context-menu-item"
        @click="() => contextMenu.insertColumn('left')"
      >
        Insert Column Left
      </div>
      <div
        class="context-menu-item"
        @click="() => contextMenu.insertColumn('right')"
      >
        Insert Column Right
      </div>
    </SiliconeDialog>

    <SiliconeDialog
      v-model="search.showSearchDialog.value"
      title="Advanced Filter"
      width="560px"
      :modal="false"
      modal-penetrable
      draggable
    >
      <el-scrollbar max-height="200px">
        <div class="space-y-2">
          <template
            v-for="(config, index) in search.columnConfigs.value"
            :key="index"
          >
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
                @click="search.removeColumn(index)"
                :disabled="search.columnConfigs.value.length === 1"
                circle
              >
                <Icon icon="ri:close-line" class="w-4 h-4" />
              </SiliconeButton>
            </div>

            <div
              v-if="index < search.logics.value.length"
              class="flex justify-center"
            >
              <SiliconeSelect v-model="search.logics.value[index]" size="small">
                <el-option label="AND" value="and" />
                <el-option label="OR" value="or" />
              </SiliconeSelect>
            </div>
          </template>
        </div>
      </el-scrollbar>

      <template #footer>
        <div class="flex justify-end gap-2">
          <SiliconeButton size="small" @click="search.addColumn">
            + Add
          </SiliconeButton>
          <SiliconeButton
            size="small"
            type="primary"
            @click="search.executeSearch"
            :loading="search.filtering.value"
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
            <span v-if="state.total > 0" class="float-right">
              {{ state.current.toLocaleString() }} /
              {{ state.total.toLocaleString() }}
            </span>
          </div>
          <SiliconeProgress
            v-if="state.total > 0"
            :percentage="getPercent(state)"
            :text-inside="true"
            :stroke-width="15"
          />
          <SiliconeProgress
            v-else
            :percentage="100"
            :indeterminate="true"
            :duration="5"
            :format="() => 'saving'"
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

:deep(.context-menu-dialog .el-dialog__header) {
  display: none !important;
}
.context-menu-item {
  padding: 0.2rem 0.2rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.context-menu-item:hover {
  background-color: #d1d5db;
}
.dark .context-menu-item:hover {
  background-color: #374151;
}
</style>
