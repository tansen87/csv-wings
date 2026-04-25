import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

interface SelectItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  value: string;
  children: React.ReactNode;
}

interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string;
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ value, onValueChange, children, className }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [selectedValue, setSelectedValue] = React.useState(value);

    React.useEffect(() => {
      setSelectedValue(value);
    }, [value]);

    const handleValueChange = (newValue: string) => {
      setSelectedValue(newValue);
      onValueChange(newValue);
      setOpen(false);
    };

    const selectItems: React.ReactElement<SelectItemProps>[] = [];
    
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        if (child.type === SelectContent) {
          React.Children.forEach(child.props.children, (grandchild) => {
            if (React.isValidElement(grandchild) && grandchild.type === SelectItem) {
              selectItems.push(grandchild as React.ReactElement<SelectItemProps>);
            }
          });
        } else if (child.type === SelectItem) {
          selectItems.push(child as React.ReactElement<SelectItemProps>);
        }
      }
    });

    const selectedItem = selectItems.find(item => item.props.value === selectedValue);

    return (
      <div ref={ref} className={cn("relative", className)}>
        <SelectTrigger onClick={() => setOpen(true)}>
          <SelectValue placeholder="选择编码">
            {selectedItem ? (selectedItem.props as SelectItemProps).children : null}
          </SelectValue>
        </SelectTrigger>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>选择选项</DialogTitle>
              <DialogDescription>
                请选择一个选项
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary scrollbar-track-muted">
              {selectItems.map((item, index) => {
                const itemProps = item.props as SelectItemProps;
                return (
                  <Button
                    key={index}
                    variant={itemProps.value === selectedValue ? "ghost" : "ghost"}
                    className={`w-full justify-start ${itemProps.value === selectedValue ? 'bg-gray-200 text-gray-800' : ''}`}
                    onClick={() => handleValueChange(itemProps.value)}
                  >
                    {itemProps.children}
                  </Button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);
Select.displayName = "Select";

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ children, className, ...props }, ref) => (
    <Button
      ref={ref}
      variant="outline"
      className={cn(
        "w-full justify-between",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 ml-2" />
    </Button>
  )
);
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ children, className, ...props }, ref) => (
    <div ref={ref} className={cn(className)} {...props}>
      {children}
    </div>
  )
);
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<HTMLButtonElement, SelectItemProps>(
  ({ value, children, ...props }, ref) => (
    <button
      ref={ref}
      className="hidden"
      value={value}
      {...props}
    >
      {children}
    </button>
  )
);
SelectItem.displayName = "SelectItem";

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ placeholder, ...props }, ref) => (
    <span ref={ref} {...props}>
      {props.children || placeholder}
    </span>
  )
);
SelectValue.displayName = "SelectValue";

export {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
};