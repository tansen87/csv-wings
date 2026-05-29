<script setup lang="ts">
import { ref, reactive, onUnmounted, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdJoin, useMarkdown } from "@/utils/markdown";
import { useQuoting, useSkiprows } from "@/store/modules/setting";
import { message } from "@/utils/message";
import { useLocale, t } from "@/store/modules/locale";
import { storeToRefs } from "pinia";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const localeStore = useLocale();
const { locale } = storeToRefs(localeStore);

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Join] ${msg}`, type);
};

const joinType = ref("left");
const [sel1, sel2] = [ref(""), ref("")];
const [dialog, loading, nulls] = [ref(false), ref(false), ref(false)];
const nullOptions = computed(() => [
  { label: t('true', locale.value), value: true },
  { label: t('false', locale.value), value: false }
]);
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
    addLog(`${t('failedToLoadFile', locale.value)} ${t('data', locale.value)} ${fileIndex}: ${e}`, 'error');
  }
}

async function joinData() {
  if (data.path1 === "" || data.path2 === "") {
    message(t('fileNotSelected', locale.value), { type: 'warning' });
    return;
  }
  if (sel1.value.length === 0 || sel2.value.length === 0) {
    message(t('columnNotSelected', locale.value), { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(t('startingJoinProcess', locale.value), 'info');
    const rtime: string = await invoke("join", {
      path1: data.path1,
      path2: data.path2,
      sel1: sel1.value,
      sel2: sel2.value,
      joinType: joinType.value,
      nulls: nulls.value,
      quoting: quoting.quoting
    });
    addLog(`${t('joinDone', locale.value)}, ${t('elapsedTime', locale.value)}: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`${t('joinFailed', locale.value)}: ${e}`, 'error');
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
          <h1>{{ t('join', locale) }}</h1>
          <p>{{ t('joinDesc', locale) }}</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="cmd-main">
        <div class="p-3">
          <div class="files-section">
            <div class="files-header">
              <span class="files-title">{{ t('dataFiles', locale) }}</span>
              <SiliconeButton @click="joinData()" :loading="loading" size="small">
                {{ t('run', locale) }}
              </SiliconeButton>
            </div>

            <div class="files-grid">
              <div class="file-card" :class="{ selected: data.path1 }" @click="selectFile(1)">
                <div class="file-icon">
                  <Icon icon="ri:file-text-line" />
                </div>
                <div class="file-info">
                  <span class="file-label">{{ t('data', locale) }} 1</span>
                  <span v-if="data.path1" class="file-name">{{ data.path1.split(/[/\\]/).pop() }}</span>
                  <span v-else class="file-prompt">{{ t('clickToSelect', locale) }}</span>
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
                  <span class="file-label">{{ t('data', locale) }} 2</span>
                  <span v-if="data.path2" class="file-name">{{ data.path2.split(/[/\\]/).pop() }}</span>
                  <span v-else class="file-prompt">{{ t('clickToSelect', locale) }}</span>
                </div>
                <div v-if="data.path2" class="file-check">
                  <Icon icon="ri:check-circle-line" />
                </div>
              </div>
            </div>
          </div>

          <div class="options-grid mt-4 mb-4">
            <div class="option-section">
              <div class="option-label">{{ t('data1Column', locale) }}</div>
              <SiliconeSelect v-model="sel1" filterable :placeholder="t('selectColumn', locale)">
                <el-option v-for="item in tableHeader1" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>

            <div class="option-section">
              <div class="option-label">{{ t('data2Column', locale) }}</div>
              <SiliconeSelect v-model="sel2" filterable :placeholder="t('selectColumn', locale)">
                <el-option v-for="item in tableHeader2" :key="item.value" :label="item.label" :value="item.value" />
              </SiliconeSelect>
            </div>

            <div class="option-section">
              <div class="option-label">{{ t('joinType', locale) }}</div>
              <SiliconeSelect v-model="joinType">
                <el-option :label="t('inner', locale)" value="inner" />
                <el-option :label="t('left', locale)" value="left" />
                <el-option :label="t('right', locale)" value="right" />
                <el-option :label="t('full', locale)" value="full" />
                <el-option :label="t('cross', locale)" value="cross" />
                <el-option :label="t('leftSemi', locale)" value="left_semi" />
                <el-option :label="t('leftAnti', locale)" value="left_anti" />
                <el-option :label="t('rightSemi', locale)" value="right_semi" />
                <el-option :label="t('rightAnti', locale)" value="right_anti" />
              </SiliconeSelect>
            </div>
          </div>

          <div class="option-label">{{ t('nulls', locale) }}</div>
          <div class="mode-toggle py-1">
            <span v-for="item in nullOptions" :key="String(item.value)" class="mode-item mx-0.5"
              :class="{ active: nulls === item.value }" @click="nulls = item.value">
              {{ item.label }}
            </span>
          </div>

          <div class="preview-formula mt-4">
            <span class="formula-label">{{ t('preview', locale) }}:</span>
            <span class="formula-item">{{ sel1 || t('col1', locale) }}</span>
            <span class="formula-operator">{{ t(joinType + 'Join', locale) }}</span>
            <span class="formula-item">{{ sel2 || t('col2', locale) }}</span>
          </div>

          <div class="join-description mt-4">
            <div v-if="joinType === 'inner'">{{ t('innerJoinDesc', locale) }}</div>
            <div v-else-if="joinType === 'left'">{{ t('leftJoinDesc', locale) }}</div>
            <div v-else-if="joinType === 'right'">{{ t('rightJoinDesc', locale) }}</div>
            <div v-else-if="joinType === 'full'">{{ t('fullJoinDesc', locale) }}</div>
            <div v-else-if="joinType === 'cross'">{{ t('crossJoinDesc', locale) }}</div>
            <div v-else-if="joinType === 'left_semi'">{{ t('leftSemiJoinDesc', locale) }}</div>
            <div v-else-if="joinType === 'left_anti'">{{ t('leftAntiJoinDesc', locale) }}</div>
            <div v-else-if="joinType === 'right_semi'">{{ t('rightSemiJoinDesc', locale) }}</div>
            <div v-else-if="joinType === 'right_anti'">{{ t('rightAntiJoinDesc', locale) }}</div>
          </div>

          <div class="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div class="preview-header">
                <span class="preview-title">{{ t('data', locale) }} 1 ({{ tableData1?.length || 0 }} {{ t('rows', locale) }})</span>
              </div>
              <div class="overflow-hidden rounded-lg">
                <SiliconeTable :data="tableData1" :height="'300px'" show-overflow-tooltip class="select-text">
                  <template #empty>
                    <div class="flex items-center justify-center gap-2 text-gray-500">
                      {{ t('noDataClickData1ToSelectFile', locale) }}
                    </div>
                  </template>
                  <el-table-column v-for="column in tableColumn1" :prop="column.prop" :label="column.label"
                    :key="column.prop" />
                </SiliconeTable>
              </div>
            </div>

            <div>
              <div class="preview-header">
                <span class="preview-title">{{ t('data', locale) }} 2 ({{ tableData2?.length || 0 }} {{ t('rows', locale) }})</span>
              </div>
              <div class="overflow-hidden rounded-lg">
                <SiliconeTable :data="tableData2" :height="'300px'" show-overflow-tooltip class="select-text">
                  <template #empty>
                    <div class="flex items-center justify-center gap-2 text-gray-500">
                      {{ t('noDataClickData2ToSelectFile', locale) }}
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

    <SiliconeDialog v-model="dialog" :title="`${t('join', locale)} - ${t('joinDesc', locale)}`" width="70%">
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