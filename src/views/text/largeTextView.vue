<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { ElMessageBox } from "element-plus";
import ReplaceDialog from "./replaceDialog.vue";
import { message } from "@/utils/message";
import {
  openFile,
  getFileContent,
  searchFile,
  replaceText,
  type FileInfo,
  type SearchMatch,
  closeFile
} from "@/utils/textOperations";

const fileInfo = ref<FileInfo | null>(null);
const visibleLines = ref<{ number: number; content: string }[]>([]);
const searchQuery = ref("");
const caseSensitive = ref(false);
const searchResults = ref<SearchMatch[]>([]);
const totalMatches = ref(0);
const showReplaceDialog = ref(false);
const currentLine = ref(0);
const isLoading = ref(false);
const VISIBLE_LINE_COUNT = 50;
const selectedEncoding = ref("UTF-8");
const ENCODING_OPTIONS = [
  { label: "UTF-8", value: "UTF-8" },
  { label: "UTF-16LE", value: "UTF-16LE" },
  { label: "UTF-16BE", value: "UTF-16BE" },
  { label: "GBK", value: "GBK" },
  { label: "Windows-1252", value: "Windows-1252" }
];

// 总高度用于虚拟滚动
const totalHeight = computed(() => {
  if (!fileInfo.value) return 0;
  return fileInfo.value.line_count * 20;
});

// 打开文件
async function openFileDialog() {
  try {
    const path = await open({
      filters: [{ name: "Text", extensions: ["*"] }]
    });
    if (path) {
      isLoading.value = true;
      // 注意: params需要作为对象传递
      fileInfo.value = await openFile({
        path: path as string,
        encoding: selectedEncoding.value || undefined
      });
      await loadLines(0, VISIBLE_LINE_COUNT);
      message(`文件已加载`, { type: "success" });
    }
  } catch (error: any) {
    message(`打开文件失败：${error}`, { type: "error" });
  } finally {
    isLoading.value = false;
  }
}

async function loadLines(start: number, count: number) {
  if (!fileInfo.value) return;
  const lines = await getFileContent({
    path: fileInfo.value.path,
    start_line: start,
    end_line: start + count,
    encoding: undefined
  });
  visibleLines.value = lines.map((content, i) => ({
    number: start + i + 1,
    content
  }));
}

// 滚动处理
function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  const scrollTop = target.scrollTop;
  const lineHeight = 20;
  const newStartLine = Math.floor(scrollTop / lineHeight);

  if (Math.abs(newStartLine - currentLine.value) > 10) {
    currentLine.value = newStartLine;
    loadLines(newStartLine, VISIBLE_LINE_COUNT);
  }
}

// 搜索
async function doSearch() {
  if (!fileInfo.value) {
    message("请先打开文件", { type: "warning" });
    return;
  }
  if (!searchQuery.value.trim()) {
    message("请输入搜索内容", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const result = await searchFile({
      path: fileInfo.value.path,
      query: searchQuery.value,
      case_sensitive: caseSensitive.value,
      use_regex: false,
      page: 1,
      page_size: 50
    });

    searchResults.value = result.matches;
    totalMatches.value = result.total_matches;

    if (result.total_matches > 0) {
      message(`找到 ${result.total_matches} 个匹配项`, { type: "success" });
    } else {
      message("未找到匹配内容");
    }
  } catch (err) {
    message(`Search failed: ${err}`, { type: "error" });
  } finally {
    isLoading.value = false;
  }
}

// 高亮匹配文本
function highlightMatch(content: string) {
  if (!searchQuery.value) return content;
  try {
    const regex = new RegExp(
      `(${escapeRegExp(searchQuery.value)})`,
      caseSensitive.value ? "g" : "gi"
    );
    return content.replace(regex, "<mark>$1</mark>");
  } catch {
    return content;
  }
}

// 转义正则特殊字符
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 判断是否为匹配行
function isMatchLine(lineNumber: number) {
  return searchResults.value.some(m => m.line_number === lineNumber);
}

async function promptGoToLine() {
  if (!fileInfo.value) {
    message("请先打开文件", { type: "warning" });
    return;
  }

  try {
    const lineCount = fileInfo.value.line_count - 1;
    const lineStr = await ElMessageBox.prompt(
      "请输入行号(1-" + lineCount + ")",
      "跳转到行",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        inputPattern: /^\d+$/,
        inputErrorMessage: "请输入有效的行号"
      }
    );

    const lineNumber = parseInt(lineStr.value, 10);
    if (lineNumber < 1 || lineNumber > lineCount) {
      message(`行号超出范围(1~${lineCount})`, {
        type: "warning"
      });
      return;
    }

    goToLine(lineNumber);
  } catch (err) {
    return;
  }
}

