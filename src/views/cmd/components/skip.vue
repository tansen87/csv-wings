<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { useDynamicHeight, updateEvent } from "@/utils/utils";
import { message } from "@/utils/message";
import { trimOpenFile } from "@/utils/view";
import { useMarkdown, mdSkip } from "@/utils/markdown";
import { useProgress } from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const path = ref("");
const fileSelect = ref([]);
const skipRows = ref("1");
const [dialog, isLoading] = [ref(false), ref(false)];
const { dynamicHeight } = useDynamicHeight(82);
const { mdShow } = useMarkdown(mdSkip);
const progress = useProgress();

listen("update-msg", (event: Event<string>) => {
  const [filename, rows] = event.payload.split("|");
  updateEvent(fileSelect, filename, file => {
    file.currentRows = rows;
  });
});
listen("total-msg", (event: Event<string>) => {
  const [filename, rows] = event.payload.split("|");
  console.log(rows);
  updateEvent(fileSelect, filename, file => {
    file.totalRows = rows;
  });
});
listen("info", (event: Event<string>) => {
  const filename = event.payload;
  updateEvent(fileSelect, filename, file => {
    file.status = "loading";
  });
});
listen("err", (event: Event<string>) => {
  const [filename, message] = event.payload.split("|");
  updateEvent(fileSelect, filename, file => {
    file.status = "error";
    file.message = message;
  });
  isLoading.value = false;
});
listen("success", (event: Event<string>) => {
  const filename = event.payload;
  updateEvent(fileSelect, filename, file => {
    file.status = "success";
  });
});

const successCount = computed(() => {
  return fileSelect.value.filter(f => f.status === "success").length;
});
const failedCount = computed(() => {
  return fileSelect.value.filter(f => f.status === "error").length;
});

async function selectFile() {
  fileSelect.value = [];
  const trimFile = await trimOpenFile(true, "csv", ["*"], {
    includeStatus: true
  });
  path.value = trimFile.filePath;
  fileSelect.value = trimFile.fileInfo;
}

// invoke skip
async function skipLines() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const result: string = await invoke("skip", {
      path: path.value,
      skipRows: skipRows.value,
      progress: progress.progress
    });
    message(`Skip done, elapsed time: ${result} s`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error", duration: 10000 });
  }
  isLoading.value = false;
}

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => skipLines(),
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
      class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center gap-4">
        <h1
          class="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2"
          @click="dialog = true"
        >
          <Icon icon="ri:skip-forward-line" />
          Skip
        </h1>

        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />

        <div class="text-xs font-semibold text-gray-400">
          Skip rows from CSV
        </div>
      </div>

      <div class="flex items-center">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File(s)
        </SiliconeButton>
        <SiliconeButton @click="skipLines()" :loading="isLoading" text>
          Run
        </SiliconeButton>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <aside
        class="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4"
      >
        <div class="mb-4">
          <label
            class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block"
          >
            SKIP ROWS
          </label>
          <SiliconeTooltip
            content="Number of rows to skip from the beginning"
            placement="right"
          >
            <SiliconeInput v-model="skipRows" placeholder="e.g. 10" />
          </SiliconeTooltip>
          <p class="mt-1 text-[10px] text-gray-400">
            Skip this many rows from the beginning of each file
          </p>
        </div>

        <div
          class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <div class="flex items-start gap-2">
            <Icon
              icon="ri:information-line"
              class="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0"
            />
            <div class="text-[12px] text-blue-700 dark:text-blue-300">
              Useful for skipping header rows or metadata at the start of CSV
              files
            </div>
          </div>
        </div>

        <div class="mt-auto">
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-3">
            STATISTICS
          </div>

          <div class="space-y-2">
            <div
              class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div
                    class="text-lg font-bold text-blue-600 dark:text-blue-400"
                  >
                    {{ skipRows || 0 }}
                  </div>
                  <div class="text-[12px] text-blue-600 dark:text-blue-400">
                    Skip Rows
                  </div>
                </div>
                <Icon
                  icon="ri:skip-forward-line"
                  class="w-6 h-6 text-blue-500"
                />
              </div>
            </div>

            <div
              class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-lg font-bold text-gray-800 dark:text-white">
                    {{ fileSelect?.length || 0 }}
                  </div>
                  <div class="text-[12px] text-gray-500 dark:text-gray-400">
                    Files
                  </div>
                </div>
                <Icon icon="ri:file-list-line" class="w-6 h-6 text-gray-400" />
              </div>
            </div>

            <div
              class="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div
                    class="text-lg font-bold text-green-600 dark:text-green-400"
                  >
                    {{ successCount }}
                  </div>
                  <div class="text-[12px] text-green-600 dark:text-green-400">
                    Succeeded
                  </div>
                </div>
                <Icon
                  icon="ri:checkbox-circle-line"
                  class="w-6 h-6 text-green-500"
                />
              </div>
            </div>

            <div
              class="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-lg font-bold text-red-600 dark:text-red-400">
                    {{ failedCount }}
                  </div>
                  <div class="text-[12px] text-red-600 dark:text-red-400">
                    Failed
                  </div>
                </div>
                <Icon
                  icon="ri:error-warning-line"
                  class="w-6 h-6 text-red-500"
                />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div
        class="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden"
      >
        <div
          class="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-500 dark:text-gray-400">
              Files ({{ fileSelect?.length || 0 }})
            </span>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded"
              >
                <Icon icon="ri:skip-forward-line" class="w-3.5 h-3.5" />
                Skip: {{ skipRows || 0 }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-2">
          <div
            class="h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <SiliconeTable
              :data="fileSelect"
              :height="'100%'"
              empty-text="No data. (Ctrl+D) to Open File."
              show-overflow-tooltip
              class="select-text"
            >
              <el-table-column prop="filename" label="File" min-width="200">
                <template #default="{ row }">
                  <div class="flex items-center">
                    <span class="text-sm text-gray-700 dark:text-gray-300">
                      {{ row.filename }}
                    </span>
                  </div>
                </template>
              </el-table-column>

              <el-table-column prop="status" label="Status" width="100">
                <template #default="{ row }">
                  <div class="flex items-center gap-2">
                    <Icon
                      v-if="row.status === 'loading'"
                      icon="ri:loader-4-line"
                      class="table-loading"
                    />
                    <Icon
                      v-else-if="row.status === 'success'"
                      icon="ri:check-circle-line"
                    />
                    <Icon
                      v-else-if="row.status === 'error'"
                      icon="ri:error-warning-line"
                    />
                  </div>
                </template>
              </el-table-column>

              <el-table-column prop="message" label="Message" min-width="200">
                <template #default="{ row }">
                  <div v-if="row.status === 'error'">
                    {{ row.message }}
                  </div>
                  <SiliconeProgress
                    v-else-if="
                      row.totalRows !== 0 &&
                      isFinite(row.currentRows / row.totalRows)
                    "
                    :percentage="
                      Math.round((row.currentRows / row.totalRows) * 100)
                    "
                  />
                  <span v-else class="text-xs text-gray-400">
                    {{ row.message }}
                  </span>
                </template>
              </el-table-column>
            </SiliconeTable>
          </div>
        </div>
      </div>
    </main>

    <SiliconeDialog
      v-model="dialog"
      title="Skip - Skip rows from CSV"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>

<style>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.table-loading {
  animation: spin 1s linear infinite;
  display: inline-block;
}
</style>
