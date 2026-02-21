<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { ElMessageBox } from "element-plus";
import { Document, More } from "@element-plus/icons-vue";
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
  closeFile,
  cleanupSessions
} from "@/utils/textOperations";
import { useEncoding } from "@/store/modules/options";

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
    }
  } catch (error: any) {
    message(`fail to open file: ${error}`, { type: "error" });
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
    message(`matchVisibleLines failed: ${e}`, { type: "error" });
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

  if (matches.length < 1) {
    message("No matching content found");
  }
}

// 搜索整个文件
async function searchAllFile() {
  if (!fileInfo.value) return;

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

    if (result.total_matches < 1) {
      message("No matching content found");
    }
  } catch (e) {
    message(`searchAllFile failed: ${e}`, { type: "error" });
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
    // 正则无效时,不高亮
    message(`highlightMatch falied: ${e}`);
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
async function handleGotoLine(lineNumber: number) {
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

  message(`Jumped to line ${clampedLine}`, { type: "success" });
}

// 快捷键处理
function handleGlobalKeydown(e: KeyboardEvent) {
  // 排除输入框中触发
  const target = e.target as HTMLElement;
  const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
  if (isInput) return;
  // Ctrl+O 打开文件
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o" && !e.shiftKey) {
    e.preventDefault();
    openFileDialog();
  }
  // Ctrl+F 查找
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && !e.shiftKey) {
    e.preventDefault();
    showFindDialog.value = !showFindDialog.value;
  }
  // Ctrl+H 替换
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h" && !e.shiftKey) {
    e.preventDefault();
    showReplaceDialog.value = !showReplaceDialog.value;
  }
  // Ctrl+G 跳转
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
      `Are you sure you want ${
        params.replaceAll ? "Replace All" : "Replace"
      }? This operation cannot be undone.`,
      "Confirm replacement",
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

    message(`Replacement completed: ${count}`, { type: "success" });

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
  } catch (e) {
    message(`replace falied: ${e}`, { type: "error" });
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
  searchQuery.value = "";
}
// 完整清理
async function cleanup() {
  if (fileInfo.value) {
    try {
      await closeFile(fileInfo.value.path);
    } catch (e) {
      message(`closeFile failed: ${e}`, { type: "warning" });
    }
  }
  fileInfo.value = null;
  searchQuery.value = "";
  searchResults.value = [];
  totalMatches.value = 0;
  visibleLines.value = [];
  currentLine.value = 0;
}
onMounted(async () => {
  try {
    await cleanupSessions();
  } catch (e) {
    message(`cleanupSessions failed: ${e}`, { type: "warning" });
  }
  window.addEventListener("keydown", handleGlobalKeydown);
});
onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
  cleanup();
});

// 单击行号选中整行
const lineRefs = ref<Record<number, HTMLElement>>({});
function selectLineContent(lineNumber: number) {
  setTimeout(() => {
    const lineElement = lineRefs.value[lineNumber];
    if (!lineElement) return;

    const contentSpan = lineElement.querySelector(".line-content");
    if (!contentSpan) return;

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(contentSpan);

    selection.removeAllRanges();
    selection.addRange(range);
  }, 0);
}
</script>

