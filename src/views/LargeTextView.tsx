import { useEffect, useRef, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  FolderOpen,
  Search,
  Edit3,
  ArrowRight,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLargeTextStore } from "@/store/largeTextStore";
import {
  openFile,
  getFileContent,
  searchFile,
  replaceText,
  // type FileInfo,
  type SearchMatch,
  closeFile,
  cleanupSessions,
} from "@/utils/textOperations";
import { message } from "@/utils/message";
import { viewOpenFile } from "@/utils/view";
import FindDialog from "@/components/FindDialog";
import ReplaceDialog from "@/components/ReplaceDialog";
import GotoDialog from "@/components/GotoDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VISIBLE_LINE_COUNT = 500;

const ENCODING_OPTIONS = [
  { label: "UTF-8", value: "UTF-8" },
  { label: "UTF-16LE", value: "UTF-16LE" },
  { label: "UTF-16BE", value: "UTF-16BE" },
  { label: "简体中文(GBK)", value: "GBK" },
  { label: "简体中文(GB18030)", value: "GB18030" },
  { label: "繁体中文(BIG5)", value: "BIG5" },
  { label: "中欧(Windows-1250)", value: "Windows-1250" },
  { label: "西里尔(Windows-1251)", value: "Windows-1251" },
  { label: "西欧(Windows-1252)", value: "Windows-1252" },
  { label: "希腊(Windows-1253)", value: "Windows-1253" },
  { label: "土耳其(Windows-1254)", value: "Windows-1254" },
  { label: "希伯来(Windows-1255)", value: "Windows-1255" },
  { label: "阿拉伯(Windows-1256)", value: "Windows-1256" },
  { label: "波罗的海(Windows-1257)", value: "Windows-1257" },
  { label: "越南(Windows-1258)", value: "Windows-1258" },
  { label: "泰文(Windows-874)", value: "Windows-874" },
  { label: "日文(Shift_JIS)", value: "Shift_JIS" },
  { label: "日文(EUC-JP)", value: "EUC-JP" },
  { label: "韩文(EUC-KR)", value: "EUC-KR" }
];

