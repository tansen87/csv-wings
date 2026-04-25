import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
export default function FindDialog({ open, onOpenChange, searchQuery, caseSensitive, useRegex, loading, onSearchQueryChange, onCaseSensitiveChange, onUseRegexChange, onConfirm }) {
    const [searchValue, setSearchValue] = useState(searchQuery);
    const [localCaseSensitive, setLocalCaseSensitive] = useState(caseSensitive);
    const [localUseRegex, setLocalUseRegex] = useState(useRegex);
    useEffect(() => {
        setSearchValue(searchQuery);
        setLocalCaseSensitive(caseSensitive);
        setLocalUseRegex(useRegex);
    }, [searchQuery, caseSensitive, useRegex]);
    const handleSearch = (type) => {
        onSearchQueryChange(searchValue);
        onCaseSensitiveChange(localCaseSensitive);
        onUseRegexChange(localUseRegex);
        onConfirm(type);
    };
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Find</DialogTitle>
          <DialogDescription>
            Search for text in the current file
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input id="search" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} placeholder="Enter search term" autoFocus/>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="case-sensitive" checked={localCaseSensitive} onCheckedChange={(checked) => setLocalCaseSensitive(checked)}/>
            <Label htmlFor="case-sensitive">Case sensitive</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="use-regex" checked={localUseRegex} onCheckedChange={(checked) => setLocalUseRegex(checked)}/>
            <Label htmlFor="use-regex">Use regex</Label>
          </div>
        </div>
        <DialogFooter className="sm:justify-start space-x-2">
          <Button type="button" onClick={() => handleSearch("visible")} disabled={loading || !searchValue.trim()}>
            Search Current View
          </Button>
          <Button type="button" onClick={() => handleSearch("all")} disabled={loading || !searchValue.trim()}>
            Search All File
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
//# sourceMappingURL=FindDialog.jsx.map