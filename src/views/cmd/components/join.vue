<script setup lang="ts">
import { ref, reactive, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { mapHeaders, viewOpenFile, toJson } from "@/utils/view";
import { mdJoin, useMarkdown } from "@/utils/markdown";
import { useQuoting, useSkiprows } from "@/store/modules/options";

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
    addLog(`File selection cancelled for Data ${fileIndex}`, 'info');
    return;
  }
  addLog(`Selected file for Data ${fileIndex}: ${data[path]}`, 'info');

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

// invoke join
async function joinData() {
  if (data.path1 === "" || data.path2 === "") {
    addLog("File not selected", 'warning');
    return;
  }
  if (sel1.value.length === 0 || sel2.value.length === 0) {
    addLog("Column not selected", 'warning');
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
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:merge-cells-horizontal" />
          Join
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400">
          Joins two sets of CSV data on the specified columns
        </div>
      </div>
    </SiliconeCard>

    <el-scrollbar class="flex-1 px-4 pb-4 min-h-0">
      <div class="flex flex-col gap-4">
        <SiliconeCard>
          <div class="flex justify-between items-center mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              FILE SELECTION
            </div>
            <div class="flex items-center">
              <SiliconeButton @click="joinData()" :loading="loading" size="small" text>
                <Icon icon="ri:play-large-line" class="w-4 h-4" />
              </SiliconeButton>
            </div>
          </div>

          <div class="mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              DATA FILES
            </div>
            <div class="grid grid-cols-2 gap-4">
              <SiliconeButton @click="selectFile(1)"
                class="p-4 text-center rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                :class="data.path1
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : ''
                  " size="small" text>
                <Icon icon="ri:file-text-line" class="w-4 h-4 mx-auto" :class="data.path1 ? 'text-green-500' : 'text-gray-400'
                  " />
                <div :class="data.path1
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-500 dark:text-gray-400'
                  " class="text-sm font-medium">
                  {{ data.path1 ? "✓ Data 1" : "Data 1" }}
                </div>
              </SiliconeButton>
              <SiliconeButton @click="selectFile(2)"
                class="p-4 text-center rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                :class="data.path2
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : ''
                  " size="small" text>
                <Icon icon="ri:file-text-line" class="w-4 h-4 mx-auto" :class="data.path2 ? 'text-green-500' : 'text-gray-400'
                  " />
                <div :class="data.path2
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-500 dark:text-gray-400'
                  " class="text-sm font-medium">
                  {{ data.path2 ? "✓ Data 2" : "Data 2" }}
                </div>
              </SiliconeButton>
            </div>
          </div>

          <div class="mb-4">
            <label class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block">
              JOIN CONFIGURATION
            </label>
            <div class="flex gap-4 mb-4">
              <div class="flex-1">
                <span class="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">
                  Data 1 Column
                </span>
                <SiliconeSelect v-model="sel1" filterable placeholder="Select column" class="w-full">
                  <el-option v-for="item in tableHeader1" :key="item.value" :label="item.label" :value="item.value" />
                </SiliconeSelect>
              </div>

              <div class="flex-1">
                <span class="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Data 2 Column
                </span>
                <SiliconeSelect v-model="sel2" filterable placeholder="Select column" class="w-full">
                  <el-option v-for="item in tableHeader2" :key="item.value" :label="item.label" :value="item.value" />
                </SiliconeSelect>
              </div>

              <div class="flex-1">
                <label class="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">
                  JOIN TYPE
                </label>
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

            <div class="mb-4">
              <label class="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">
                NULL HANDLING
              </label>
              <SiliconeTooltip content="When True, joins will work on empty fields" placement="right">
                <div class="mode-toggle">
                  <span v-for="item in nullOptions" :key="String(item.value)" class="mode-item mx-1 w-24"
                    :class="{ active: nulls === item.value }" @click="nulls = item.value">
                    {{ item.label }}
                  </span>
                </div>
              </SiliconeTooltip>
            </div>
          </div>

          <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div class="text-[12px] text-blue-700 dark:text-blue-300">
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
            </div>
          </div>

          <div class="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <label class="text-xs font-semibold text-gray-400 tracking-wider block mb-2">
              CONFIG
            </label>
            <div class="space-y-1 text-xs">
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Data 1:</span>
                <span class="font-mono text-green-600 dark:text-green-400">{{
                  sel1 || "-"
                }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Data 2:</span>
                <span class="font-mono text-blue-600 dark:text-blue-400">{{
                  sel2 || "-"
                }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Type:</span>
                <span class="font-mono">{{ joinType }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Nulls:</span>
                <span class="font-mono">{{ nulls }}</span>
              </div>
            </div>
          </div>
        </SiliconeCard>

        <div class="grid grid-cols-2 gap-4">
          <SiliconeCard>
            <div class="flex items-center justify-between mb-4">
              <div class="text-xs font-semibold text-gray-400 tracking-wider">
                DATA 1 PREVIEW
              </div>
              <div v-if="data.path1" class="text-xs text-gray-500 dark:text-gray-400">
                {{ data.path1 }}
              </div>
            </div>
            <div class="overflow-hidden rounded-lg">
              <SiliconeTable :data="tableData1" :height="'400px'"
                empty-text="No data. Click 'Data 1' to select a CSV file." show-overflow-tooltip class="select-text">
                <el-table-column v-for="column in tableColumn1" :prop="column.prop" :label="column.label"
                  :key="column.prop" />
              </SiliconeTable>
            </div>
          </SiliconeCard>

          <SiliconeCard>
            <div class="flex items-center justify-between mb-4">
              <div class="text-xs font-semibold text-gray-400 tracking-wider">
                DATA 2 PREVIEW
              </div>
              <div v-if="data.path2" class="text-xs text-gray-500 dark:text-gray-400">
                {{ data.path2 }}
              </div>
            </div>
            <div class="overflow-hidden rounded-lg">
              <SiliconeTable :data="tableData2" :height="'400px'"
                empty-text="No data. Click 'Data 2' to select a CSV file." show-overflow-tooltip class="select-text">
                <el-table-column v-for="column in tableColumn2" :prop="column.prop" :label="column.label"
                  :key="column.prop" min-width="100" />
              </SiliconeTable>
            </div>
          </SiliconeCard>
        </div>

        <SiliconeCard>
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
            USAGE
          </div>
          <div class="flex flex-col gap-2">
            <SiliconeText type="info">1. Click
              <Icon icon="ri:file-text-line" class="w-4 h-4 inline align-middle" /> to select two CSV files
            </SiliconeText>
            <SiliconeText type="info">2. Select the join columns from each dataset</SiliconeText>
            <SiliconeText type="info">3. Configure null handling and join type</SiliconeText>
            <SiliconeText type="info">4. Review the join type description to understand the expected result
            </SiliconeText>
            <SiliconeText type="info">5. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to start the join process
            </SiliconeText>
            <SiliconeText type="info">6. Check the output log for details</SiliconeText>
            <SiliconeText type="info">7. The output file will be created in the same directory as the original files
            </SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Join - Joins two sets of CSV data on the specified columns" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
:deep(.silicone-card) {
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}
</style>
