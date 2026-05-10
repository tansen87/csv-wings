<script setup lang="ts">
import { ref } from "vue";
import { open, save } from "@tauri-apps/plugin-dialog";
import { appConfigDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { message } from "@/utils/message"
import "./common.css";

const [currentFiles, totalFiles] = [ref(0), ref(0)];
const [isLoading, dialog] = [ref(false), ref(false)];
const [folderPath, tableData] = [ref(""), ref<Record<string, any>[]>([])];

listen("update-rows", (event: Event<number>) => {
  currentFiles.value = event.payload;
});
listen("total-rows", (event: Event<number>) => {
  totalFiles.value = event.payload;
});

async function selectFolder() {
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: await appConfigDir()
  });
  if (Array.isArray(selected)) {
    folderPath.value = selected.toString();
  } else if (selected === null) {
    folderPath.value = "";
    return;
  } else {
    folderPath.value = selected;
  }
  tableData.value = [];
  currentFiles.value = 0;
  totalFiles.value = 0;
}

async function traverseDirectory() {
  if (folderPath.value === "") {
    message("No folder selected", { type: "warning" });
    return;
  }

  const output = await save({
    title: "Export",
    defaultPath: `filename_${new Date().getTime()}.xlsx`,
    filters: [{ name: "Excel", extensions: ["xlsx"] }]
  });
  if (output === "" || output === null) {
    message("No file saved selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const result: string = await invoke("traverse", {
      folderPath: folderPath.value,
      output: output
    });
    message(`${result}`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error", duration: 10000 });
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:align-right" />
        </div>
        <div class="cmd-header-text">
          <h1>Traverse</h1>
          <p>Traverse directories to collect filenames</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="p-3">
        <div class="cmd-file-selection-bar" @click="selectFolder()">
          <div class="cmd-file-selection-icon">
            <Icon icon="ri:folder-open-line" />
          </div>
          <div class="cmd-file-selection-text">
            <template v-if="folderPath">
              <span class="cmd-file-name">{{ folderPath.split(/[/\\]/).pop() }}</span>
              <span class="cmd-file-path">{{ folderPath }}</span>
            </template>
            <template v-else>
              <span class="cmd-file-prompt">Click to select a folder</span>
            </template>
          </div>
          <div class="flex items-center gap-2 ml-auto">
            <SiliconeButton @click.stop="traverseDirectory()" :loading="isLoading" size="small">
              Run
            </SiliconeButton>
          </div>
        </div>

        <div class="preview-formula mt-4">
          <span class="formula-label">Preview:</span>
          <span class="formula-item">TRAVERSE</span>
          <span class="formula-operator">@</span>
          <span class="formula-item">{{ folderPath ? "1" : "0" }}</span>
          <span class="formula-operator">folder</span>
          <span class="formula-operator">→</span>
          <span class="formula-item">xlsx</span>
        </div>
      </div>
    </el-scrollbar>
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
</style>
