import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ReplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  loading: boolean;
  onReplace: (params: {
    search: string;
    replace: string;
    replaceAll: boolean;
    caseSensitive: boolean;
  }) => void;
}

export default function ReplaceDialog({ open, onOpenChange, searchQuery, loading, onReplace }: ReplaceDialogProps) {
  const [searchValue, setSearchValue] = useState(searchQuery);
  const [replaceValue, setReplaceValue] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [replaceAll, setReplaceAll] = useState(false);

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  const handleReplace = () => {
    onReplace({
      search: searchValue,
      replace: replaceValue,
      replaceAll,
      caseSensitive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Replace</DialogTitle>
          <DialogDescription>
            Replace text in the current file
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="replace-search">Find</Label>
            <Input
              id="replace-search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Enter search term"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="replace-text">Replace</Label>
            <Input
              id="replace-text"
              value={replaceValue}
              onChange={(e) => setReplaceValue(e.target.value)}
              placeholder="Enter replacement text"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="replace-case-sensitive"
              checked={caseSensitive}
              onCheckedChange={(checked) => setCaseSensitive(checked as boolean)}
            />
            <Label htmlFor="replace-case-sensitive">Case sensitive</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="replace-all"
              checked={replaceAll}
              onCheckedChange={(checked) => setReplaceAll(checked as boolean)}
            />
            <Label htmlFor="replace-all">Replace all</Label>
          </div>
        </div>
        <DialogFooter className="sm:justify-start space-x-2">
          <Button
            type="button"
            onClick={handleReplace}
            disabled={loading || !searchValue.trim()}
          >
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