// 监听全局快捷键
function handleGlobalKeydown(e: KeyboardEvent) {
  // Ctrl+G 或 Cmd+G(macOS)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g" && !e.shiftKey) {
    e.preventDefault();
    promptGoToLine();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
  if (fileInfo.value) {
    loadLines(0, VISIBLE_LINE_COUNT);
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
});

// 跳转到指定行
function goToLine(lineNumber: number) {
  if (!fileInfo.value) return;

  // 边界保护
  const clampedLine = Math.max(
    1,
    Math.min(lineNumber, fileInfo.value.line_count)
  );

  const contentArea = document.querySelector(".content-area") as HTMLElement;
  if (contentArea) {
    contentArea.scrollTop = (clampedLine - 1) * 20;
    currentLine.value = clampedLine - 1;
    loadLines(clampedLine - 1, VISIBLE_LINE_COUNT);
  }
}

// 处理替换
async function handleReplace(params: {
  search: string;
  replace: string;
  replaceAll: boolean;
  caseSensitive: boolean;
}) {
  if (!fileInfo.value) return;

  try {
    await ElMessageBox.confirm(
      `确定要${params.replaceAll ? "替换全部" : "替换"}匹配项?此操作不可撤销.`,
      "确认替换",
      { type: "warning" }
    );

    isLoading.value = true;

    const count = await replaceText({
      path: fileInfo.value.path,
      search_query: params.search,
      replace_text: params.replace,
      replace_all: params.replaceAll,
      case_sensitive: params.caseSensitive,
      encoding: fileInfo.value.encoding
    });

    message(`替换完成：${count} 处`, { type: "success" });

    // 清除Rust缓存并重新加载
    await closeFile(fileInfo.value.path);

    fileInfo.value = await openFile({
      path: fileInfo.value.path,
      encoding: selectedEncoding.value || undefined
    });

    await loadLines(currentLine.value, VISIBLE_LINE_COUNT);
    if (searchQuery.value === params.search) {
      doSearch(); // 刷新高亮
    }
  } catch (err) {
    message(`replace falied: ${err}`, { type: "error" });
  } finally {
    isLoading.value = false;
  }
}

