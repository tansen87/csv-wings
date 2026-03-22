<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useDynamicHeight } from "@/utils/utils";
import { message } from "@/utils/message";
import { previewtNLines, viewOpenFile } from "@/utils/view";
import { useMarkdown, mdSkip } from "@/utils/markdown";
import { useShortcuts } from "@/utils/globalShortcut";

const path = ref("");
const skiprows = ref("1");
const [dialog, isLoading] = [ref(false), ref(false)];
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
    console.log(lines.value);
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
}

// invoke skip
async function skipLines() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const rtime: string = await invoke("skip", {
      path: path.value,
      skiprows: skiprows.value
    });
    message(`Skip done, elapsed time: ${rtime} s`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error", duration: 10000 });
  }
  isLoading.value = false;
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

useShortcuts({
  onOpenFile: () => selectFile(),
  onRun: () => skipLines(),
  onHelp: () => {
    dialog.value = !dialog.value;
  }
});

onUnmounted(() => {
  [path].forEach(r => (r.value = ""));
  [lines].forEach(r => (r.value = []));
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
          Skip lines from CSV
        </div>
      </div>

      <div class="flex items-center">
        <SiliconeButton @click="selectFile()" :loading="isLoading" text>
          Open File
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
            SKIP LINES
          </label>
          <SiliconeInput v-model="skiprows" placeholder="e.g. 10" clearable />
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
              file
            </div>
          </div>
        </div>
      </aside>

      <div
        class="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden"
      >
        <div
          v-if="path"
          class="px-2 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        >
          <SiliconeText :max-lines="1">{{ path }}</SiliconeText>
        </div>

        <div
          class="content-wrapper flex-1 min-h-0 relative w-full flex overflow-hidden"
        >
          <div
            class="line-number-wrapper"
            ref="lineNumberRef"
            @scroll="handleLineNumberScroll"
          >
            <div class="line-number-container">
              <div
                v-for="line in lines"
                :key="line.number"
                class="line-number-row"
              >
                <span class="line-number">
                  {{ line.number }}
                </span>
              </div>
            </div>
          </div>

          <el-scrollbar
            ref="codeScrollbarRef"
            class="code-content-wrapper"
            @scroll="handleCodeScroll"
          >
            <div class="content-area">
              <div
                v-for="line in lines"
                :key="line.number"
                class="line-row"
                :data-line-number="line.number"
              >
                <span class="line-content">{{ line.content }}</span>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </div>
    </main>

    <SiliconeDialog
      v-model="dialog"
      title="Skip - Skip lines from CSV"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>

<style lang="css">
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
