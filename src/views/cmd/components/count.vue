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
import { message } from "@/utils/message";
import "./common.css";

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
  } else if (selected === null) {
    return;
  } else {
    path.value = selected;
    fileSelect.value = [{ filename: shortFileName(selected), status: " " }];
  }
}

async function countData() {
  if (path.value === "") {
    message("CSV file not selected", { type: 'warning' });
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
  message(`Removed file: ${removedFile.filename}`, { type: 'info' });
};

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [fileSelect].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:numbers-line" />
        </div>
        <div class="cmd-header-text">
          <h1>Count</h1>
          <p>Count or check CSV files</p>
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
                <span class="cmd-file-name">{{ fileSelect.length }} file(s) selected</span>
              </template>
              <template v-else>
                <span class="cmd-file-prompt">Click to select files</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="countData()" :loading="loading" size="small">
                Run
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

          <div v-if="fileSelect.length > 0" class="cmd-stats-grid mt-4">
            <div class="cmd-stat-card cmd-stat-success">
              <div class="cmd-stat-value">{{ successCount }}</div>
              <div class="cmd-stat-label">Succeed</div>
            </div>
            <div class="cmd-stat-card cmd-stat-error">
              <div class="cmd-stat-value">{{ failedCount }}</div>
              <div class="cmd-stat-label">Failed</div>
            </div>
            <div v-if="mode === 'count'" class="cmd-stat-card cmd-stat-total">
              <div class="cmd-stat-value">{{ totalRows }}</div>
              <div class="cmd-stat-label">Total Rows</div>
            </div>
          </div>

          <div class="cmd-preview-header mt-4">
            <span class="cmd-preview-title">FILE LIST ({{ fileSelect.length }})</span>
          </div>
          <div class="overflow-hidden rounded-lg">
            <SiliconeTable :data="fileSelect" :height="'300px'" show-overflow-tooltip :row-style="{ height: '40px' }"
              :cell-style="{
                borderBottom: '1px solid #f0f0f0'
              }" class="select-text">
              <template #empty>
                <div class="flex items-center justify-center gap-2 text-gray-500">
                  No data. Click above to select files.
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
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Count - Count the rows of CSV files" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>