<template>
  <div class="file-viewer">
    <SiliconeCard v-if="fileInfo" shadow="never">
      <div class="flex items-center gap-2">
        <SiliconeTag type="info">
          {{ fileInfo.path }}
        </SiliconeTag>
        <SiliconeTag v-if="fileInfo" type="warning">
          {{ fileInfo.encoding }}
        </SiliconeTag>
        <SiliconeTag type="primary">
          {{ formatSize(fileInfo.size) }}
        </SiliconeTag>
        <SiliconeTag type="success">
          {{ fileInfo.line_count }} lines
        </SiliconeTag>
        <div class="flex-grow" />
        <SiliconeTooltip>
          <template #content>
            <div class="empty-desc">
              <div class="desc-row">
                <SiliconeTag type="info">Open File</SiliconeTag>
                <SiliconeTag size="small">Ctrl + O</SiliconeTag>
              </div>
              <div class="desc-row">
                <SiliconeTag type="info">Search</SiliconeTag>
                <SiliconeTag size="small">Ctrl + F</SiliconeTag>
              </div>
              <div class="desc-row">
                <SiliconeTag type="info">Replace</SiliconeTag>
                <SiliconeTag>Ctrl + H</SiliconeTag>
              </div>
              <div class="desc-row">
                <SiliconeTag type="info">Jump</SiliconeTag>
                <SiliconeTag>Ctrl + G</SiliconeTag>
              </div>
            </div>
          </template>
          <SiliconeTag type="danger">
            <el-icon><More /></el-icon>
          </SiliconeTag>
        </SiliconeTooltip>
      </div>
    </SiliconeCard>

    <el-empty v-if="!fileInfo" :image-size="200">
      <template #image>
        <el-icon :size="200" color="#909399">
          <Document />
        </el-icon>
      </template>
      <template #description>
        <div class="empty-desc">
          <div class="desc-row">
            <SiliconeTag type="success" @click="openFileDialog">
              Open File
            </SiliconeTag>
            <SiliconeTag>Ctrl + O</SiliconeTag>
          </div>
          <div class="desc-row">
            <SiliconeTag type="info">Search</SiliconeTag>
            <SiliconeTag>Ctrl + F</SiliconeTag>
          </div>
          <div class="desc-row">
            <SiliconeTag type="info">Replace</SiliconeTag>
            <SiliconeTag>Ctrl + H</SiliconeTag>
          </div>
          <div class="desc-row">
            <SiliconeTag type="info">Jump</SiliconeTag>
            <SiliconeTag>Ctrl + G</SiliconeTag>
          </div>
        </div>
      </template>
    </el-empty>

    <!-- 内容显示区 -->
    <div v-else class="content-wrapper">
      <el-scrollbar>
        <div class="content-area">
          <div
            v-for="line in visibleLines"
            :key="line.number"
            class="line"
            :class="{ match: isMatchLine(line.number) }"
            :ref="(el) => { if (el) lineRefs[line.number] = el as HTMLElement }"
          >
            <span class="line-number" @click="selectLineContent(line.number)">
              {{ line.number }}
            </span>
            <span class="line-content" v-html="highlightMatch(line.content)" />
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 查找结果面板 -->
    <SiliconeCard v-if="searchResults.length" shadow="never">
      <div class="flex gap-3 ml-1 mt-1 mb-2 mr-1">
        <SiliconeTag :type="searchType === 'visible' ? 'success' : 'primary'">
          {{ totalMatches }} matches
          {{ searchType === "visible" ? "(Current View)" : "(All File)" }}
        </SiliconeTag>
        <div class="flex-grow" />
        <SiliconeButton
          size="small"
          type="warning"
          @click="clearSearchResults"
          text
        >
          Clear
        </SiliconeButton>
      </div>

      <SiliconeTable
        :data="searchResults"
        max-height="200"
        class="ml-1 mb-1"
        :style="{ width: 'calc(100% - 8px)' }"
      >
        <el-table-column prop="line_number" label="Line" width="80" />
        <el-table-column prop="match_start" label="Column" width="80" />
        <el-table-column prop="line_content" label="Content">
          <template #default="{ row }">
            <span
              class="search-line-content"
              @click="handleGotoLine(row.line_number)"
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
  user-select: none;
}
.dark .file-viewer {
  background: #1a1a1a;
}

.content-wrapper {
  flex: 1;
  overflow: hidden;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}
.dark .content-wrapper {
  background: #2d2d2d;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.3);
}

.content-area {
  height: 100%;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  font-size: 14px;
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
  overflow: hidden;
  cursor: text;
  user-select: text;
  margin-left: 8px;
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

.empty-desc {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: center;
}
.desc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
</style>
