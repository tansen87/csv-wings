<script setup lang="ts">
import { ref, reactive, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdJoin, useMarkdown } from "@/utils/markdown";
import { useQuoting, useSkiprows } from "@/store/modules/options";
import { message } from "@/utils/message";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Join] ${msg}`, type);
};

const joinType = ref("left");
const [sel1, sel2] = [ref(""), ref("")];
const [dialog, loading, nulls] = [ref(false), ref(false), ref(false)];
const nullOptions = [
  { label: "True", value: true },
  { label: "False", value: false }
];
const [
  tableHeader1,
  tableHeader2,
  tableColumn1,
  tableColumn2,
  tableData1,
  tableData2
] = [ref([]), ref([]), ref([]), ref([]), ref([]), ref([])];
const data = reactive({ path1: "", path2: "" });
const { dynamicHeight } = useDynamicHeight(50);
const { mdShow } = useMarkdown(mdJoin);
const quoting = useQuoting();
const skiprows = useSkiprows();

async function selectFile(fileIndex: number) {
  const tableHeader = fileIndex === 1 ? tableHeader1 : tableHeader2;
  const tableColumn = fileIndex === 1 ? tableColumn1 : tableColumn2;
  const tableData = fileIndex === 1 ? tableData1 : tableData2;
  const path = fileIndex === 1 ? "path1" : "path2";

  data[path] = await viewOpenFile(false, "csv", ["*"]);
  if (data[path] === null) {
    data[path] = "";
    return;
  }

  try {
    tableHeader.value = await mapHeaders(data[path], skiprows.skiprows);
    const { columnView, dataView } = await toJson(
      data[path],
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
  } catch (e) {
    addLog(`Failed to load file for Data ${fileIndex}: ${e}`, 'error');
  }
}

async function joinData() {
  if (data.path1 === "" || data.path2 === "") {
    message("File not selected", { type: 'warning' });
    return;
  }
  if (sel1.value.length === 0 || sel2.value.length === 0) {
    message("Column not selected", { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog('Starting join process...', 'info');
    const rtime: string = await invoke("join", {
      path1: data.path1,
      path2: data.path2,
      sel1: sel1.value,
      sel2: sel2.value,
      joinType: joinType.value,
      nulls: nulls.value,
      quoting: quoting.quoting
    });
    addLog(`Join done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Join failed: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
}

