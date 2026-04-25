import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
export default function GotoDialog({ open, onOpenChange, totalLines, onGoTo }) {
    const [lineNumber, setLineNumber] = useState("");
    const [error, setError] = useState("");
    const handleGoTo = () => {
        const line = parseInt(lineNumber, 10);
        if (isNaN(line) || line < 1) {
            setError("Please enter a valid line number");
            return;
        }
        if (totalLines && line > totalLines) {
            setError(`Line number must be between 1 and ${totalLines}`);
            return;
        }
        setError("");
        onGoTo(line);
        onOpenChange(false);
    };
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Go to Line</DialogTitle>
          <DialogDescription>
            Enter the line number to navigate to
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="line-number">Line Number</Label>
            <Input id="line-number" value={lineNumber} onChange={(e) => {
            setLineNumber(e.target.value);
            setError("");
        }} placeholder={`Enter line number (1-${totalLines || 'N/A'})`} type="number" min="1" autoFocus/>
            {error && (<div className="text-sm text-red-500">{error}</div>)}
            {totalLines && (<div className="text-sm text-gray-500">
                Total lines: {totalLines}
              </div>)}
          </div>
        </div>
        <DialogFooter className="sm:justify-start space-x-2">
          <Button type="button" onClick={handleGoTo} disabled={!lineNumber.trim()}>
            Go
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
//# sourceMappingURL=GotoDialog.jsx.map