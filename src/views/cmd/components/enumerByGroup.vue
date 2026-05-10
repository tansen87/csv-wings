<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { viewOpenFile, toJson } from "@/utils/view";
import { mdEnumer, useMarkdown } from "@/utils/markdown";
import {
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows
} from "@/store/modules/options";
import { message } from "@/utils/message";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Enumerate Group] ${msg}`, type);
};

const path = ref("");
const [currentRows, totalRows] = [ref(0), ref(0)];
const [dialog, loading] = [ref(false), ref(false)];
const [tableColumn, tableData] = [ref([]), ref([])];
const sorted = ref(false);

const indexColumnName = ref("Line Number");
const groupByColumn = ref("");
const sortedOpts = [
  { label: "True", value: true },
  { label: "False", value: false }
];

const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdEnumer);
const quoting = useQuoting();
const skiprows = useSkiprows();
const progress = useProgress();
const flexible = useFlexible();

watch(tableColumn, () => {
  if (tableColumn.value.length > 0 && !groupByColumn.value) {
    groupByColumn.value = tableColumn.value[0].prop;
  }
});

listen("update-rows", (event: Event<number>) => {
  currentRows.value = event.payload;
});
listen("total-rows", (event: Event<number>) => {
  totalRows.value = event.payload;
});

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    return;
  }

  totalRows.value = 0;
  groupByColumn.value = "";

  try {
    const { columnView, dataView } = await toJson(
      path.value,
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
    if (columnView.length > 0) {
      groupByColumn.value = columnView[0].prop;
    }
  } catch (e) {
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

async function enumerate() {
  if (path.value === "") {
    message("File not selected", { type: 'warning' });
    return;
  }
  if (!groupByColumn.value) {
    message("Please select a column to group by", { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog('Starting enumerate by group process...', 'info');
    const rtime: string = await invoke("enumer_by_group", {
      path: path.value,
      progress: progress.progress,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible,
      indexColumnName: indexColumnName.value,
      groupByColumn: groupByColumn.value,
      sorted: sorted.value
    });
    addLog(`Enumerate by group done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Enumerate by group failed: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  [path, indexColumnName, groupByColumn].forEach(r => (r.value = ""));
  [tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:group-line" />
        </div>
        <div class="cmd-header-text">
          <h1>Enumer Group</h1>
          <p>Add row number within each group</p>
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
              <SiliconeButton @click.stop="enumerate()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="flex justify-center">
            <div class="cmd-mode-toggle py-1">
              <span v-for="item in sortedOpts" :key="String(item.value)" class="cmd-mode-item mx-0.5 w-24"
                :class="{ active: sorted === item.value }" @click="sorted = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <div class="options-grid mt-4">
            <div class="option-section">
              <div class="option-label">INDEX COLUMN NAME</div>
              <SiliconeInput v-model="indexColumnName" placeholder="e.g. row_num" class="w-full" />
            </div>

            <div class="option-section">
              <div class="option-label">GROUP BY COLUMN</div>
              <SiliconeSelect v-model="groupByColumn" placeholder="Select column" class="w-full">
                <el-option v-for="col in tableColumn" :key="col.prop" :label="col.label" :value="col.prop" />
              </SiliconeSelect>
            </div>

            <div class="preview-formula">
              <span class="formula-label">Preview:</span>
              <span class="formula-item">{{ indexColumnName }}</span>
              <span class="formula-operator">=</span>
              <span class="formula-item">ROW_NUMBER()</span>
              <span class="formula-operator">OVER (PARTITION BY</span>
              <span class="formula-item">{{ groupByColumn || "column" }}</span>
              <span class="formula-operator">)</span>
            </div>
          </div>

          <div class="stats-grid mt-4 mb-4">
            <div class="stat-card">
              <div class="stat-label">Total Rows</div>
              <div class="stat-value">{{ totalRows }}</div>
            </div>
            <div class="stat-card stat-blue">
              <div class="stat-label">Progress</div>
              <SiliconeProgress v-if="totalRows > 0 && isFinite(currentRows / totalRows)"
                :percentage="Math.round((currentRows / totalRows) * 100)" class="mt-2" />
            </div>
          </div>

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">PREVIEW ({{ tableData?.length || 0 }} rows)</span>
            <span class="cmd-mode-badge">Group by: {{ groupByColumn || "none" }}</span>
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

    <SiliconeDialog v-model="dialog" title="Enumerate by Group - Add row numbers within each group" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
.options-grid {
  display: grid;
  grid-template-columns: 1fr;
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

.preview-formula {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(145deg, #f0f8ff, #e6f2ff);
  border-radius: 8px;
  flex-wrap: wrap;
}

.dark .preview-formula {
  background: linear-gradient(145deg, #1e2a3a, #1a2535);
}

.formula-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.formula-item {
  font-family: ui-monospace, monospace;
  background: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: #409eff;
  font-weight: 600;
}

.dark .formula-item {
  background: #2a2a2a;
  color: #66b1ff;
}

.formula-operator {
  color: #888;
  font-size: 12px;
}

.dark .formula-operator {
  color: #999;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-card {
  background: linear-gradient(145deg, #f5f5f5, #e8e8e8);
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.dark .stat-card {
  background: linear-gradient(145deg, #2a2a2a, #222);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.dark .stat-value {
  color: #e0e0e0;
}

.stat-card.stat-blue .stat-value {
  color: #409eff;
}

.stat-label {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.dark .stat-label {
  color: #999;
}
</style>
