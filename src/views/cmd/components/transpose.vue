<script setup lang="ts">
import { onUnmounted, ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdTranspose, useMarkdown } from "@/utils/markdown";
import { useQuoting, useSkiprows } from "@/store/modules/setting";
import { useLocale, t } from "@/store/modules/locale";
import { storeToRefs } from "pinia";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const localeStore = useLocale();
const { locale } = storeToRefs(localeStore);

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Transpose] ${msg}`, type);
};

const [path, mode] = [ref(""), ref("memory")];
const modeOptions = computed(() => [
  { label: t('memory', locale.value), value: "memory" },
  { label: t('multipass', locale.value), value: "multipass" }
]);
const [isLoading, dialog] = [ref(false), ref(false)];
const [tableHeader, tableColumn, tableData] = [ref([]), ref([]), ref([])];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdTranspose);
const quoting = useQuoting();
const skiprows = useSkiprows();

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    addLog(t('fileSelectionCanceled', locale.value), 'info');
    return;
  }

  addLog(`${t('selectedFile', locale.value)}: ${path.value}`, 'info');

  try {
    addLog(t('loadingFileData', locale.value), 'info');
    tableHeader.value = await mapHeaders(path.value, skiprows.skiprows);
    const { columnView, dataView } = await toJson(
      path.value,
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
  } catch (e) {
    addLog(`${t('failedToLoadFile', locale.value)}: ${e}`, 'error');
  }
}

async function transposeData() {
  if (path.value === "") {
    addLog(t('fileNotSelected', locale.value), 'warning');
    return;
  }

  try {
    isLoading.value = true;
    addLog(`${t('startingTranspose', locale.value)}...`, 'info');

    if (mode.value === 'memory') {
      addLog(t('usingMemoryMode', locale.value), 'info');
    } else {
      addLog(t('usingMultipassMode', locale.value), 'info');
    }

    const rtime: string = await invoke("transpose", {
      path: path.value,
      mode: mode.value,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows
    });
    addLog(`${t('transposeDone', locale.value)}, ${t('elapsedTime', locale.value)}: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`${t('transposeFailed', locale.value)}: ${e}`, 'error');
  } finally {
    isLoading.value = false;
  }
}

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [tableHeader, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:loop-left-line" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('transpose', locale) }}</h1>
          <p>{{ t('transposeDesc', locale) }}</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
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
              <span class="cmd-file-prompt">{{ t('clickToSelectFile', locale) }}</span>
            </template>
          </div>
          <div class="flex items-center gap-2 ml-auto">
            <SiliconeButton @click.stop="transposeData()" :loading="isLoading" size="small">
              {{ t('run', locale) }}
            </SiliconeButton>
          </div>
        </div>

        <div class="flex justify-center">
          <div class="cmd-mode-toggle py-1">
            <span v-for="item in modeOptions" :key="item.value" class="cmd-mode-item mx-0.5 w-24"
              :class="{ active: mode === item.value }" @click="mode = item.value">
              {{ item.label }}
            </span>
          </div>
        </div>

        <div class="preview-formula mt-4">
          <span class="formula-label">{{ t('preview', locale) }}:</span>
          <span class="formula-item">TRANSPOSE</span>
          <span class="formula-operator">{{ t('rows', locale) }}</span>
          <span class="formula-item">{{ tableData?.length || 0 }}</span>
          <span class="formula-operator">↔</span>
          <span class="formula-item">{{ t('cols', locale) }}</span>
          <span class="formula-item">{{ tableColumn?.length || 0 }}</span>
        </div>

        <div class="transpose-demo mt-4 mb-4">
          <div class="demo-row">
            <div class="demo-label">{{ t('before', locale) }}</div>
            <div class="demo-grid">
              <div class="demo-cell header">A</div>
              <div class="demo-cell header">B</div>
              <div class="demo-cell header">C</div>
              <div class="demo-cell">D</div>
              <div class="demo-cell">E</div>
              <div class="demo-cell">F</div>
            </div>
          </div>
          <div class="demo-arrow">
            <Icon icon="ri:arrow-right-line" />
          </div>
          <div class="demo-row">
            <div class="demo-label">{{ t('after', locale) }}</div>
            <div class="demo-grid transposed">
              <div class="demo-cell header">A</div>
              <div class="demo-cell header">D</div>
              <div class="demo-cell header">B</div>
              <div class="demo-cell header">E</div>
              <div class="demo-cell header">C</div>
              <div class="demo-cell header">F</div>
            </div>
          </div>
        </div>

        <div class="cmd-preview-header">
          <span class="cmd-preview-title">{{ t('preview', locale) }} ({{ tableData?.length || 0 }} {{ t('rows', locale) }} × {{ tableColumn?.length || 0 }} {{ t('cols', locale) }})</span>
          <span class="cmd-mode-badge">{{ mode === 'memory' ? t('memory', locale) : t('multipass', locale) }}</span>
        </div>
        <div class="overflow-hidden rounded-lg">
          <SiliconeTable :data="tableData" :height="'350px'" show-overflow-tooltip class="select-text">
            <template #empty>
              <div class="flex items-center justify-center gap-2 text-gray-500">
                {{ t('noData', locale) }}
              </div>
            </template>
            <el-table-column v-for="col in tableColumn" :prop="col.prop" :label="col.label" :key="col.prop" />
          </SiliconeTable>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" :title="`${t('transpose', locale)} - ${t('transposeDesc', locale)}`" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
.preview-formula {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(145deg, #fdf2f8, #fce7f3);
  border-radius: 8px;
  flex-wrap: wrap;
}

.dark .preview-formula {
  background: linear-gradient(145deg, #2e1f26, #271a20);
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
  color: #ec4899;
  font-weight: 600;
}

.dark .formula-item {
  background: #2a2a2a;
  color: #f472b6;
}

.formula-operator {
  color: #888;
  font-size: 12px;
}

.dark .formula-operator {
  color: #999;
}

.transpose-demo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 10px;
}

.dark .transpose-demo {
  background: var(--el-fill-color-dark, #2a2a2a);
}

.demo-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.demo-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.demo-grid.transposed {
  grid-template-columns: repeat(2, 1fr);
}

.demo-cell {
  font-family: ui-monospace, monospace;
  background: white;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  font-weight: 500;
  text-align: center;
  border: 1px solid #e8e8e8;
}

.dark .demo-cell {
  background: #3a3a3a;
  color: #aaa;
  border-color: #444;
}

.demo-cell.header {
  background: linear-gradient(135deg, #fdf2f8, #fce7f3);
  color: #ec4899;
  border-color: #f9a8d4;
}

.dark .demo-cell.header {
  background: linear-gradient(135deg, #2e1f26, #271a20);
  color: #f472b6;
  border-color: #9d174d;
}

.demo-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #888;
}
</style>