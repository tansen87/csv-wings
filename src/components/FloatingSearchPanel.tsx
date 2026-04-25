import { useState, useEffect, useRef } from "react";
import { X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface FloatingSearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  caseSensitive: boolean;
  useRegex: boolean;
  loading: boolean;
  defaultShowReplace?: boolean;
  onSearchQueryChange: (query: string) => void;
  onCaseSensitiveChange: (value: boolean) => void;
  onUseRegexChange: (value: boolean) => void;
  onSearch: (type: "visible" | "all", query: string, useRegex: boolean, caseSensitive: boolean) => void;
  onReplace?: (search: string, replace: string, replaceAll: boolean) => void;
}

export default function FloatingSearchPanel({
  open,
  onOpenChange,
  searchQuery,
  caseSensitive,
  useRegex,
  loading,
  defaultShowReplace = false,
  onSearchQueryChange,
  onCaseSensitiveChange,
  onUseRegexChange,
  onSearch,
  onReplace,
}: FloatingSearchPanelProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [localReplaceQuery, setLocalReplaceQuery] = useState("");
  const [localCaseSensitive, setLocalCaseSensitive] = useState(caseSensitive);
  const [localUseRegex, setLocalUseRegex] = useState(useRegex);
  const [showReplace, setShowReplace] = useState(defaultShowReplace);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
    setLocalCaseSensitive(caseSensitive);
    setLocalUseRegex(useRegex);
  }, [searchQuery, caseSensitive, useRegex]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setShowReplace(defaultShowReplace);
    }
  }, [open, defaultShowReplace]);

  const handleSearch = (type: "visible" | "all") => {
    onSearchQueryChange(localSearchQuery);
    onCaseSensitiveChange(localCaseSensitive);
    onUseRegexChange(localUseRegex);
    onSearch(type, localSearchQuery, localUseRegex, localCaseSensitive);
  };

  const handleReplace = () => {
    if (onReplace && localSearchQuery.trim()) {
      onReplace(localSearchQuery, localReplaceQuery, true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch("visible");
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  const toggleReplace = () => {
    setShowReplace(!showReplace);
  };

  if (!open) return null;

  return (
    <div className="absolute top-2 right-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 w-96">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{showReplace ? "替换" : "查找"}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-transparent hover:bg-gray-200 dark:bg-transparent dark:hover:bg-gray-800"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          <X className="h-4 w-4 text-gray-500 dark:text-gray-300" />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 bg-transparent hover:bg-gray-200 dark:bg-transparent dark:hover:bg-gray-800"
            onClick={toggleReplace}
            disabled={loading}
          >
            {showReplace ? (
              <ChevronUp className="h-4 w-4 text-gray-500 dark:text-gray-300" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-300" />
            )}
          </Button>
          <Input
            ref={inputRef}
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="查找"
            className="h-8 text-sm flex-1"
            disabled={loading}
          />
        </div>

        {showReplace && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 shrink-0" />
            <Input
              value={localReplaceQuery}
              onChange={(e) => setLocalReplaceQuery(e.target.value)}
              placeholder="替换"
              className="h-8 text-sm flex-1"
              disabled={loading}
            />
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="floating-case-sensitive"
              checked={localCaseSensitive}
              onCheckedChange={(checked) => setLocalCaseSensitive(checked as boolean)}
              disabled={loading}
            />
            <Label htmlFor="floating-case-sensitive" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
              区分大小写
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="floating-use-regex"
              checked={localUseRegex}
              onCheckedChange={(checked) => setLocalUseRegex(checked as boolean)}
              disabled={loading}
            />
            <Label htmlFor="floating-use-regex" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
              正则表达式
            </Label>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1 bg-black text-white border-black hover:bg-gray-800 h-7 text-xs"
            onClick={() => handleSearch("visible")}
            disabled={loading || !localSearchQuery.trim()}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            ) : (
              "查找"
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 bg-black text-white border-black hover:bg-gray-800 h-7 text-xs"
            onClick={() => handleSearch("all")}
            disabled={loading || !localSearchQuery.trim()}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            ) : (
              "查找所有"
            )}
          </Button>
          {showReplace && (
            <Button
              type="button"
              size="sm"
              className="flex-1 bg-black text-white border-black hover:bg-gray-800 h-7 text-xs"
              onClick={handleReplace}
              disabled={loading || !localSearchQuery.trim()}
            >
              替换
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}