// 格式化文件大小
function formatSize(bytes: number) {
  if (bytes > 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}
</script>

<template>
  <div class="file-viewer">
    <SiliconeCard shadow="never">
      <div class="flex items-center gap-2 flex-wrap ml-2 mb-2 mt-2">
        <SiliconeButton @click="openFileDialog" :loading="isLoading" text>
          打开文件
        </SiliconeButton>

        <SiliconeSelect v-model="selectedEncoding" style="width: 150px">
          <el-option
            v-for="item in ENCODING_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </SiliconeSelect>

        <SiliconeInput
          v-model="searchQuery"
          placeholder="输入内容按(Enter)以搜索"
          style="width: 300px"
          clearable
          @keyup.enter="doSearch"
        />

        <el-checkbox v-model="caseSensitive">区分大小写</el-checkbox>

        <SiliconeButton
          type="success"
          @click="doSearch"
          :loading="isLoading"
          text
        >
          搜索
        </SiliconeButton>

        <SiliconeButton
          type="warning"
          @click="showReplaceDialog = true"
          :disabled="!fileInfo"
          text
        >
          替换
        </SiliconeButton>

        <SiliconeButton @click="promptGoToLine" type="primary" text>
          跳转(Ctrl+G)
        </SiliconeButton>

        <el-divider direction="vertical" />

        <SiliconeTag v-if="fileInfo" type="info">
          {{ fileInfo.encoding }}
        </SiliconeTag>
      </div>
    </SiliconeCard>

    <SiliconeCard v-if="fileInfo" shadow="never">
      <div class="flex items-center gap-2">
        <SiliconeText class="file-path">
          {{ fileInfo.path }}
        </SiliconeText>
        <SiliconeTag size="small" type="primary">
          {{ formatSize(fileInfo.size) }}
        </SiliconeTag>
        <SiliconeTag size="small" type="success">
          {{ fileInfo.line_count }} lines
        </SiliconeTag>
      </div>
    </SiliconeCard>

    <el-empty
      v-if="!fileInfo"
      description="Open the file to view"
      :image-size="200"
    />

    <!-- 内容显示区(虚拟滚动) -->
    <div v-else class="content-wrapper">
      <div class="content-area" @scroll="handleScroll">
        <div :style="{ height: totalHeight + 'px', position: 'relative' }">
          <div
            v-for="line in visibleLines"
            :key="line.number"
            class="line"
            :class="{ match: isMatchLine(line.number) }"
            :style="{
              position: 'absolute',
              top: (line.number - 1) * 20 + 'px'
            }"
          >
            <span class="line-number">{{ line.number }}</span>
            <span class="line-content" v-html="highlightMatch(line.content)" />
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索结果面板 -->
    <SiliconeCard v-if="searchResults.length" shadow="never">
      <div class="flex gap-3 ml-2 mt-2 mb-2">
        <SiliconeTag type="success">{{ totalMatches }} 个匹配</SiliconeTag>
        <SiliconeButton size="small" @click="searchResults = []" text>
          清空
        </SiliconeButton>
      </div>

      <SiliconeTable
        :data="searchResults"
        max-height="200"
        class="ml-2 mr-2 mb-2"
        :style="{ width: 'calc(100% - 16px)' }"
      >
        <el-table-column prop="line_number" label="行号" width="80" />
        <el-table-column prop="match_start" label="列号" width="80" />
        <el-table-column prop="line_content" label="内容">
          <template #default="{ row }">
            <span
              class="search-line-content"
              @click="goToLine(row.line_number)"
            >
              {{ row.line_content }}
            </span>
          </template>
        </el-table-column>
      </SiliconeTable>
    </SiliconeCard>

    <ReplaceDialog
      v-model="showReplaceDialog"
      :search-query="searchQuery"
      @replace="handleReplace"
    />

    <!-- 全局加载遮罩 -->
    <el-overlay :show="isLoading" />
  </div>
</template>

<style scoped>
:deep(.el-card__body) {
  padding: 0 !important;
}

.file-viewer {
  display: flex;
  flex-direction: column;
  height: 94vh;
  padding: 8px;
  gap: 8px;
  background: #f5f7fa;
}
.dark .file-viewer {
  background: #1a1a1a;
}

.file-path {
  max-width: 600px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dark .file-path {
  color: #e0e0e0;
}

.content-wrapper {
  flex: 1;
  overflow: hidden;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  height: calc(100% - 80px);
}
.dark .content-wrapper {
  background: #2d2d2d;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.3);
}

.content-area {
  height: 100%;
  overflow-y: auto;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 14px;
  line-height: 20px;
}
.dark .content-area {
  color: #e0e0e0;
  background: #1e1e1e;
}

.line {
  display: flex;
  width: 100%;
  white-space: pre;
  cursor: text;
}

.line:hover {
  background: #f5f7fa;
}
.dark .line:hover {
  background: #3d3d3d;
}

.line.match {
  background: #fff3cd;
}
.dark .line.match {
  background: #665c00;
}

.line-number {
  min-width: 60px;
  text-align: right;
  padding-right: 12px;
  color: #909399;
  user-select: none;
  background: #fafafa;
  border-right: 1px solid #e4e7ed;
}
.dark .line-number {
  color: #6b6b6b;
  background: #252525;
  border-right: 1px solid #404040;
}

.line-content {
  flex: 1;
  padding-left: 12px;
  overflow: hidden;
}

.search-line-content {
  cursor: pointer;
  color: #303133;
}

.search-line-content:hover {
  color: #409eff;
  text-decoration: underline;
}
.dark .search-line-content {
  color: #e0e0e0;
}

.dark .search-line-content:hover {
  color: #64b5f6;
}

mark {
  background: #ffeb3b;
  padding: 0 2px;
  border-radius: 2px;
}
.dark mark {
  background: #ff9800;
  color: #000;
}

:deep(.el-overlay) {
  background: rgba(255, 255, 255, 0.7);
}
.dark :deep(.el-overlay) {
  background: rgba(0, 0, 0, 0.7);
}

.dark .content-area::-webkit-scrollbar {
  width: 8px;
}

.dark .content-area::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.dark .content-area::-webkit-scrollbar-thumb {
  background: #404040;
  border-radius: 4px;
}

.dark .content-area::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
