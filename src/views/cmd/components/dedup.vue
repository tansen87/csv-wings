<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdDedup, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";
import { message } from "@/utils/message";
import "./common.css";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Dedup] ${msg}`, type);
};

const mode = ref("keep_first");
const modeOptions = [
  { label: "Keep First", value: "keep_first" },
  { label: "Keep Last", value: "keep_last" },
  { label: "Keep Duplicates", value: "keep_duplicates" },
  { label: "Unique", value: "unique" }
];
const sortedOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const [loading, dialog, sorted] = [ref(false), ref(false), ref(false)];
const [columns, path] = [ref<string[]>([]), ref("")];
const outputRows = ref(0);
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdDedup);
const quoting = useQuoting();
const skiprows = useSkiprows();
const flexible = useFlexible();

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    addLog('File selection cancelled', 'info');
    return;
  }

  try {
    addLog(`Selected file: ${path.value}`, 'info');
    tableHeader.value = await mapHeaders(path.value, skiprows.skiprows);
    const { columnView, dataView } = await toJson(
      path.value,
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
  } catch (e) {
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

// Invoke dedup
async function runDedup() {
  if (path.value === "") {
    message("File not selected", { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(`Starting deduplication with mode: ${mode.value}`, 'info');
    addLog(`Selected columns: ${columns.value.length > 0 ? columns.value.join(', ') : 'All'}`, 'info');

    const result: string = await invoke("dedup", {
      path: path.value,
      columns: columns.value,
      mode: mode.value,
      skiprows: skiprows.skiprows,
      sorted: sorted.value,
      flexible: flexible.flexible,
      quoting: quoting.quoting
    });
    const json_res = JSON.parse(result);

    let msg: string;
    if (json_res.mode === "keep_duplicates") {
      msg = `Found ${json_res.output_rows} duplicate rows in ${json_res.elapsed_seconds.toFixed(1)}s`;
    } else {
      msg = `Kept ${json_res.output_rows} unique rows in ${json_res.elapsed_seconds.toFixed(1)}s`;
    }
    addLog(msg, 'success');
    outputRows.value = json_res.output_rows;
  } catch (e) {
    addLog(`deduplication failed: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  columns.value = [];
  path.value = "";
  tableHeader.value = [];
  tableColumn.value = [];
  tableData.value = [];
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:table-alt-fill" />
        </div>
        <div class="cmd-header-text">
          <h1>Dedup</h1>
          <p>Remove duplicate rows based on selected columns</p>
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
                <span class="cmd-file-name">{{ path.split(/[/\\]/).pop() }}</span>
                <span class="cmd-file-path">{{ path }}</span>
              </template>
              <template v-else>
                <span class="cmd-file-prompt">Click to select a CSV file</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="runDedup()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="flex justify-center">
            <div class="cmd-mode-toggle py-1">
              <span v-for="item in modeOptions" :key="item.value" class="cmd-mode-item mx-0.5 w-28"
                :class="{ active: mode === item.value }" @click="mode = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <div class="cmd-options-grid mt-4">
            <div class="cmd-option-section">
              <div class="cmd-option-label">COLUMNS ({{ columns.length }})</div>
              <SiliconeSelect v-model="columns" multiple filterable placeholder="Select columns (empty = all)">
                <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>
            <div class="cmd-option-section">
              <div class="cmd-option-label">SORTED</div>
              <div class="cmd-mode-toggle-inline">
                <span v-for="item in sortedOptions" :key="String(item.value)" class="cmd-toggle-item"
                  :class="{ active: sorted === item.value }" @click="sorted = item.value">
                  {{ item.label }}
                </span>
              </div>
              <p class="option-hint">Enable O(1) memory mode if file is sorted</p>
            </div>
          </div>

          <div class="info-box mt-4">
            <Icon icon="ri:information-line" class="info-icon" />
            <span v-if="mode === 'keep_first'">
              Keep the first occurrence of each duplicate group.
            </span>
            <span v-else-if="mode === 'keep_last'">
              Keep the last occurrence of each duplicate group.
            </span>
            <span v-else-if="mode === 'keep_duplicates'">
              Output only the rows that are duplicates.
            </span>
            <span v-else-if="mode === 'unique'"> Get unique values </span>
          </div>

          <div v-if="outputRows > 0" class="stats-box mt-4">
            <div class="cmd-stat-value" :class="mode === 'keep_duplicates' ? 'text-orange-500' : 'text-green-500'">
              {{ outputRows }}
            </div>
            <div class="cmd-stat-label">
              {{ mode === "keep_duplicates" ? "Duplicate Rows" : "Unique Rows Kept" }}
            </div>
          </div>

          <div class="mt-4">
            <div class="cmd-preview-header">
              <span class="cmd-preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
            </div>
            <div class="overflow-hidden rounded-lg">
              <SiliconeTable :data="tableData" :height="'350px'" show-overflow-tooltip class="select-text">
                <template #empty>
                  <div class="flex items-center justify-center gap-2 text-gray-500">
                    No data. Click above to select file.
                  </div>
                </template>
                <el-table-column v-for="column in tableColumn" :prop="column.prop" :label="column.label"
                  :key="column.prop" />
              </SiliconeTable>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Dedup - Remove duplicate rows based on selected columns" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
.info-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(145deg, #f0f8ff, #e6f2ff);
  border: 1px solid #b3d8fd;
  border-radius: 10px;
  font-size: 13px;
  color: #409eff;
}
</style>
