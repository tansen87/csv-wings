<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { ElIcon } from "element-plus";
import { Loading, CloseBold, Select } from "@element-plus/icons-vue";
import { Icon } from "@iconify/vue";
import { shortFileName, useDynamicHeight, updateEvent } from "@/utils/utils";
import { useMarkdown, mdCount } from "@/utils/markdown";
import { useSkiprows } from "@/store/modules/options";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const mode = ref("count");
const modeOptions = [
  { label: "Count", value: "count" },
  { label: "Check", value: "check" }
];
const path = ref("");
const [dialog, loading] = [ref(false), ref(false)];
const fileSelect = ref([]);
const { dynamicHeight } = useDynamicHeight(82);
const { mdShow } = useMarkdown(mdCount);
const skiprows = useSkiprows();

const addLog = (message: string, type: string = 'info') => {
  emit('add-log', `[Count] ${message}`, type);
};

listen("info", (event: Event<string>) => {
  const filename = event.payload;
  updateEvent(fileSelect, filename, file => {
    file.status = "";
  });
});
listen("err", (event: Event<string>) => {
  const [filename, message] = event.payload.split("|");
  updateEvent(fileSelect, filename, file => {
    file.status = "error";
    file.message = message;
  });
});
listen("success", (event: Event<string>) => {
  const [filename, message] = event.payload.split("|");
  updateEvent(fileSelect, filename, file => {
    file.status = "success";
    file.message = message;
  });
});

const successCount = computed(() => {
  return fileSelect.value.filter(f => f.status === "success").length;
});
const failedCount = computed(() => {
  return fileSelect.value.filter(f => f.status === "error").length;
});
const totalRows = computed(() => {
  return fileSelect.value
    .filter(f => f.status === "success")
    .reduce((sum, f) => sum + (parseInt(f.message) || 0), 0) as number;
});

async function selectFile() {
  const selected = await open({
    multiple: true,
    filters: [
      {
        name: "csv",
        extensions: ["*"]
      }
    ]
  });
  if (Array.isArray(selected)) {
    path.value = selected.join("|").toString();
    const nonEmptyRows = selected.filter((row: any) => row.trim() !== "");
    fileSelect.value = nonEmptyRows.map((file: any) => {
      return { filename: shortFileName(file), status: " " };
    });
    addLog(`Selected ${fileSelect.value.length} files`, 'info');
  } else if (selected === null) {
    return;
  } else {
    path.value = selected;
    fileSelect.value = [{ filename: shortFileName(selected), status: " " }];
    addLog(`Selected file: ${shortFileName(selected)}`, 'info');
  }
}

