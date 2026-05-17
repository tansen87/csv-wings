<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { viewOpenFile, toJson } from "@/utils/view";
import { mdReverse, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/setting";
import { message } from "@/utils/message"
import { useLocale, t } from "@/store/modules/locale";
import { storeToRefs } from "pinia";
import "./common.css";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const localeStore = useLocale();
const { locale } = storeToRefs(localeStore);

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Reverse] ${msg}`, type);
};

const path = ref("");
const [tableColumn, tableData] = [ref([]), ref([])];
const [loading, dialog] = [ref(false), ref(false)];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdReverse);
const quoting = useQuoting();
const skiprows = useSkiprows();
const flexible = useFlexible();

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
    addLog(`${t('failedToLoadFile', locale.value)}: ${e}`, 'error');
  }
}

async function reverseData() {
  if (path.value === "") {
    message(t('fileNotSelected', locale.value), { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(`${t('startingReverse', locale.value)}...`, 'info');

    const rtime: string = await invoke("reverse", {
      path: path.value,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible
    });
    addLog(`${t('reverseDone', locale.value)}, ${t('elapsedTime', locale.value)}: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`${t('reverseFailed', locale.value)}: ${e}`, 'error');
  } finally {
    loading.value = false;
  }
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
          <Icon icon="ri:arrow-up-down-line" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('reverse', locale) }}</h1>
          <p>{{ t('reverseDesc', locale) }}</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="p-3">
        <div class="cmd-file-selection-bar" @click="selectFile()">
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
            <SiliconeButton @click.stop="reverseData()" :loading="loading" size="small">
              {{ t('run', locale) }}
            </SiliconeButton>
          </div>
        </div>

        <div class="preview-formula mt-4">
          <span class="formula-label">{{ t('preview', locale) }}:</span>
          <span class="formula-item">{{ t('reverse', locale).toUpperCase() }}</span>
          <span class="formula-operator">{{ t('rows', locale).toUpperCase() }}</span>
          <span class="formula-item">{{ tableData?.length || 0 }}</span>
          <span class="formula-operator">{{ t('firstLast', locale) }}</span>
        </div>

        <div class="reverse-demo mt-4 mb-4">
          <div class="demo-row">
            <div class="demo-label">{{ t('before', locale) }}</div>
            <div class="demo-items">
              <span class="demo-item">1</span>
              <span class="demo-item">2</span>
              <span class="demo-item">3</span>
            </div>
          </div>
          <div class="demo-arrow">
            <Icon icon="ri:arrow-right-line" />
          </div>
          <div class="demo-row">
            <div class="demo-label">{{ t('after', locale) }}</div>
            <div class="demo-items">
              <span class="demo-item reversed">3</span>
              <span class="demo-item reversed">2</span>
              <span class="demo-item reversed">1</span>
            </div>
          </div>
        </div>

        <div class="cmd-preview-header">
          <span class="cmd-preview-title">{{ t('preview', locale) }} ({{ tableData?.length || 0 }} {{ t('rows', locale) }})</span>
          <span class="cmd-mode-badge">{{ t('reverse', locale) }}</span>
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

    <SiliconeDialog v-model="dialog" :title="`${t('reverse', locale)} - ${t('reverseDesc', locale)}`" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
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

.formula-operator {
  color: #888;
  font-size: 12px;
}

.reverse-demo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 10px;
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

.demo-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.demo-item {
  font-family: ui-monospace, monospace;
  background: white;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #666;
  font-weight: 500;
  border: 1px solid #e8e8e8;
}

.demo-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #888;
}
</style>