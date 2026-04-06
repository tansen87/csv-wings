<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { previewtNLines, viewOpenFile } from "@/utils/view";
import { useMarkdown, mdSkip } from "@/utils/markdown";

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
    addLog('File selection cancelled', 'info');
    return;
  }
  addLog(`Selected file: ${path.value}`, 'info');

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

// invoke skip
async function skipLines() {
  if (path.value === "") {
    addLog("CSV file not selected", 'warning');
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

  // 设置el-scrollbar内部容器的滚动
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

  // 获取代码区域的滚动顶部距离
  const scrollTop =
    event?.scrollTop ?? codeScrollbarRef.value?.wrapRef?.scrollTop ?? 0;

  lineNumberRef.value.scrollTop = scrollTop;

  // 下一帧释放锁
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
    <SiliconeCard class="p-4 m-4 rounded-md flex-shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2" @click="dialog = true">
          <Icon icon="ri:skip-forward-line" />
          Skip
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400">
          Skip lines from CSV
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
              <SiliconeButton @click="selectFile()" size="small" text>
                <Icon icon="ri:folder-open-line" class="w-4 h-4" />
              </SiliconeButton>
              <SiliconeButton @click="skipLines()" :loading="loading" size="small" text>
                <Icon icon="ri:play-large-line" class="w-4 h-4" />
              </SiliconeButton>
            </div>
          </div>

          <div v-if="path" class="mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider mb-2">
              SELECTED FILE
            </div>
            <SiliconeText :max-lines="1" class="mb-2">{{ path }}</SiliconeText>
          </div>

          <div class="mb-4">
            <label class="text-xs font-semibold text-gray-400 tracking-wider mb-2 block">
              SKIP LINES
            </label>
            <SiliconeInput v-model="skiprows" placeholder="e.g. 10" clearable class="w-full" />
            <p class="mt-1 text-[10px] text-gray-400">
              Skip this many rows from the beginning of each file
            </p>
          </div>

          <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div class="flex items-start gap-2">
              <Icon icon="ri:information-line" class="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div class="text-[12px] text-blue-700 dark:text-blue-300">
                Useful for skipping header rows or metadata at the start of CSV file
              </div>
            </div>
          </div>
        </SiliconeCard>

        <SiliconeCard>
          <div class="flex items-center justify-between mb-4">
            <div class="text-xs font-semibold text-gray-400 tracking-wider">
              PREVIEW
            </div>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded">
                <Icon icon="ri:skip-forward-line" class="w-3.5 h-3.5" />
                Skipping: {{ skiprows }} lines
              </span>
            </div>
          </div>
          <div class="content-wrapper flex-1 min-h-0 relative w-full flex overflow-hidden h-[400px]">
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
        </SiliconeCard>

        <SiliconeCard>
          <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
            USAGE
          </div>
          <div class="flex flex-col gap-2">
            <SiliconeText type="info">1. Click
              <Icon icon="ri:folder-open-line" class="w-4 h-4 inline align-middle" /> to select a CSV file
            </SiliconeText>
            <SiliconeText type="info">2. Enter the number of lines to skip</SiliconeText>
            <SiliconeText type="info">3. Review the preview to confirm which lines will be skipped</SiliconeText>
            <SiliconeText type="info">4. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to start the skip process
            </SiliconeText>
            <SiliconeText type="info">5. Check the output log for details</SiliconeText>
            <SiliconeText type="info">6. The output file will be created in the same directory as the original file
            </SiliconeText>
          </div>
        </SiliconeCard>
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
:deep(.silicone-card) {
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
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

:deep(.dark) .line-number-wrapper {
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

:deep(.dark) .line-number {
  color: #6b6b6b;
}

.code-content-wrapper {
  flex: 1;
  height: 100%;
  overflow: hidden;
  background: #fff;
}

:deep(.dark) .code-content-wrapper {
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

:deep(.dark) .line-row:hover {
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

:deep(.dark) .line-content {
  color: #e0e0e0;
}
</style>