async function countData() {
  if (path.value === "") {
    addLog("CSV file not selected", 'warning');
    return;
  }

  try {
    loading.value = true;
    addLog(`Starting ${mode.value}...`, 'info');
    const rtime: string = await invoke("count", {
      path: path.value,
      mode: mode.value,
      skiprows: skiprows.skiprows
    });
    addLog(`${mode.value} done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`${e}`, 'error');
  }
  loading.value = false;
}

const removeFile = index => {
  const removedFile = fileSelect.value[index];
  fileSelect.value.splice(index, 1);
  addLog(`Removed file: ${removedFile.filename}`, 'info');
};

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [fileSelect].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:numbers-line" />
          Count
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400 tracking-wider">
          Count or check CSV files
        </div>
        <div class="mode-toggle ml-auto">
          <span v-for="item in modeOptions" :key="item.value" class="mode-item mx-1 w-24" :class="{ active: mode === item.value }"
            @click="mode = item.value">
            {{ item.label }}
          </span>
        </div>
      </div>
    </SiliconeCard>

    <el-scrollbar class="flex-1 px-4 pb-4 min-h-0">
      <div class="flex flex-col gap-4">
        <SiliconeCard>
          <div class="flex justify-between items-center mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              SELECTED FILE(S)
            </div>
            <div class="flex items-center">
              <SiliconeButton @click="selectFile()" size="small" text>
                <Icon icon="ri:folder-open-line" class="w-4 h-4" />
              </SiliconeButton>
              <SiliconeButton @click="countData()" :loading="loading" size="small" text>
                <Icon icon="ri:play-large-line" class="w-4 h-4" />
              </SiliconeButton>
            </div>
          </div>

          <div v-if="fileSelect.length > 0" class="mb-4 flex gap-4">
            <div
              class="flex-1 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div class="flex items-center justify-between">
                <div class="text-2xl font-bold text-gray-800 dark:text-white">
                  {{ fileSelect.length }}
                </div>
                <Icon icon="ri:file-list-3-line" class="w-6 h-6 text-gray-400" />
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Loaded
              </div>
            </div>

            <div
              class="flex-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div class="flex items-center justify-between">
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">
                  {{ successCount }}
                </div>
                <Icon icon="ri:checkbox-circle-line" class="w-6 h-6 text-green-500" />
              </div>
              <div class="text-xs text-green-600 dark:text-green-400 mt-1">
                Succeed
              </div>
            </div>

            <div class="flex-1 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div class="flex items-center justify-between">
                <div class="text-2xl font-bold text-red-600 dark:text-red-400">
                  {{ failedCount }}
                </div>
                <Icon icon="ri:error-warning-line" class="w-6 h-6 text-red-500" />
              </div>
              <div class="text-xs text-red-600 dark:text-red-400 mt-1">
                Failed
              </div>
            </div>

            <div v-if="mode === 'count'"
              class="flex-1 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div class="flex items-center justify-between">
                <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {{ totalRows }}
                </div>
                <Icon icon="ri:numbers-line" class="w-6 h-6 text-indigo-500" />
              </div>
              <div class="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                Total Rows
              </div>
            </div>
          </div>

          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="fileSelect" :height="'300px'" show-overflow-tooltip :row-style="{ height: '40px' }"
              :cell-style="{
                borderBottom: '1px solid #f0f0f0'
              }" class="select-text">
              <template #empty>
                <div class="flex items-center gap-2">
                  No data. Click
                  <Icon icon="ri:folder-open-line" class="w-4 h-4" />
                  to select files.
                </div>
              </template>
              <el-table-column prop="filename" label="File" min-width="150" />
              <el-table-column prop="status" width="70">
                <template #default="scope">
                  <ElIcon v-if="scope.row.status === ''" class="is-loading">
                    <Loading />
                  </ElIcon>
                  <ElIcon v-else-if="scope.row.status === 'success'">
                    <Select />
                  </ElIcon>
                  <ElIcon v-else-if="scope.row.status === 'error'">
                    <CloseBold />
                  </ElIcon>
                </template>
              </el-table-column>

              <el-table-column prop="message" label="Message" min-width="100">
                <template #default="scope">
                  <span v-if="scope.row.status === 'error'"
                    class="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                    {{ scope.row.message }}
                  </span>
                  <span v-else-if="scope.row.status === 'success'"
                    class="text-xs text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                    {{ scope.row.message }}
                  </span>
                </template>
              </el-table-column>

              <el-table-column width="60">
                <template #default="scope">
                  <SiliconeTag @click="removeFile(scope.$index)" type="danger">
                    <Icon icon="ri:delete-bin-line" />
                  </SiliconeTag>
                </template>
              </el-table-column>
            </SiliconeTable>
          </div>
        </SiliconeCard>

        <SiliconeCard>
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
            USAGE
          </div>
          <div class="flex flex-col gap-2">
            <SiliconeText type="info">1. Click "Open File(s)" to select one or more CSV files</SiliconeText>
            <SiliconeText type="info">2. Choose mode: Count (count rows) or Check (validate CSV)</SiliconeText>
            <SiliconeText type="info">3. Click "Run" to process the selected CSV files</SiliconeText>
            <SiliconeText type="info">4. Check the table and output log for details</SiliconeText>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Count - Count the rows of CSV files" width="70%">
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
