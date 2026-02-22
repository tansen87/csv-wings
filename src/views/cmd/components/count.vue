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
import { message } from "@/utils/message";
import { useMarkdown, mdCount } from "@/utils/markdown";
import { useSkiprows } from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const mode = ref("count");
const modeOptions = [
  { label: "Count", value: "count" },
  { label: "Check", value: "check" }
];
const path = ref("");
const [dialog, isLoading] = [ref(false), ref(false)];
const fileSelect = ref([]);
const { dynamicHeight } = useDynamicHeight(82);
const { mdShow } = useMarkdown(mdCount);
const skiprows = useSkiprows();

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
  }
}

// invoke count
async function countData() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const rtime: string = await invoke("count", {
      path: path.value,
      mode: mode.value,
      skiprows: skiprows.skiprows
    });
    message(`${mode.value} done, elapsed time: ${rtime} s`, {
      type: "success"
    });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}

const removeFile = index => {
  fileSelect.value.splice(index, 1);
};

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => countData(),
  onHelp: () => {
    dialog.value = !dialog.value;
  }
});

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [fileSelect].forEach(r => (r.value = []));
});
</script>

<template>
  <el-form class="page-view">
    <header
      class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800"
    >
      <div class="flex items-center gap-4">
        <h1
          class="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2"
          @click="dialog = true"
        >
          <Icon icon="ri:numbers-line" />
          Count
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="mode-toggle w-40">
          <span
            v-for="item in modeOptions"
            :key="item.value"
            class="mode-item"
            :class="{ active: mode === item.value }"
            @click="mode = item.value"
          >
            {{ item.label }}
          </span>
        </div>
      </div>

      <div class="flex items-center">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File(s)
        </SiliconeButton>
        <SiliconeButton @click="countData()" :loading="isLoading" text>
          {{ mode === "count" ? "Count" : "Check" }}
        </SiliconeButton>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <aside
        class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4 md:flex"
      >
        <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
          STATISTICS
        </div>

        <div class="space-y-3">
          <div
            class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
          >
            <div class="flex items-center justify-between">
              <div class="text-2xl font-bold text-gray-800 dark:text-white">
                {{ fileSelect.length }}
              </div>
              <Icon icon="ri:file-list-3-line" class="w-6 h-6 text-gray-400" />
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Files Loaded
            </div>
          </div>

          <div
            class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
          >
            <div class="flex items-center justify-between">
              <div
                class="text-2xl font-bold text-green-600 dark:text-green-400"
              >
                {{ successCount }}
              </div>
              <Icon
                icon="ri:checkbox-circle-line"
                class="w-6 h-6 text-green-500"
              />
            </div>
            <div class="text-xs text-green-600 dark:text-green-400 mt-1">
              Succeed
            </div>
          </div>

          <div
            class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
          >
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

          <div
            v-if="mode === 'count'"
            class="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800"
          >
            <div class="flex items-center justify-between">
              <div
                class="text-2xl font-bold text-indigo-600 dark:text-indigo-400"
              >
                {{ totalRows }}
              </div>
              <Icon icon="ri:numbers-line" class="w-6 h-6 text-indigo-500" />
            </div>
            <div class="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
              Total Rows
            </div>
          </div>
        </div>
      </aside>

      <div
        class="flex-1 bg-white dark:bg-gray-800 flex flex-col overflow-hidden"
      >
        <div class="flex-1 overflow-auto p-2">
          <SiliconeTable
            :data="fileSelect"
            :height="'100%'"
            empty-text="No data. (Ctrl+D) to Open File(s)."
            show-overflow-tooltip
            :row-style="{ height: '50px' }"
            :cell-style="{
              borderBottom: '1px solid #f0f0f0'
            }"
            class="select-text"
          >
            <el-table-column prop="filename" label="File" min-width="120" />
            <el-table-column prop="status" label="Status" width="70">
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

            <el-table-column prop="message" label="Message">
              <template #default="scope">
                <span
                  v-if="scope.row.status === 'error'"
                  class="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded"
                >
                  {{ scope.row.message }}
                </span>
                <span
                  v-else-if="scope.row.status === 'success'"
                  class="text-xs text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded"
                >
                  {{ scope.row.message }}
                </span>
              </template>
            </el-table-column>

            <el-table-column width="70">
              <template #default="scope">
                <SiliconeTag @click="removeFile(scope.$index)" type="danger">
                  <Icon icon="ri:delete-bin-line" />
                </SiliconeTag>
              </template>
            </el-table-column>
          </SiliconeTable>
        </div>
      </div>
    </main>

    <SiliconeDialog
      v-model="dialog"
      title="Count - Count the rows of CSV files"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
