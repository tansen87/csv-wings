<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { ElMessageBox } from "element-plus";
import ReplaceDialog from "./replaceDialog.vue";
import FindDialog from "./findDialog.vue";
import GotoDialog from "@/views/text/gotoDialog.vue";
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
import { useEncoding } from "@/store/modules/options";
import { invoke } from "@tauri-apps/api/core";

const fileInfo = ref<FileInfo | null>(null);
const searchQuery = ref("");
const searchType = ref<"visible" | "all">("visible");
const searchResults = ref<SearchMatch[]>([]);
const totalMatches = ref(0);
const currentLine = ref(0);
// 内容显示行数
const VISIBLE_LINE_COUNT = 500;
const visibleLines = ref([]);

const caseSensitive = ref(false);
const useRegex = ref(false);
const isReplace = ref(false);
const isSearch = ref(false);
const showReplaceDialog = ref(false);
const showFindDialog = ref(false);
const showGotoDialog = ref(false);

const encoding = useEncoding();

// 打开文件
async function openFileDialog() {
  try {
    const path = await open({
      filters: [{ name: "Text", extensions: ["*"] }]
    });
    if (path) {
      fileInfo.value = await openFile({
        path: path as string,
        encoding: encoding.encoding || undefined
      });
      await loadLines(0, VISIBLE_LINE_COUNT);
      message(`文件已加载`, { type: "success" });
    }
  } catch (error: any) {
    message(`打开文件失败: ${error}`, { type: "error" });
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

function doSearch(type: "visible" | "all") {
  searchType.value = type;
  if (type === "visible") {
    // 前端匹配visibleLines
    matchVisibleLines();
  } else {
    // 后端搜索整个文件
    searchAllFile();
  }
}

// 对visibleLines进行查找
function matchVisibleLines() {
  if (!searchQuery.value.trim()) {
    clearSearchResults(); // 查找为空时自动清理
    return;
  }
  searchType.value = "visible";
  const matches: SearchMatch[] = [];
  let regex: RegExp | null = null;

  try {
    if (useRegex.value) {
      const flags = "g" + (caseSensitive.value ? "" : "i");
      regex = new RegExp(searchQuery.value, flags);
    } else {
      const escaped = escapeRegExp(searchQuery.value);
      const flags = "g" + (caseSensitive.value ? "" : "i");
      regex = new RegExp(escaped, flags);
    }
  } catch (e) {
    message(`正则表达式无效: ${e}`, { type: "error" });
    return;
  }

  for (const line of visibleLines.value) {
    const content = line.content;
    let match;
    regex.lastIndex = 0;

    while ((match = regex.exec(content)) !== null) {
      matches.push({
        line_number: line.number,
        line_content: content,
        match_start: match.index,
        match_length: match[0].length,
        byte_offset: 0
      });
    }
  }

  // 更新结果
  searchResults.value = matches;
  totalMatches.value = matches.length;

  if (matches.length > 0) {
    message(`当前视图找到 ${matches.length} 个匹配项`, { type: "success" });
  } else {
    message("当前视图未找到匹配内容");
  }
}

// 搜索整个文件
async function searchAllFile() {
  if (!fileInfo.value) {
    message("请先打开文件", { type: "warning" });
    return;
  }

  try {
    isSearch.value = true;
    searchResults.value = [];

    const result = await searchFile({
      path: fileInfo.value.path,
      query: searchQuery.value,
      case_sensitive: caseSensitive.value,
      use_regex: useRegex.value,
      page: 1,
      page_size: VISIBLE_LINE_COUNT
    });

    searchResults.value = result.matches;
    totalMatches.value = result.total_matches;

    if (result.total_matches > 0) {
      message(`全文件找到 ${result.total_matches} 个匹配项`, {
        type: "success"
      });
    } else {
      message("全文件未找到匹配内容");
    }
  } catch (err) {
    message(`Search failed: ${err}`, { type: "error" });
  } finally {
    isSearch.value = false;
  }
}

// 高亮匹配文本
function highlightMatch(content: string) {
  if (!searchQuery.value) return content;
  try {
    let regex: RegExp;
    if (useRegex.value) {
      // 用户输入就是正则,加上全局和大小写标志
      const flags = "g" + (caseSensitive.value ? "" : "i");
      regex = new RegExp(`(${searchQuery.value})`, flags);
    } else {
      // 普通文本搜索,转义
      const escaped = escapeRegExp(searchQuery.value);
      const flags = "g" + (caseSensitive.value ? "" : "i");
      regex = new RegExp(`(${escaped})`, flags);
    }
    return content.replace(regex, "<mark>$1</mark>");
  } catch (e) {
    // 正则无效时,回退到普通文本高亮 or 不高亮
    console.warn("Invalid regex:", e);
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
  showGotoDialog.value = !showGotoDialog.value;
}

// 跳转到指定行
async function goToLine(lineNumber: number) {
  if (!fileInfo.value) return;

  const clampedLine = Math.max(
    1,
    Math.min(lineNumber, fileInfo.value.line_count)
  );

  currentLine.value = clampedLine - 1;

  await loadLines(clampedLine - 1, VISIBLE_LINE_COUNT);

  // 加载新行后重新匹配
  if (searchQuery.value.trim()) {
    matchVisibleLines();
  }
}

async function handleGotoLine(lineNumber: number) {
  if (!fileInfo.value) return;

  const clampedLine = Math.max(
    1,
    Math.min(lineNumber, fileInfo.value.line_count)
  );

  currentLine.value = clampedLine - 1;

  // 等待loadLines完成
  await loadLines(clampedLine - 1, VISIBLE_LINE_COUNT);

  if (searchQuery.value.trim()) {
    matchVisibleLines();
  }

  message(`已跳转到第 ${clampedLine} 行`, { type: "success" });
}

// 快捷键处理
function handleGlobalKeydown(e: KeyboardEvent) {
  // 排除输入框中触发
  const target = e.target as HTMLElement;
  const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
  if (isInput) return;
  // Ctrl+F - 查找
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && !e.shiftKey) {
    e.preventDefault();
    showFindDialog.value = !showFindDialog.value;
  }
  // Ctrl+H - 替换
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h" && !e.shiftKey) {
    e.preventDefault();
    showReplaceDialog.value = !showReplaceDialog.value;
  }
  // Ctrl+G - 跳转
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

    isReplace.value = true;

    const count = await replaceText({
      path: fileInfo.value.path,
      search_query: params.search,
      replace_text: params.replace,
      replace_all: params.replaceAll,
      case_sensitive: params.caseSensitive,
      encoding: fileInfo.value.encoding
    });

    message(`替换完成: ${count} 处`, { type: "success" });

    // 清除Rust缓存并重新加载
    await closeFile(fileInfo.value.path);

    fileInfo.value = await openFile({
      path: fileInfo.value.path,
      encoding: encoding.encoding || undefined
    });

    await loadLines(currentLine.value, VISIBLE_LINE_COUNT);
    if (searchQuery.value === params.search) {
      searchType.value = "visible";
      doSearch(searchType.value); // 刷新高亮
    }
  } catch (err) {
    message(`replace falied: ${err}`, { type: "error" });
  } finally {
    isReplace.value = false;
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

// 清理搜索结果
function clearSearchResults() {
  searchResults.value = [];
  totalMatches.value = 0;
  message("已清除搜索结果");
}

// 清理后端所有 Session
async function cleanupSessions() {
  try {
    const count = await invoke<number>("cleanup_sessions");
    message(`Cleared ${count} Session`);
  } catch (err) {
    message(`清理Session失败: ${err}`, { type: "warning" });
  }
}

// 清理前端数据
function cleanupFrontend() {
  fileInfo.value = null;
  searchQuery.value = "";
  searchResults.value = [];
  totalMatches.value = 0;
  visibleLines.value = [];
  currentLine.value = 0;
}

// 完整清理
async function cleanup() {
  if (fileInfo.value) {
    try {
      await closeFile(fileInfo.value.path);
    } catch (err) {
      message(`关闭文件失败: ${err}`, { type: "warning" });
    }
  }
  cleanupFrontend();
}

onMounted(async () => {
  await cleanupSessions();
  window.addEventListener("keydown", handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
  cleanup();
});
</script>

<template>
  <div class="file-viewer">
    <SiliconeCard shadow="never">
      <div class="flex items-center ml-1 mb-1 mt-1">
        <SiliconeButton @click="openFileDialog" text> 打开文件 </SiliconeButton>

        <div class="flex-grow" />

        <SiliconeButton
          type="success"
          @click="showFindDialog = true"
          :loading="isSearch"
          text
        >
          查找
        </SiliconeButton>

        <SiliconeButton
          type="warning"
          @click="showReplaceDialog = true"
          :loading="isReplace"
          text
        >
          替换
        </SiliconeButton>

        <SiliconeButton @click="promptGoToLine" class="mr-1" text>
          跳转
        </SiliconeButton>
      </div>
    </SiliconeCard>

    <SiliconeCard v-if="fileInfo" shadow="never">
      <div class="flex items-center gap-2">
        <SiliconeText class="file-path">
          {{ fileInfo.path }}
        </SiliconeText>
        <SiliconeTag v-if="fileInfo" type="info">
          {{ fileInfo.encoding }}
        </SiliconeTag>
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
      description="Large Text View"
      :image-size="200"
    />

    <!-- 内容显示区 -->
    <div v-else class="content-wrapper">
      <el-scrollbar>
        <div class="content-area">
          <div
            v-for="line in visibleLines"
            :key="line.number"
            class="line"
            :class="{ match: isMatchLine(line.number) }"
          >
            <span class="line-number">{{ line.number }}</span>
            <span class="line-content" v-html="highlightMatch(line.content)" />
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 查找结果面板 -->
    <SiliconeCard v-if="searchResults.length" shadow="never">
      <div class="flex gap-3 ml-2 mt-2 mb-2">
        <SiliconeTag :type="searchType === 'visible' ? 'success' : 'primary'">
          {{ totalMatches }} matches
          {{ searchType === "visible" ? "(Current View)" : "(All file)" }}
        </SiliconeTag>
        <SiliconeButton size="small" @click="clearSearchResults" text>
          Clear
        </SiliconeButton>
      </div>

      <SiliconeTable
        :data="searchResults"
        max-height="200"
        class="ml-2 mr-2 mb-2"
        :style="{ width: 'calc(100% - 16px)' }"
      >
        <el-table-column prop="line_number" label="Line" width="80" />
        <el-table-column prop="match_start" label="Column" width="80" />
        <el-table-column prop="line_content" label="Content">
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

    <FindDialog
      v-model="showFindDialog"
      :search-query="searchQuery"
      :case-sensitive="caseSensitive"
      :use-regex="useRegex"
      :loading="isSearch"
      @update:search-query="searchQuery = $event"
      @update:case-sensitive="caseSensitive = $event"
      @update:use-regex="useRegex = $event"
      @confirm="doSearch"
    />

    <ReplaceDialog
      v-model="showReplaceDialog"
      :search-query="searchQuery"
      @replace="handleReplace"
      :loading="isReplace"
    />

    <GotoDialog
      v-model="showGotoDialog"
      :total-lines="fileInfo?.line_count"
      @go-to="handleGotoLine"
    />
  </div>
</template>

<style scoped>
:deep(.el-card__body) {
  padding: 0 !important;
}

.file-viewer {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 36px);
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