onUnmounted(() => {
  [sel1, sel2].forEach(r => (r.value = ""));
  [
    tableHeader1,
    tableHeader2,
    tableColumn1,
    tableColumn2,
    tableData1,
    tableData2
  ].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="header-content">
        <div class="header-icon" @click="dialog = true">
          <Icon icon="ri:merge-cells-horizontal" />
        </div>
        <div class="header-text">
          <h1>Join</h1>
          <p>Join two CSV files on specified columns</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="join-main">
        <div class="p-3">
          <div class="files-section">
            <div class="files-header">
              <span class="files-title">DATA FILES</span>
              <SiliconeButton @click="joinData()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>

            <div class="files-grid">
              <div class="file-card" :class="{ selected: data.path1 }" @click="selectFile(1)">
                <div class="file-icon">
                  <Icon icon="ri:file-text-line" />
                </div>
                <div class="file-info">
                  <span class="file-label">Data 1</span>
                  <span v-if="data.path1" class="file-name">{{ data.path1.split(/[/\\]/).pop() }}</span>
                  <span v-else class="file-prompt">Click to select</span>
                </div>
                <div v-if="data.path1" class="file-check">
                  <Icon icon="ri:check-circle-line" />
                </div>
              </div>

              <div class="join-arrow">
                <Icon icon="ri:arrow-right-line" />
              </div>

              <div class="file-card" :class="{ selected: data.path2 }" @click="selectFile(2)">
                <div class="file-icon">
                  <Icon icon="ri:file-text-line" />
                </div>
                <div class="file-info">
                  <span class="file-label">Data 2</span>
                  <span v-if="data.path2" class="file-name">{{ data.path2.split(/[/\\]/).pop() }}</span>
                  <span v-else class="file-prompt">Click to select</span>
                </div>
                <div v-if="data.path2" class="file-check">
                  <Icon icon="ri:check-circle-line" />
                </div>
              </div>
            </div>
          </div>

          <div class="options-grid mt-4 mb-4">
            <div class="option-section">
              <div class="option-label">DATA 1 COLUMN</div>
              <SiliconeSelect v-model="sel1" filterable placeholder="Select column" class="w-full">
                <el-option v-for="item in tableHeader1" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>

            <div class="option-section">
              <div class="option-label">DATA 2 COLUMN</div>
              <SiliconeSelect v-model="sel2" filterable placeholder="Select column" class="w-full">
                <el-option v-for="item in tableHeader2" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>

            <div class="option-section">
              <div class="option-label">JOIN TYPE</div>
              <SiliconeSelect v-model="joinType" class="w-full">
                <el-option label="Inner" value="inner" />
                <el-option label="Left" value="left" />
                <el-option label="Right" value="right" />
                <el-option label="Full" value="full" />
                <el-option label="Cross" value="cross" />
                <el-option label="Left Semi" value="left_semi" />
                <el-option label="Left Anti" value="left_anti" />
                <el-option label="Right Semi" value="right_semi" />
                <el-option label="Right Anti" value="right_anti" />
              </SiliconeSelect>
            </div>
          </div>

          <div class="option-label">NULLS</div>
          <div class="mode-toggle py-1">
            <span v-for="item in nullOptions" :key="String(item.value)" class="mode-item mx-0.5"
              :class="{ active: nulls === item.value }" @click="nulls = item.value">
              {{ item.label }}
            </span>
          </div>

          <div class="preview-formula mt-4">
            <span class="formula-label">Preview:</span>
            <span class="formula-item">{{ sel1 || "col1" }}</span>
            <span class="formula-operator">{{ joinType.toUpperCase() }} JOIN</span>
            <span class="formula-item">{{ sel2 || "col2" }}</span>
          </div>

          <div class="join-description mt-4">
            <div v-if="joinType === 'inner'">
              Returns only matching rows from both datasets
            </div>
            <div v-else-if="joinType === 'left'">
              Returns all rows from data 1, matched from data 2
            </div>
            <div v-else-if="joinType === 'right'">
              Returns all rows from data 2, matched from data 1
            </div>
            <div v-else-if="joinType === 'full'">
              Returns all rows from both datasets
            </div>
            <div v-else-if="joinType === 'cross'">
              Returns cartesian product of both datasets
            </div>
            <div v-else-if="joinType === 'left_semi'">
              Returns rows from data 1 with matching rows in data 2
            </div>
            <div v-else-if="joinType === 'left_anti'">
              Returns rows from data 1 without matching rows in data 2
            </div>
            <div v-else-if="joinType === 'right_semi'">
              Returns rows from data 2 with matching rows in data 1
            </div>
            <div v-else-if="joinType === 'right_anti'">
              Returns rows from data 2 without matching rows in data 1
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div class="preview-header">
                <span class="preview-title">DATA 1 ({{ tableData1?.length || 0 }} rows)</span>
              </div>
              <div class="overflow-hidden rounded-lg">
                <SiliconeTable :data="tableData1" :height="'300px'" show-overflow-tooltip class="select-text">
                  <template #empty>
                    <div class="flex items-center justify-center gap-2 text-gray-500">
                      No data. Click Data 1 to select file.
                    </div>
                  </template>
                  <el-table-column v-for="column in tableColumn1" :prop="column.prop" :label="column.label"
                    :key="column.prop" />
                </SiliconeTable>
              </div>
            </div>

            <div>
              <div class="preview-header">
                <span class="preview-title">DATA 2 ({{ tableData2?.length || 0 }} rows)</span>
              </div>
              <div class="overflow-hidden rounded-lg">
                <SiliconeTable :data="tableData2" :height="'300px'" show-overflow-tooltip class="select-text">
                  <template #empty>
                    <div class="flex items-center justify-center gap-2 text-gray-500">
                      No data. Click Data 2 to select file.
                    </div>
                  </template>
                  <el-table-column v-for="column in tableColumn2" :prop="column.prop" :label="column.label"
                    :key="column.prop" />
                </SiliconeTable>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Join - Joins two sets of CSV data on specified columns" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #409eff, #66b1ff);
  border-radius: 12px;
  font-size: 24px;
  color: white;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
  cursor: pointer;
}

.header-text h1 {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  margin: 0 0 4px 0;
}

.dark .header-text h1 {
  color: #e8e8e8;
}

.header-text p {
  font-size: 13px;
  color: #888;
  margin: 0;
}

.dark .header-text p {
  color: #999;
}

.join-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.files-section {
  margin-bottom: 8px;
}

.files-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.files-title {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.files-grid {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(145deg, #f8f8f8, #f0f0f0);
  border: 2px dashed #ddd;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.file-card:hover {
  border-color: #409eff;
  background: linear-gradient(145deg, #f0f8ff, #e6f2ff);
}

.file-card.selected {
  border-style: solid;
  border-color: #22c55e;
  background: linear-gradient(145deg, #f0fdf4, #dcfce7);
}

.dark .file-card {
  background: linear-gradient(145deg, #2a2a2a, #222);
  border-color: #444;
}

.dark .file-card:hover {
  border-color: #409eff;
  background: linear-gradient(145deg, #1e2a3a, #1a2535);
}

.dark .file-card.selected {
  border-color: #22c55e;
  background: linear-gradient(145deg, #14532d, #166534);
}

.file-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #e8e8e8, #d8d8d8);
  border-radius: 10px;
  font-size: 20px;
  color: #666;
  flex-shrink: 0;
}

.dark .file-icon {
  background: linear-gradient(145deg, #3a3a3a, #2d2d2d);
  color: #777;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  flex: 1;
}

.file-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
}

.file-name {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dark .file-name {
  color: #e0e0e0;
}

.file-prompt {
  font-size: 13px;
  color: #999;
}

.file-check {
  color: #22c55e;
  font-size: 20px;
}

.join-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 10px;
  color: #666;
  font-size: 20px;
  flex-shrink: 0;
}

.dark .join-arrow {
  background: var(--el-fill-color-dark, #2a2a2a);
  color: #999;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

.mode-toggle {
  display: flex;
  justify-content: center;
  margin: 0 auto;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 12px;
  max-width: 240px;
}

.preview-formula {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(145deg, #fef3c7, #fde68a);
  border-radius: 8px;
  flex-wrap: wrap;
}

.dark .preview-formula {
  background: linear-gradient(145deg, #451a03, #713f12);
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
  color: #f59e0b;
  font-weight: 600;
}

.dark .formula-item {
  background: #2a2a2a;
  color: #fbbf24;
}

.formula-operator {
  color: #888;
  font-size: 12px;
}

.dark .formula-operator {
  color: #999;
}

.join-description {
  padding: 10px 12px;
  background: linear-gradient(145deg, #f0f8ff, #e6f2ff);
  border-radius: 8px;
  font-size: 12px;
  color: #409eff;
}

.dark .join-description {
  background: linear-gradient(145deg, #1e2a3a, #1a2535);
  color: #66b1ff;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: #666;
}

.dark .preview-title {
  color: #999;
}

@media (max-width: 768px) {
  .files-grid {
    flex-direction: column;
  }

  .file-card {
    width: 100%;
  }

  .join-arrow {
    transform: rotate(90deg);
  }

  .options-grid {
    grid-template-columns: 1fr;
  }
}
</style>
