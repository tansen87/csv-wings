<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { previewtNLines, viewOpenFile } from "@/utils/view";
import { useMarkdown, mdSkip } from "@/utils/markdown";
import { message } from "@/utils/message";

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (msg: string, type: string = 'info') => {
  emit('add-log', `[Skip] ${msg}`, type);
};

const path = ref("");
const skiprows = ref("1");
const [dialog, loading] = [ref(false), ref(false)];
const { dynamicHeight } = useDynamicHeight(82);
const { mdShow } = useMarkdown(mdSkip);

interface Line {
  number: number;
  content: string;
}
const lines = ref<Line[]>([]);

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    return;
  }

  try {
    const rawLines = await previewtNLines(path.value, 50);
    lines.value = rawLines.map((content, i) => ({
      number: i + 1,
      content
    }));
  } catch (e) {
    addLog(`Failed to load file: ${e}`, 'error');
  }
}

async function skipLines() {
  if (path.value === "") {
    message("CSV file not selected", { type: 'warning' });
    return;
  }

  try {
    loading.value = true;
    addLog('Starting skip process...', 'info');
    const rtime: string = await invoke("skip", {
      path: path.value,
      skiprows: skiprows.value
    });
    addLog(`Skip done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`Skip failed: ${e}`, 'error');
  }
  loading.value = false;
}

const lineNumberRef = ref<HTMLElement | null>(null);
const codeScrollbarRef = ref<any>(null);
let isSyncing = false;
const handleLineNumberScroll = () => {
  if (isSyncing || !codeScrollbarRef.value) return;
  isSyncing = true;

  const scrollTop = lineNumberRef.value?.scrollTop ?? 0;

  if (codeScrollbarRef.value.wrapRef) {
    codeScrollbarRef.value.wrapRef.scrollTop = scrollTop;
  }

  requestAnimationFrame(() => {
    isSyncing = false;
  });
};
const handleCodeScroll = (event: any) => {
  if (isSyncing || !lineNumberRef.value) return;
  isSyncing = true;

  const scrollTop =
    event?.scrollTop ?? codeScrollbarRef.value?.wrapRef?.scrollTop ?? 0;

  lineNumberRef.value.scrollTop = scrollTop;

  requestAnimationFrame(() => {
    isSyncing = false;
  });
};

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [lines].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="p-3">
      <div class="header-content">
        <div class="header-icon" @click="dialog = true">
          <Icon icon="ri:skip-up-line" />
        </div>
        <div class="header-text">
          <h1>Skip</h1>
          <p>Skip lines from CSV</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="skip-main">
        <div class="p-3">
          <div class="file-selection-bar" @click="selectFile()">
            <div class="file-selection-icon">
              <Icon icon="ri:folder-open-line" />
            </div>
            <div class="file-selection-text">
              <template v-if="path">
                <span class="file-name">{{ path.split(/[/\\]/).pop() }}</span>
                <span class="file-path">{{ path }}</span>
              </template>
              <template v-else>
                <span class="file-prompt">Click to select a CSV file</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="skipLines()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="options-grid mt-4 mb-4">
            <div class="option-section">
              <div class="option-label">SKIP LINES</div>
              <SiliconeInput v-model="skiprows" placeholder="e.g. 10" clearable class="w-full" />
            </div>
          </div>

          <div class="preview-header">
            <span class="preview-title">PREVIEW ({{ lines?.length || 0 }} lines)</span>
            <span class="mode-badge">Skip: {{ skiprows }} lines</span>
          </div>
          <div class="content-wrapper flex-1 min-h-0 relative w-full flex overflow-hidden h-[350px]">
            <div class="line-number-wrapper" ref="lineNumberRef" @scroll="handleLineNumberScroll">
              <div class="line-number-container">
                <div v-for="line in lines" :key="line.number" class="line-number-row">
                  <span class="line-number">
                    {{ line.number }}
                  </span>
                </div>
              </div>
            </div>

            <el-scrollbar ref="codeScrollbarRef" class="code-content-wrapper" @scroll="handleCodeScroll">
              <div class="content-area">
                <div v-for="line in lines" :key="line.number" class="line-row" :data-line-number="line.number">
                  <span class="line-content">{{ line.content }}</span>
                </div>
              </div>
            </el-scrollbar>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <SiliconeDialog v-model="dialog" title="Skip - Skip lines from CSV" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
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

.skip-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  border-color: #409eff;
  background: linear-gradient(145deg, #f0f8ff, #e6f2ff);
}

.dark .file-selection-bar {
  background: linear-gradient(145deg, #2a2a2a, #222);
  border-color: #444;
}

.dark .file-selection-bar:hover {
  border-color: #409eff;
  background: linear-gradient(145deg, #1e2a3a, #1a2535);
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

.options-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.option-section {
  display: flex;
  flex-direction: column;
}

.option-label {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: #666;
}

.dark .preview-title {
  color: #999;
}

.mode-badge {
  font-size: 12px;
  color: #666;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
}

.dark .mode-badge {
  color: #999;
  background: rgba(255, 255, 255, 0.05);
}

.content-area {
  min-width: 100%;
  width: max-content;
}

.content-wrapper {
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
  border-radius: 12px;
}

.line-number-wrapper {
  flex-shrink: 0;
  width: 30px;
  overflow-y: auto;
  overflow-x: hidden;
  background: #fafafa;
  border-right: 1px solid #e4e7ed;
  z-index: 10;
  scrollbar-width: none;
}

.dark .line-number-wrapper {
  background: #252525;
  border-right: 1px solid #404040;
}

.line-number-container {
  width: 100%;
}

.line-number-row {
  display: flex;
  height: 24px;
  line-height: 24px;
  white-space: pre;
}

.line-number {
  width: 100%;
  text-align: right;
  padding-right: 12px;
  color: #909399;
  user-select: none;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  font-size: 14px;
}

.dark .line-number {
  color: #6b6b6b;
}

.code-content-wrapper {
  flex: 1;
  height: 100%;
  overflow: hidden;
  background: #fff;
}

.dark .code-content-wrapper {
  background: #1e1e1e;
}

.line-row {
  display: flex;
  height: 24px;
  line-height: 24px;
  white-space: pre;
  cursor: text;
}

.line-row:hover {
  background: #f5f7fa;
}

.dark .line-row:hover {
  background: #3d3d3d;
}

.line-content {
  flex: 1;
  margin-left: 8px;
  cursor: text;
  user-select: text;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  font-size: 14px;
  color: #303133;
}

.dark .line-content {
  color: #e0e0e0;
}
</style>