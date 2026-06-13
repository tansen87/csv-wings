<script setup lang="ts">
import { onUnmounted, ref, watch, computed } from "vue";
import { storeToRefs } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { CheckboxValueType } from "element-plus";
import { mdApply, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/setting";
import { message } from "@/utils/message";
import { useLocale, t } from "@/store/modules/locale";
import "./common.css";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Apply] ${msg}`, type);
};

const [loading, checkAll, indeterminate, newColumn, dialog, backendCompleted] =
  [ref(false), ref(false), ref(false), ref(false), ref(false), ref(false)];
const [operations, tableHeader, tableColumn, tableData] = [
  ref([]),
  ref([]),
  ref([]),
  ref([])
];
const [path, comparand, replacement, formatstr, backendInfo] = [
  ref(""),
  ref(""),
  ref(""),
  ref(""),
  ref("")
];
const mode = ref("operations");

const localeStore = useLocale();
const { locale } = storeToRefs(localeStore);

const modeOptions = computed(() => [
  { label: t('operations', locale.value), value: "operations" },
  { label: t('calcConv', locale.value), value: "calcconv" },
  { label: t('dynFmt', locale.value), value: "dynfmt" }
]);

const placeholderText = computed(() => `${t('formatStr', locale.value)} \n${t('formatExample', locale.value)}`);

const columnContent = computed(() => 
  newColumn.value ? t('addColumn', locale.value) : t('noColumn', locale.value)
);

const columns = ref<CheckboxValueType[]>([]);
const { dynamicHeight } = useDynamicHeight(120);
watch(columns, val => {
  if (val.length === 0) {
    checkAll.value = false;
    indeterminate.value = false;
  } else if (val.length === tableHeader.value.length) {
    checkAll.value = true;
    indeterminate.value = false;
  } else {
    indeterminate.value = true;
  }
});
const handleCheckAll = (val: CheckboxValueType) => {
  indeterminate.value = false;
  if (val) {
    columns.value = tableHeader.value.map(_ => _.value);
  } else {
    columns.value = [];
  }
};
const { mdShow } = useMarkdown(mdApply);
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
    tableHeader.value = await mapHeaders(path.value, skiprows.skiprows);
    const { columnView, dataView } = await toJson(
      path.value,
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
  } catch (e) {
    addLog(`${t('failedToLoadFile', locale.value)} ${e}`, 'error');
  }
}

// invoke apply
async function applyData() {
  if (path.value === "") {
    message(t('csvFileNotSelected', locale.value), { type: 'warning' });
    return;
  }

  let finalColumns = [...columns.value];
  if (
    (mode.value === "dynfmt" || mode.value === "calcconv") &&
    finalColumns.length === 0 &&
    tableHeader.value.length > 0
  ) {
    finalColumns = [tableHeader.value[0].value];
  }

  if (mode.value === "operations" && finalColumns.length === 0) {
    message(t('columnNotSelected', locale.value), { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog(`${t('startingApply', locale.value)} ${mode.value} ${t('mode', locale.value)}`, 'info');
    if (mode.value === 'operations' && operations.value.length > 0) {
      addLog(`${t('applyingOperations', locale.value)} ${operations.value.join(', ')}`, 'info');
    } else if (['cat', 'calcconv'].includes(mode.value)) {
      addLog(t('usingFormula', locale.value), 'info');
    }

    const result: string = await invoke("apply", {
      path: path.value,
      columns: finalColumns.join("|"),
      mode: mode.value,
      operations: operations.value.join("|"),
      comparand: comparand.value,
      replacement: replacement.value,
      formatstr: formatstr.value,
      newColumn: newColumn.value,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible
    });
    addLog(`${t('applyDone', locale.value)} ${result} s`, 'success');
  } catch (e) {
    addLog(`${t('applyFailed', locale.value)} ${e}`, 'error');
  }
  loading.value = false;
}

function addNewColumn() {
  if (mode.value === "dynfmt" || mode.value === "calcconv") {
    newColumn.value = true;
    return;
  }
  newColumn.value = !newColumn.value;
}

watch(mode, newMode => {
  if (newMode === "dynfmt" || newMode === "calcconv") {
    newColumn.value = true;
  }
});

onUnmounted(() => {
  [path, comparand, replacement, formatstr, backendInfo].forEach(
    r => (r.value = "")
  );
  [operations, tableHeader, tableColumn, tableData].forEach(
    r => (r.value = [])
  );
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:stack-line" />
        </div>
        <div class="cmd-header-text">
          <h1>{{ t('apply', locale) }}</h1>
          <p>{{ t('applyDesc', locale) }}</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="cmd-main">
        <div class="p-3">
          <!-- File selection -->
          <div class="cmd-file-selection-bar mb-4" @click="selectFile">
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
            <div class="flex items-center gap-1 ml-auto">
              <SiliconeButton @click.stop="addNewColumn" :disabled="mode === 'cat' || mode === 'calcconv'" size="small">
                {{ columnContent }}
              </SiliconeButton>
              <SiliconeButton @click.stop="applyData()" :loading="loading" size="small">
                {{ t('run', locale) }}
              </SiliconeButton>
            </div>
          </div>

          <!-- Mode toggle -->
          <div class="flex justify-center">
            <div class="cmd-mode-toggle py-1">
              <span v-for="item in modeOptions" :key="item.value" class="cmd-mode-item mx-0.5 w-24"
                :class="{ active: mode === item.value }" @click="mode = item.value">
                {{ item.label }}
              </span>
            </div>
          </div>

          <!-- Options -->
          <div class="cmd-options-grid mt-4">
            <template v-if="mode === 'operations'">
              <div class="cmd-option-section">
                <div class="cmd-option-label">{{ t('columns', locale) }} ({{ columns.length }})</div>
                <SiliconeSelect v-model="columns" filterable multiple :placeholder="t('selectColumns', locale)">
                  <template #header>
                    <div class="flex items-center justify-between px-2 py-1">
                      <el-checkbox v-model="checkAll" :indeterminate="indeterminate" @change="handleCheckAll">
                        {{ t('all', locale) }}
                      </el-checkbox>
                      <span class="text-xs text-gray-400">
                        {{ columns.length }} {{ t('selected', locale) }}
                      </span>
                    </div>
                  </template>
                  <el-option v-for="item in tableHeader" :key="item.value" :label="item.label" :value="item.value" />
                </SiliconeSelect>
              </div>
              <div class="cmd-option-section">
                <div class="cmd-option-label">{{ t('operations', locale) }} ({{ operations.length }})</div>
                <SiliconeSelect v-model="operations" filterable multiple>
                  <el-option :label="t('copy', locale)" value="copy" />
                  <el-option :label="t('len', locale)" value="len" />
                  <el-option :label="t('lower', locale)" value="lower" />
                  <el-option :label="t('upper', locale)" value="upper" />
                  <el-option :label="t('trim', locale)" value="trim" />
                  <el-option :label="t('ltrim', locale)" value="ltrim" />
                  <el-option :label="t('rtrim', locale)" value="rtrim" />
                  <el-option :label="t('replace', locale)" value="replace" />
                  <el-option :label="t('round', locale)" value="round" />
                  <el-option :label="t('squeeze', locale)" value="squeeze" />
                  <el-option :label="t('strip', locale)" value="strip" />
                  <el-option :label="t('reverse', locale)" value="reverse" />
                  <el-option :label="t('abs', locale)" value="abs" />
                  <el-option :label="t('neg', locale)" value="neg" />
                  <el-option :label="t('normalize', locale)" value="normalize" />
                </SiliconeSelect>
              </div>

              <template v-if="operations.includes('replace')">
                <div class="cmd-option-panel">
                  <div class="cmd-option-panel-title">{{ t('replaceOptions', locale) }}</div>
                  <div class="cmd-option-panel-content">
                    <SiliconeInput v-model="comparand" :placeholder="t('find', locale)" size="small" />
                    <SiliconeInput v-model="replacement" :placeholder="t('replaceWith', locale)" size="small" />
                  </div>
                </div>
              </template>

              <template v-if="operations.includes('round')">
                <div class="cmd-option-panel">
                  <div class="cmd-option-panel-title">{{ t('roundOptions', locale) }}</div>
                  <div class="cmd-option-panel-content">
                    <SiliconeInput v-model="formatstr" :placeholder="t('roundPlace', locale)" size="small" />
                  </div>
                </div>
              </template>
            </template>

            <template v-if="['cat', 'calcconv'].includes(mode)">
              <div class="cmd-option-section full-width">
                <div class="cmd-option-label">{{ t('formulaFormat', locale) }}</div>
                <SiliconeInput v-model="formatstr" :autosize="{ minRows: 4, maxRows: 6 }" type="textarea"
                  :placeholder="placeholderText" />
              </div>
            </template>
          </div>
        </div>

        <!-- Table -->
        <div class="p-3 mt-[-8px]">
          <div class="cmd-preview-header">
            <span class="cmd-preview-title">{{ t('preview', locale) }} ({{ tableData?.length || 0 }} {{ t('rows', locale) }})</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="tableData" :height="'400px'" show-overflow-tooltip class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  {{ t('noData', locale) }}
                </div>
              </template>
              <el-table-column v-for="column in tableColumn" :prop="column.prop" :label="column.label"
                :key="column.prop" />
            </SiliconeTable>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" :title="`${t('apply', locale)} - ${t('applyDesc', locale)}`"
      width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>