export default function LargeTextView() {
  const lineNumberRef = useRef<HTMLDivElement>(null);
  const codeScrollbarRef = useRef<HTMLDivElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [localShowEncodingDialog, setLocalShowEncodingDialog] = useState(false);
  const [localSelectedEncoding, setLocalSelectedEncoding] = useState<string | null>(null);
  const loadedStartLineRef = useRef(0);
  const hasMoreLinesRef = useRef(true);

  const {
    fileInfo,
    visibleLines,
    searchQuery,
    searchType,
    searchResults,
    totalMatches,
    currentLine,
    caseSensitive,
    useRegex,
    loading,
    showFindDialog,
    showReplaceDialog,
    showGotoDialog,
    selectedEncoding,
    setFileInfo,
    setSearchQuery,
    setSearchType,
    setSearchResults,
    setTotalMatches,
    setCurrentLine,
    setCaseSensitive,
    setUseRegex,
    setLoading,
    setShowFindDialog,
    setShowReplaceDialog,
    setShowGotoDialog,
    setIsLoadingLines,
    clearSearch,
    cleanup,
  } = useLargeTextStore();

  const loadLines = useCallback(
    async (start: number, count: number, append = false) => {
      const store = useLargeTextStore.getState();
      const currentFileInfo = store.fileInfo;
      if (!currentFileInfo) {
        return;
      }
      setIsLoadingLines(true);
      try {
        const lines = await getFileContent({
          path: currentFileInfo.path,
          start_line: start + 1,
          end_line: start + count + 1,
          encoding: selectedEncoding || currentFileInfo.encoding,
        });
        if (!lines) {
          throw new Error('getFileContent returned null or undefined');
        }
        const lineData = lines.map((content, i) => ({
          number: start + i + 1,
          content,
        }));
        if (append) {
                  useLargeTextStore.setState({ visibleLines: [...store.visibleLines, ...lineData] });
                } else {
                  useLargeTextStore.getState().setVisibleLines(lineData);
                }
        loadedStartLineRef.current = start;
        const nextStart = start + count;
        hasMoreLinesRef.current = nextStart < currentFileInfo.line_count;
      } catch (e) {
        console.error('loadLines error:', e);
        message(`Failed to load lines: ${e}`, { type: "error" });
      } finally {
        setIsLoadingLines(false);
      }
    },
    [setIsLoadingLines, selectedEncoding]
  );

  useEffect(() => {
    if (fileInfo) {
      loadLines(0, VISIBLE_LINE_COUNT, false);
    }
  }, [fileInfo]);

  const openFileDialog = async () => {
    try {
      const path = await viewOpenFile(false, "text", ["*"]);
      if (path) {
        const fileData = await openFile({
          path,
          encoding: selectedEncoding || undefined,
        });

        setFileInfo(fileData);
      }
    } catch (e) {
      message(`Failed to open file: ${e}`, { type: "error" });
    }
  };

  const loadFileFromPath = async (path: string) => {

    try {
      const win = getCurrentWindow();
      await win.show();
      await win.setFocus();

      const fileData = await openFile({
        path,
        encoding: selectedEncoding || undefined,
      });

      setFileInfo(fileData);
    } catch (e) {
      message(`Failed to open file: ${e}`, { type: "error" });
    }
  };

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const highlightMatch = (content: string) => {
    if (!searchQuery) return escapeHtml(content);
    try {
      let regex: RegExp;
      const escapedContent = escapeHtml(content);
      if (useRegex) {
        const flags = "g" + (caseSensitive ? "" : "i");
        regex = new RegExp(`(${searchQuery})`, flags);
      } else {
        const escaped = escapeRegExp(searchQuery);
        const flags = "g" + (caseSensitive ? "" : "i");
        regex = new RegExp(`(${escaped})`, flags);
      }
      return escapedContent.replace(regex, "<mark>$1</mark>");
    } catch (e) {
      return escapeHtml(content);
    }
  };

  const isMatchLine = (lineNumber: number) => {
    return searchResults.some((m) => m.line_number === lineNumber);
  };

  const matchVisibleLines = () => {
    if (!searchQuery.trim()) {
      clearSearch();
      return;
    }
    setSearchType("visible");
    const matches: SearchMatch[] = [];
    let regex: RegExp | null = null;

    try {
      if (useRegex) {
        const flags = "g" + (caseSensitive ? "" : "i");
        regex = new RegExp(searchQuery, flags);
      } else {
        const escaped = escapeRegExp(searchQuery);
        const flags = "g" + (caseSensitive ? "" : "i");
        regex = new RegExp(escaped, flags);
      }
    } catch (e) {
      message(`matchVisibleLines failed: ${e}`, { type: "error" });
      return;
    }

    for (const line of visibleLines) {
      const content = line.content;
      let match;
      regex.lastIndex = 0;

      while ((match = regex.exec(content)) !== null) {
        matches.push({
          line_number: line.number,
          line_content: content,
          match_start: match.index,
          match_length: match[0].length,
          byte_offset: 0,
        });
      }
    }

    setSearchResults(matches);
    setTotalMatches(matches.length);

    if (matches.length < 1) {
      message("No matching content found");
    }
  };

  const searchAllFile = async () => {
    if (!fileInfo) return;

    try {
      setLoading(true);
      setSearchResults([]);

      const result = await searchFile({
        path: fileInfo.path,
        query: searchQuery,
        case_sensitive: caseSensitive,
        use_regex: useRegex,
        page: 1,
        page_size: VISIBLE_LINE_COUNT,
      });

      setSearchResults(result.matches);
      setTotalMatches(result.total_matches);

      if (result.total_matches < 1) {
        message("No matching content found");
      }
    } catch (e) {
      message(`searchAllFile failed: ${e}`, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const doSearch = (type: "visible" | "all") => {
    setSearchType(type);
    if (type === "visible") {
      matchVisibleLines();
    } else {
      searchAllFile();
    }
  };

  const handleGotoLine = async (lineNumber: number) => {
    if (!fileInfo) return;

    const clampedLine = Math.max(
      1,
      Math.min(lineNumber, fileInfo.line_count)
    );

    setCurrentLine(clampedLine - 1);
    await loadLines(clampedLine - 1, VISIBLE_LINE_COUNT);

    if (searchQuery.trim()) {
      matchVisibleLines();
    }

    message(`Jumped to line ${clampedLine}`, { type: "success" });
  };

  const handleReplace = async (params: {
    search: string;
    replace: string;
    replaceAll: boolean;
    caseSensitive: boolean;
  }) => {
    if (!fileInfo) return;

    try {
      setLoading(true);

      const count = await replaceText({
        path: fileInfo.path,
        search_query: params.search,
        replace_text: params.replace,
        replace_all: params.replaceAll,
        case_sensitive: params.caseSensitive,
        encoding: selectedEncoding || fileInfo.encoding,
      });

      message(`Replacement completed: ${count}`, { type: "success" });

      await closeFile(fileInfo.path);

      const newFileInfo = await openFile({
        path: fileInfo.path,
        encoding: selectedEncoding || fileInfo.encoding,
      });

      setFileInfo(newFileInfo);
      await loadLines(currentLine, VISIBLE_LINE_COUNT);

      if (searchQuery === params.search) {
        setSearchType("visible");
        doSearch(searchType);
      }
    } catch (e) {
      message(`replace failed: ${e}`, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024 * 1024)
      return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    if (bytes > 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const handleCodeScroll = (e: Event) => {
    if (isSyncing || !lineNumberRef.current) return;
    setIsSyncing(true);

    const target = e.target as HTMLElement;
    const scrollTop = target?.scrollTop ?? 0;
    lineNumberRef.current.scrollTop = scrollTop;

    const scrollHeight = target?.scrollHeight ?? 0;
    const clientHeight = target?.clientHeight ?? 0;
    const threshold = clientHeight * 2;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold;
    const isNearTop = scrollTop <= threshold;

    // 向下滚动加载更多
    if (isNearBottom && hasMoreLinesRef.current && !isLoadingMore && useLargeTextStore.getState().fileInfo) {
      setIsLoadingMore(true);
      const nextStart = loadedStartLineRef.current + visibleLines.length;
      loadLines(nextStart, VISIBLE_LINE_COUNT, true).finally(() => {
        setIsLoadingMore(false);
      });
    }
    // 向上滚动加载前面的内容
    else if (isNearTop && loadedStartLineRef.current > 0 && !isLoadingMore && useLargeTextStore.getState().fileInfo) {
      setIsLoadingMore(true);
      const prevStart = Math.max(0, loadedStartLineRef.current - VISIBLE_LINE_COUNT);
      loadLines(prevStart, VISIBLE_LINE_COUNT, false).finally(() => {
        setIsLoadingMore(false);
      });
    }

    requestAnimationFrame(() => {
      setIsSyncing(false);
    });
  };

  useEffect(() => {
    const scrollElement = codeScrollbarRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleCodeScroll, { passive: true });
      return () => scrollElement.removeEventListener('scroll', handleCodeScroll);
    }
  }, [handleCodeScroll]);

  // const handleLineNumberScroll = () => {
  //   if (isSyncing || !codeScrollbarRef.current) return;
  //   setIsSyncing(true);

  //   const scrollTop = lineNumberRef.current?.scrollTop ?? 0;
  //   codeScrollbarRef.current.scrollTop = scrollTop;

  //   requestAnimationFrame(() => {
  //     setIsSyncing(false);
  //   });
  // };

  const selectLineContent = (lineNumber: number) => {
    const lineElement = document.querySelector(
      `[data-line-number="${lineNumber}"]`
    );
    if (!lineElement) return;

    const contentSpan = lineElement.querySelector(".line-content");
    if (!contentSpan) return;

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(contentSpan);

    selection.removeAllRanges();
    selection.addRange(range);
  };

  const clearFile = () => {
    cleanup();
  };

  useEffect(() => {
    const init = async () => {
      try {
        await cleanupSessions();
      } catch (e) {
        console.warn('[LargeTextView] cleanupSessions failed:', e);
      }

      try {
        const pendingPath = await invoke<string | null>("get_pending_file_path");
        if (pendingPath) {
          await loadFileFromPath(pendingPath);
        }
      } catch (e) {
        console.warn('[LargeTextView] get_pending_file_path failed:', e);
      }
    };

    init();

    const unlisten = listen<string>("open-text-file", async (event) => {
      await loadFileFromPath(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
      cleanup();
    };
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 固定的菜单区域 */}
      <div className="flex items-center gap-1 p-2 border-b bg-white dark:bg-gray-900 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={openFileDialog}
          title="Open File"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowFindDialog(true)}
          title="Search"
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowReplaceDialog(true)}
          title="Replace"
        >
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowGotoDialog(true)}
          title="Go to Line"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        <div className="flex-grow" />
        <Button
          variant="ghost"
          size="icon"
          onClick={clearFile}
          title="Close File"
        >
          <XCircle className="h-4 w-4" />
        </Button>
      </div>

      {/* 中间可滚动数据区域 */}
      <div className="flex flex-1 min-h-0 overflow-auto">
        <div
          ref={lineNumberRef}
          className="flex-shrink-0 w-[120px] overflow-y-auto overflow-x-hidden bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 scrollbar-hide"
        >
          <div className="w-full">
            {visibleLines.map((line) => (
              <div
                key={line.number}
                className={`flex h-6 items-center justify-end pr-3 text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  isMatchLine(line.number)
                    ? "bg-yellow-200 dark:bg-yellow-800"
                    : ""
                }`}
              >
                <span onClick={() => selectLineContent(line.number)}>
                  {line.number}
                </span>
              </div>
            ))}
          </div>
        </div>

        <ScrollArea
          ref={codeScrollbarRef}
          className="flex-1 bg-white dark:bg-gray-900"
        >
          <div className="min-w-full w-max">
            {visibleLines.map((line) => (
              <div
                key={line.number}
                data-line-number={line.number}
                className={`flex h-6 items-center cursor-text hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  isMatchLine(line.number)
                    ? "bg-yellow-200 dark:bg-yellow-800"
                    : ""
                }`}
              >
                <span
                  className="line-content ml-2 text-sm font-mono text-gray-800 dark:text-gray-200"
                  dangerouslySetInnerHTML={{ __html: highlightMatch(line.content) }}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 搜索结果区域 - 仅在有结果时显示 */}
      {searchResults.length > 0 && (
        <div className="border-t p-2 max-h-[200px] overflow-y-auto bg-white dark:bg-gray-900">
          <div className="flex gap-3 mb-2">
            <Badge
              variant={searchType === "visible" ? "success" : "info"}
            >
              {totalMatches} matches {searchType === "visible" ? "(Current View)" : "(All File)"}
            </Badge>
            <div className="flex-grow" />
            <Button
              variant="outline"
              size="sm"
              onClick={clearSearch}
            >
              Clear
            </Button>
          </div>

          <div className="space-y-1">
            {searchResults.map((result, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                onClick={() => handleGotoLine(result.line_number)}
              >
                <span className="text-gray-500 w-12">{result.line_number}</span>
                <span className="text-gray-500 w-12">{result.match_start}</span>
                <span className="text-gray-800 dark:text-gray-200 truncate">
                  {result.line_content}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 固定的底部文件信息区域 */}
      <div className="border-t p-2 flex items-center justify-between bg-white dark:bg-gray-900 shrink-0">
        <div className="flex items-center gap-2 max-w-[60%] overflow-hidden">
          {fileInfo && (
            <Badge variant="secondary" className="truncate">
              {fileInfo.path}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {fileInfo && (
            <>
              <Badge 
                variant="warning" 
                className="cursor-pointer hover:opacity-80"
                onClick={() => {
                  setLocalSelectedEncoding(selectedEncoding || fileInfo.encoding);
                  setLocalShowEncodingDialog(true);
                }}
              >
                {selectedEncoding || fileInfo.encoding}
              </Badge>
              <Badge variant="secondary">{formatSize(fileInfo.size)}</Badge>
              <Badge variant="secondary">{visibleLines.length} lines</Badge>
            </>
          )}
        </div>
      </div>

      {/* 编码选择对话框 */}
      <Dialog open={localShowEncodingDialog} onOpenChange={setLocalShowEncodingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择文件编码</DialogTitle>
            <DialogDescription>
              选择适合文件内容的编码格式,以正确显示文件内容
            </DialogDescription>
          </DialogHeader>
          <Select value={localSelectedEncoding || fileInfo?.encoding || 'UTF-8'} onValueChange={setLocalSelectedEncoding}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择编码" />
            </SelectTrigger>
            <SelectContent className="max-h-96">
              {ENCODING_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="mt-4">
            <Button variant="default" className="bg-black text-white border-black hover:bg-gray-800" onClick={async () => {
              if (fileInfo && localSelectedEncoding) {
                setLocalShowEncodingDialog(false);
                try {
                  const result = await openFile({
                    path: fileInfo.path,
                    encoding: localSelectedEncoding
                  });
                  if (result) {
                    useLargeTextStore.setState({
                      fileInfo: result,
                      selectedEncoding: localSelectedEncoding
                    });
                    loadedStartLineRef.current = 0;
                    hasMoreLinesRef.current = true;
                    await loadLines(0, VISIBLE_LINE_COUNT, false);
                  }
                } catch (error) {
                  message(`Failed to reload file: ${error}`, { type: "error" });
                }
              }
            }}>
              应用
            </Button>
            <Button variant="outline" onClick={() => setLocalShowEncodingDialog(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FindDialog
        open={showFindDialog}
        onOpenChange={setShowFindDialog}
        searchQuery={searchQuery}
        caseSensitive={caseSensitive}
        useRegex={useRegex}
        loading={loading}
        onSearchQueryChange={setSearchQuery}
        onCaseSensitiveChange={setCaseSensitive}
        onUseRegexChange={setUseRegex}
        onConfirm={doSearch}
      />

      <ReplaceDialog
        open={showReplaceDialog}
        onOpenChange={setShowReplaceDialog}
        searchQuery={searchQuery}
        loading={loading}
        onReplace={handleReplace}
      />

      <GotoDialog
        open={showGotoDialog}
        onOpenChange={setShowGotoDialog}
        totalLines={fileInfo?.line_count}
        onGoTo={handleGotoLine}
      />
    </div>
  );
}
