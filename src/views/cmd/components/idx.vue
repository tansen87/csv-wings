<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { ElIcon } from "element-plus";
import { Icon } from "@iconify/vue";
import { Loading, CloseBold, Select } from "@element-plus/icons-vue";
import { shortFileName, useDynamicHeight, updateEvent } from "@/utils/utils";
import { message } from "@/utils/message";
import { useMarkdown, mdIndex } from "@/utils/markdown";
import { useQuoting, useSkiprows } from "@/store/modules/options";
import { useShortcuts } from "@/utils/globalShortcut";

const path = ref("");
const [dialog, isLoading] = [ref(false), ref(false)];
const fileSelect = ref([]);
const { dynamicHeight } = useDynamicHeight(108);
const { mdShow } = useMarkdown(mdIndex);
const skiprowsStore = useSkiprows();
const quotingStore = useQuoting();

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

// invoke csv_idx
async function createIndex() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const rtime: string = await invoke("csv_idx", {
      path: path.value,
      quoting: quotingStore.quoting,
      skiprows: skiprowsStore.skiprows
    });
    message(`Create index done, elapsed time: ${rtime} s`, {
      type: "success"
    });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => createIndex(),
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
  <div class="page-view">
    <SiliconeCard v-if="path && fileSelect.length" shadow="never">
      <div class="flex gap-2 mt-1 mb-1 ml-1 mr-1">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File(s)
        </SiliconeButton>
        <SiliconeButton @click="createIndex()" :loading="isLoading" text>
          Run
        </SiliconeButton>
        <div class="flex-grow" />
        <SiliconeTag @click="dialog = true" type="warning" size="large">
          Index
        </SiliconeTag>
      </div>
    </SiliconeCard>

    <el-empty v-if="!path" :image-size="160">
      <template #image>
        <Icon icon="ri:rocket-line" />
        <SiliconeTag @click="dialog = true" class="w-16" type="warning">
          Index
        </SiliconeTag>
      </template>

      <template #description>
        <div class="empty-desc mt-6">
          <div class="desc-row">
            <SiliconeTag type="success" @click="selectFile">
              Open File(s)
            </SiliconeTag>
            <SiliconeTag>Ctrl + D</SiliconeTag>
          </div>
          <div class="desc-row">
            <SiliconeTag type="info">Run</SiliconeTag>
            <SiliconeTag>Ctrl + R</SiliconeTag>
          </div>
          <div class="desc-row">
            <SiliconeTag type="info">Help</SiliconeTag>
            <SiliconeTag>Ctrl + B</SiliconeTag>
          </div>
        </div>
      </template>

      <SiliconeTag type="info"> Create an index for a CSV </SiliconeTag>
    </el-empty>

    <div v-else class="flex-1 flex flex-col">
      <SiliconeCard shadow="never" class="flex-1 flex flex-col">
        <el-scrollbar>
          <SiliconeTable
            :data="fileSelect"
            show-overflow-tooltip
            class="ml-1 mr-1 mt-1 mb-1"
            :style="{ width: 'calc(100% - 8px)' }"
            :height="dynamicHeight"
          >
            <el-table-column type="index" width="35" />
            <el-table-column prop="filename" label="File" />
            <el-table-column prop="status" label="Status">
              <template #default="scope">
                <ElIcon v-if="scope.row.status === ''" class="is-loading">
                  <Loading />
                </ElIcon>
                <ElIcon
                  v-else-if="scope.row.status === 'success'"
                  color="#00CD66"
                >
                  <Select />
                </ElIcon>
                <ElIcon
                  v-else-if="scope.row.status === 'error'"
                  color="#FF0000"
                >
                  <CloseBold />
                </ElIcon>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="Message">
              <template #default="scope">
                <span v-if="scope.row.status === 'error'">
                  {{ scope.row.message }}
                </span>
              </template>
            </el-table-column>
          </SiliconeTable>
        </el-scrollbar>
      </SiliconeCard>
    </div>

    <SiliconeDialog
      v-model="dialog"
      title="Index - Create an index for a CSV."
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </div>
</template>

<style scoped>
:deep(.el-card__body) {
  padding: 0 !important;
}
</style>
