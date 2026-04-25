import { useEffect, useRef, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  FolderOpen,
  Search,
  Edit3,
  ArrowRight,
  X,
  Moon,
  Sun,
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
  type SearchMatch,
  closeFile,
  cleanupSessions,
} from "@/utils/textOperations";
import { message } from "@/utils/message";
import { viewOpenFile } from "@/utils/view";
import FloatingSearchPanel from "@/components/FloatingSearchPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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
  const [showFloatingSearch, setShowFloatingSearch] = useState(false);
  const [showReplaceFromMenu, setShowReplaceFromMenu] = useState(false);
  const [showLineInput, setShowLineInput] = useState(false);
  const [lineInputValue, setLineInputValue] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true);
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
        message(`加载行失败: ${e}`, { type: "error" });
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
      message(`打开文件失败: ${e}`, { type: "error" });
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
      message(`打开文件失败: ${e}`, { type: "error" });
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

  const matchVisibleLines = (query: string, useRegexFlag: boolean, caseSensitiveFlag: boolean) => {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    setSearchType("visible");
    const matches: SearchMatch[] = [];
    let regex: RegExp | null = null;

    try {
      if (useRegexFlag) {
        const flags = "g" + (caseSensitiveFlag ? "" : "i");
        regex = new RegExp(query, flags);
      } else {
        const escaped = escapeRegExp(query);
        const flags = "g" + (caseSensitiveFlag ? "" : "i");
        regex = new RegExp(escaped, flags);
      }
    } catch (e) {
      message(`查找失败: ${e}`, { type: "error" });
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
      message("未找到匹配内容");
    }
  };

  const searchAllFile = async (query: string, useRegexFlag: boolean, caseSensitiveFlag: boolean) => {
    if (!fileInfo) return;

    try {
      setLoading(true);
      setSearchResults([]);

      const result = await searchFile({
        path: fileInfo.path,
        query: query,
        case_sensitive: caseSensitiveFlag,
        use_regex: useRegexFlag,
        page: 1,
        page_size: VISIBLE_LINE_COUNT,
      });

      setSearchResults(result.matches);
      setTotalMatches(result.total_matches);

      if (result.total_matches < 1) {
        message("未找到匹配内容");
      }
    } catch (e) {
      message(`查找失败: ${e}`, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const doSearch = (type: "visible" | "all", query: string, useRegexFlag: boolean, caseSensitiveFlag: boolean) => {
    setSearchType(type);
    if (type === "visible") {
      matchVisibleLines(query, useRegexFlag, caseSensitiveFlag);
    } else {
      searchAllFile(query, useRegexFlag, caseSensitiveFlag);
    }
  };

  const handleFloatingReplace = (search: string, replace: string, replaceAll: boolean) => {
    handleReplace({
      search,
      replace,
      replaceAll,
      caseSensitive,
    });
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
      matchVisibleLines(searchQuery, useRegex, caseSensitive);
    }

    message(`跳转到行 ${clampedLine}`, { type: "success" });
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

      message(`替换完成: ${count}`, { type: "success" });

      await closeFile(fileInfo.path);

      const newFileInfo = await openFile({
        path: fileInfo.path,
        encoding: selectedEncoding || fileInfo.encoding,
      });

      setFileInfo(newFileInfo);
      await loadLines(currentLine, VISIBLE_LINE_COUNT);

      if (searchQuery === params.search) {
        setSearchType("visible");
        doSearch(searchType, searchQuery, useRegex, caseSensitive);
      }
    } catch (e) {
      message(`替换失败: ${e}`, { type: "error" });
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

  const toggleDarkMode = () => {
    // 创建绽放动画元素
    const bloomElement = document.createElement('div');
    bloomElement.className = 'bloom-animation';

    // 根据当前主题设置绽放颜色
    if (isDarkMode) {
      // 从dark切换到light,使用light的底色
      bloomElement.style.background = 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)';
    } else {
      // 从light切换到dark,使用dark的底色
      bloomElement.style.background = 'radial-gradient(circle, rgba(17,24,39,0.8) 0%, rgba(17,24,39,0) 70%)';
    }

    document.body.appendChild(bloomElement);

    // 添加过渡效果
    document.documentElement.classList.add('theme-transition');
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");

    // 移除过渡效果,避免影响其他样式变化
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 500);

    // 移除绽放元素
    setTimeout(() => {
      if (document.body.contains(bloomElement)) {
        document.body.removeChild(bloomElement);
      }
    }, 600);
  };

  useEffect(() => {
    const init = async () => {
      try {
        await cleanupSessions();
      } catch (e) {
        message(`清理会话失败: ${e}`, { type: "error" });
      }

      try {
        const pendingPath = await invoke<string | null>("get_pending_file_path");
        if (pendingPath) {
          await loadFileFromPath(pendingPath);
        }
      } catch (e) {
        message(`获取待文件路径失败: ${e}`, { type: "error" });
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

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape键关闭所有面板
      if (e.key === 'Escape') {
        setShowFloatingSearch(false);
        setShowLineInput(false);
        setLocalShowEncodingDialog(false);
        setShowReplaceFromMenu(false);
      }

      // 检查是否按下了Ctrl键
      if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'f':
            e.preventDefault();
            if (showFloatingSearch && !showReplaceFromMenu) {
              setShowFloatingSearch(false);
            } else {
              setShowReplaceFromMenu(false);
              setShowFloatingSearch(true);
            }
            break;
          case 'h':
            e.preventDefault();
            if (showFloatingSearch && showReplaceFromMenu) {
              setShowFloatingSearch(false);
              setShowReplaceFromMenu(false);
            } else {
              setShowReplaceFromMenu(true);
              setShowFloatingSearch(true);
            }
            break;
          case 'o':
            e.preventDefault();
            openFileDialog();
            break;
          case 't':
            e.preventDefault();
            toggleDarkMode();
            break;
          case 'g':
            e.preventDefault();
            if (showLineInput) {
              setShowLineInput(false);
              setLineInputValue('');
            } else {
              setShowLineInput(true);
            }
            break;
          case 'w':
            e.preventDefault();
            clearFile();
            break;
          case 'f4':
            e.preventDefault();
            clearFile();
            break;
          default:
            break;
        }
      }
    };

    // 添加键盘事件监听
    window.addEventListener('keydown', handleKeyDown);

    // 清理事件监听
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showFloatingSearch, showReplaceFromMenu, showLineInput]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 固定的菜单区域 */}
      <div className="flex items-center gap-1 p-1 border-b bg-gray-100 dark:bg-gray-800 z-10">
        <div className="relative group">
          <Button
            variant="ghost"
            size="icon"
            className="bg-transparent hover:bg-gray-200 dark:bg-transparent dark:hover:bg-gray-800 h-7 w-7"
            onClick={openFileDialog}
          >
            <FolderOpen className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </Button>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md shadow-lg">
              打开
            </div>
          </div>
        </div>
        <div className="relative group">
          <Button
            variant="ghost"
            size="icon"
            className="bg-transparent hover:bg-gray-200 dark:bg-transparent dark:hover:bg-gray-800 h-7 w-7"
            onClick={() => {
              if (showFloatingSearch && !showReplaceFromMenu) {
                setShowFloatingSearch(false);
              } else {
                setShowReplaceFromMenu(false);
                setShowFloatingSearch(true);
              }
            }}
          >
            <Search className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </Button>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md shadow-lg">
              查找
            </div>
          </div>
        </div>
        <div className="relative group">
          <Button
            variant="ghost"
            size="icon"
            className="bg-transparent hover:bg-gray-200 dark:bg-transparent dark:hover:bg-gray-800 h-7 w-7"
            onClick={() => {
              if (showFloatingSearch && showReplaceFromMenu) {
                setShowFloatingSearch(false);
                setShowReplaceFromMenu(false);
              } else {
                setShowReplaceFromMenu(true);
                setShowFloatingSearch(true);
              }
            }}
          >
            <Edit3 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </Button>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md shadow-lg">
              替换
            </div>
          </div>
        </div>
        <div className="relative group">
          <Button
            variant="ghost"
            size="icon"
            className="bg-transparent hover:bg-gray-200 dark:bg-transparent dark:hover:bg-gray-800 h-7 w-7"
            onClick={() => setShowLineInput(true)}
          >
            <ArrowRight className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </Button>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md shadow-lg">
              跳转
            </div>
          </div>
        </div>
        <div className="relative group">
          <Button
            variant="ghost"
            size="icon"
            className="bg-transparent hover:bg-gray-200 dark:bg-transparent dark:hover:bg-gray-800 h-7 w-7"
            onClick={clearFile}
          >
            <X className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </Button>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md shadow-lg">
              关闭
            </div>
          </div>
        </div>
        <div className="flex-grow" />
        <div className="relative group">
          <Button
            variant="ghost"
            size="icon"
            className="bg-transparent hover:bg-gray-200 dark:bg-transparent dark:hover:bg-gray-800 h-7 w-7"
            onClick={toggleDarkMode}
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-gray-600 dark:text-gray-300" /> : <Moon className="h-4 w-4 text-gray-600 dark:text-gray-300" />}
          </Button>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md shadow-lg">
              {isDarkMode ? '浅色' : '暗色'}
            </div>
          </div>
        </div>
      </div>

      {/* 中间可滚动数据区域 */}
      <div className="flex flex-1 min-h-0 overflow-auto relative">
        <div
          ref={lineNumberRef}
          className="flex-shrink-0 w-[120px] overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 scrollbar-hide"
        >
          <div className="w-full">
            {visibleLines.map((line) => (
              <div
                key={line.number}
                className={`flex h-6 items-center justify-end pr-3 text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 ${isMatchLine(line.number)
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
                className={`flex h-6 items-center cursor-text hover:bg-gray-100 dark:hover:bg-gray-800 ${isMatchLine(line.number)
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

        <FloatingSearchPanel
          open={showFloatingSearch}
          onOpenChange={(open) => {
            setShowFloatingSearch(open);
            if (!open) {
              setShowReplaceFromMenu(false);
            }
          }}
          searchQuery={searchQuery}
          caseSensitive={caseSensitive}
          useRegex={useRegex}
          loading={loading}
          defaultShowReplace={showReplaceFromMenu}
          onSearchQueryChange={setSearchQuery}
          onCaseSensitiveChange={setCaseSensitive}
          onUseRegexChange={setUseRegex}
          onSearch={doSearch}
          onReplace={handleFloatingReplace}
        />

        {/* 行号输入框 */}
        {showLineInput && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 w-80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">转到行</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-transparent hover:bg-gray-200 dark:bg-transparent dark:hover:bg-gray-800"
                onClick={() => {
                  setShowLineInput(false);
                  setLineInputValue('');
                }}
              >
                <X className="h-4 w-4 text-gray-500 dark:text-gray-300" />
              </Button>
            </div>
            <div className="space-y-3">
              <Input
                type="number"
                min="1"
                max={fileInfo?.line_count || 0}
                value={lineInputValue}
                onChange={(e) => setLineInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && lineInputValue) {
                    const lineNum = parseInt(lineInputValue);
                    if (!isNaN(lineNum) && lineNum >= 1 && lineNum <= (fileInfo?.line_count || 0)) {
                      handleGotoLine(lineNum);
                      setShowLineInput(false);
                      setLineInputValue('');
                    }
                  } else if (e.key === 'Escape') {
                    setShowLineInput(false);
                    setLineInputValue('');
                  }
                }}
                placeholder="输入行号"
                className="h-8 text-sm w-full"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {lineInputValue ? `按"Enter"键转到第 ${lineInputValue} 行` : `键入要转到的行号 (从 1 到 ${fileInfo?.line_count || 0})`}
              </p>
            </div>
          </div>
        )}

        {/* 编码选择面板 */}
        {localShowEncodingDialog && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 w-80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">通过编码重新打开</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-transparent hover:bg-gray-200 dark:bg-transparent dark:hover:bg-gray-800"
                onClick={() => {
                  setLocalShowEncodingDialog(false);
                }}
              >
                <X className="h-4 w-4 text-gray-500 dark:text-gray-300" />
              </Button>
            </div>
            <div className="space-y-3">
              <Select value={localSelectedEncoding || fileInfo?.encoding || 'UTF-8'} onValueChange={async (newEncoding) => {
                setLocalSelectedEncoding(newEncoding);
                if (fileInfo) {
                  setLocalShowEncodingDialog(false);
                  try {
                    const result = await openFile({
                      path: fileInfo.path,
                      encoding: newEncoding
                    });
                    if (result) {
                      useLargeTextStore.setState({
                        fileInfo: result,
                        selectedEncoding: newEncoding
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
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-96">
                  {ENCODING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* 搜索结果区域 - 仅在有结果时显示 */}
      {searchResults.length > 0 && (
        <div className="border-t bg-white dark:bg-gray-900">
          <div className="p-2 border-b dark:border-gray-700">
            <div className="flex">
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
          </div>

          {/* 可滚动的结果列表 */}
          <div className="max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary scrollbar-track-muted">
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
              <Badge variant="success" className="cursor-pointer hover:opacity-80" onClick={() => setShowLineInput(true)}>{fileInfo?.line_count || 0} lines</Badge>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
