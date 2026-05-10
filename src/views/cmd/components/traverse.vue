<script setup lang="ts">
import { ref } from "vue";
import { open, save } from "@tauri-apps/plugin-dialog";
import { appConfigDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import { message } from "@/utils/message";

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
      <div class="header-content">
        <div class="header-icon" @click="dialog = true">
          <Icon icon="ri:align-right" />
        </div>
        <div class="header-text">
          <h1>Traverse</h1>
          <p>Traverse directories to collect filenames</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="p-3">
        <div class="file-selection-bar" @click="selectFolder()">
          <div class="file-selection-icon">
            <Icon icon="ri:folder-open-line" />
          </div>
          <div class="file-selection-text">
            <template v-if="folderPath">
              <span class="file-name">{{ folderPath.split(/[/\\]/).pop() }}</span>
              <span class="file-path">{{ folderPath }}</span>
            </template>
            <template v-else>
              <span class="file-prompt">Click to select a folder</span>
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
.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #409eff, #66b1ff);
  border-radius: 12px;
  font-size: 24px;
  color: white;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
  cursor: pointer;
}

.header-text h1 {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  margin: 0 0 4px 0;
}

.dark .header-text h1 {
  color: #e8e8e8;
}

.header-text p {
  font-size: 13px;
  color: #888;
  margin: 0;
}

.dark .header-text p {
  color: #999;
}

.file-selection-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(145deg, #f8f8f8, #f0f0f0);
  border: 2px dashed #ddd;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.file-selection-bar:hover {
  border-color: #f59e0b;
  background: linear-gradient(145deg, #fffbeb, #fef3c7);
}

.dark .file-selection-bar {
  background: linear-gradient(145deg, #2a2a2a, #222);
  border-color: #444;
}

.dark .file-selection-bar:hover {
  border-color: #f59e0b;
  background: linear-gradient(145deg, #451a03, #3d2a0a);
}

.file-selection-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #e8e8e8, #d8d8d8);
  border-radius: 10px;
  font-size: 20px;
  color: #666;
  flex-shrink: 0;
}

.dark .file-selection-icon {
  background: linear-gradient(145deg, #3a3a3a, #2d2d2d);
  color: #777;
}

.file-selection-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  flex: 1;
}

.file-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.dark .file-name {
  color: #e0e0e0;
}

.file-path {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-prompt {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.dark .file-prompt {
  color: #aaa;
}

.option-section {
  display: flex;
  flex-direction: column;
}

.option-section.full-width {
  grid-column: 1 / -1;
}

.preview-formula {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(145deg, #fffbeb, #fef3c7);
  border-radius: 8px;
  flex-wrap: wrap;
}

.dark .preview-formula {
  background: linear-gradient(145deg, #451a03, #3d2a0a);
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
  color: #f59e0b;
  font-weight: 600;
}

.dark .formula-item {
  background: #2a2a2a;
  color: #fbbf24;
}

.formula-operator {
  color: #888;
  font-size: 12px;
}

.dark .formula-operator {
  color: #999;
}
</style>
