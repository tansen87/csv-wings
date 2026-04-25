import { create } from "zustand";

interface FileInfo {
  path: string;
  size: number;
  encoding: string;
  line_count: number;
}

interface SearchMatch {
  line_number: number;
  line_content: string;
  match_start: number;
  match_length: number;
  byte_offset: number;
}

interface LineData {
  number: number;
  content: string;
}

interface LargeTextState {
  fileInfo: FileInfo | null;
  visibleLines: LineData[];
  searchQuery: string;
  searchType: "visible" | "all";
  searchResults: SearchMatch[];
  totalMatches: number;
  currentLine: number;
  caseSensitive: boolean;
  useRegex: boolean;
  loading: boolean;
  showFindDialog: boolean;
  showReplaceDialog: boolean;
  showGotoDialog: boolean;
  isLoadingLines: boolean;
  selectedEncoding: string | null;
  showEncodingDialog: boolean;

  setFileInfo: (fileInfo: FileInfo | null) => void;
  setVisibleLines: (lines: LineData[]) => void;
  setSearchQuery: (query: string) => void;
  setSearchType: (type: "visible" | "all") => void;
  setSearchResults: (results: SearchMatch[]) => void;
  setTotalMatches: (total: number) => void;
  setCurrentLine: (line: number) => void;
  setCaseSensitive: (value: boolean) => void;
  setUseRegex: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setShowFindDialog: (value: boolean) => void;
  setShowReplaceDialog: (value: boolean) => void;
  setShowGotoDialog: (value: boolean) => void;
  setIsLoadingLines: (value: boolean) => void;
  setSelectedEncoding: (encoding: string | null) => void;
  setShowEncodingDialog: (value: boolean) => void;
  clearSearch: () => void;
  cleanup: () => void;
}

export const useLargeTextStore = create<LargeTextState>((set) => ({
  fileInfo: null,
  visibleLines: [],
  searchQuery: "",
  searchType: "visible",
  searchResults: [],
  totalMatches: 0,
  currentLine: 0,
  caseSensitive: false,
  useRegex: false,
  loading: false,
  showFindDialog: false,
  showReplaceDialog: false,
  showGotoDialog: false,
  isLoadingLines: false,
  selectedEncoding: null,
  showEncodingDialog: false,

  setFileInfo: (fileInfo) => set({ fileInfo }),
  setVisibleLines: (lines) => set({ visibleLines: lines }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchType: (type) => set({ searchType: type }),
  setSearchResults: (results) => set({ searchResults: results }),
  setTotalMatches: (total) => set({ totalMatches: total }),
  setCurrentLine: (line) => set({ currentLine: line }),
  setCaseSensitive: (value) => set({ caseSensitive: value }),
  setUseRegex: (value) => set({ useRegex: value }),
  setLoading: (value) => set({ loading: value }),
  setShowFindDialog: (value) => set({ showFindDialog: value }),
  setShowReplaceDialog: (value) => set({ showReplaceDialog: value }),
  setShowGotoDialog: (value) => set({ showGotoDialog: value }),
  setIsLoadingLines: (value) => set({ isLoadingLines: value }),
  setSelectedEncoding: (encoding) => set({ selectedEncoding: encoding }),
  setShowEncodingDialog: (value) => set({ showEncodingDialog: value }),
  clearSearch: () =>
    set({
      searchQuery: "",
      searchResults: [],
      totalMatches: 0,
    }),
  cleanup: () =>
    set({
      fileInfo: null,
      visibleLines: [],
      searchQuery: "",
      searchResults: [],
      totalMatches: 0,
      currentLine: 0,
      selectedEncoding: null,
      showEncodingDialog: false,
    }),
}));
