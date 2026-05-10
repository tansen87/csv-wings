<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { previewtNLines, viewOpenFile } from "@/utils/view";
import { useMarkdown, mdSkip } from "@/utils/markdown";
import { message } from "@/utils/message"
import "./common.css";

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
      <div class="cmd-header-content">
        <div class="cmd-header-icon" @click="dialog = true">
          <Icon icon="ri:skip-up-line" />
        </div>
        <div class="cmd-header-text">
          <h1>Skip</h1>
          <p>Skip lines from CSV</p>
        </div>
      </div>
    </div>

    <el-scrollbar class="flex-1 min-h-0">
      <div class="cmd-main">
        <div class="p-3">
          <div class="cmd-file-selection-bar" @click="selectFile()">
            <div class="cmd-file-selection-icon">
              <Icon icon="ri:folder-open-line" />
            </div>
            <div class="cmd-file-selection-text">
              <template v-if="path">
                <span class="cmd-file-name">{{ path.split(/[/\\]/).pop() }}</span>
                <span class="cmd-file-path">{{ path }}</span>
              </template>
              <template v-else>
                <span class="cmd-file-prompt">Click to select a CSV file</span>
              </template>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <SiliconeButton @click.stop="skipLines()" :loading="loading" size="small">
                Run
              </SiliconeButton>
            </div>
          </div>

          <div class="cmd-options-grid mt-4 mb-4">
            <div class="cmd-option-section">
              <div class="cmd-option-label">SKIP LINES</div>
              <SiliconeInput v-model="skiprows" placeholder="e.g. 10" clearable class="w-full" />
            </div>
          </div>

          <div class="cmd-preview-header">
            <span class="cmd-preview-title">PREVIEW ({{ lines?.length || 0 }} lines)</span>
            <span class="cmd-mode-badge">Skip: {{ skiprows }} lines</span>
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

.line-row {
  display: flex;
  height: 24px;
  line-height: 24px;
  white-space: pre;
  cursor: text;
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
</style>