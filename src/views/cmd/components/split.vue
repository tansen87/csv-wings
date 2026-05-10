<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { viewOpenFile, toJson } from "@/utils/view";
import { mdSplit, useMarkdown } from "@/utils/markdown";
import { useSkiprows } from "@/store/modules/options";
import { message } from "@/utils/message"
import "./common.css";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Split] ${msg}`, type);
};

const [path, size, mode] = [ref(""), ref(1000000), ref("rows")];
const modeOptions = [
  { label: "Rows", value: "rows" },
  { label: "Lines", value: "lines" }
];
const [tableColumn, tableData] = [ref([]), ref([])];
const [loading, dialog] = [ref(false), ref(false)];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdSplit);
const skiprows = useSkiprows();

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    return;
  }

  try {
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

async function splitData() {
  if (path.value === "") {
    message("CSV file not selected", { type: 'warning' });
    return;
  }
  if (skiprows.skiprows !== 0) {
    message("split only support skiprows=0", { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog('Starting split process...', 'info');
    const rtime: string = await invoke("split", {
      path: path.value,
      size: size.value,
      mode: mode.value
    });
    addLog(`Split done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Split failed: ${e}`, 'error');
  }
  loading.value = false;
}

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:scissors-cut-line" />
        </div>
        <div class="cmd-header-text">
          <h1>Split</h1>
          <p>Split one CSV file into many files</p>
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
              <SiliconeButton @click.stop="splitData()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="flex justify-center">
            <div class="cmd-mode-toggle py-1">
              <span v-for="item in modeOptions" :key="item.value" class="mode-item mx-0.5 w-24"
                :class="{ active: mode === item.value }" @click="mode = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <div class="cmd-options-grid mt-4 flex">
            <div class="cmd-option-section">
              <div class="cmd-option-label">SPLIT SIZE</div>
              <SiliconeInputNumber v-model="size" :min="1" placeholder="Enter split size" class="w-full" />
            </div>
          </div>

          <div class="cmd-stats-grid mt-4 mb-4">
            <div class="stat-card stat-blue">
              <div class="cmd-stat-label">Rows/File</div>
              <div class="cmd-stat-value">{{ size }}</div>
            </div>
            <div class="cmd-stat-card">
              <div class="cmd-stat-label">Total Rows</div>
              <div class="cmd-stat-value">TODO</div>
            </div>
            <div class="cmd-stat-card stat-green">
              <div class="cmd-stat-label">Output Files</div>
              <div class="cmd-stat-value">TODO</div>
            </div>
          </div>

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
            <span class="cmd-mode-badge">Mode: {{ mode }}</span>
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
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Split - Split one CSV file into many CSV files" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>
