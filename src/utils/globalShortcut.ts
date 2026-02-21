import { onMounted, onUnmounted } from "vue";

interface ShortcutOptions {
  onOpenFile?: () => void;
  onRun?: () => void;
  onSearch?: () => void;
  onReplace?: () => void;
  onJump?: () => void;
  onHelp?: () => void;
}

export function useShortcuts(opts: ShortcutOptions) {
  const handleKeydown = (e: KeyboardEvent) => {
    // 排除输入框中触发
    const target = e.target as HTMLElement;
    const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
    if (isInput) return;

    // Ctrl+D 打开文件
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "d" &&
      !e.shiftKey
    ) {
      e.preventDefault();
      opts.onOpenFile?.();
    }

    // Ctrl+R 运行
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "r" &&
      !e.shiftKey
    ) {
      e.preventDefault();
      opts.onRun?.();
    }

    // Ctrl+F 搜索
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "f" &&
      !e.shiftKey
    ) {
      e.preventDefault();
      opts.onSearch?.();
    }

    // Ctrl+H 替换
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "h" &&
      !e.shiftKey
    ) {
      e.preventDefault();
      opts.onReplace?.();
    }

    // Ctrl+G 跳转
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "g" &&
      !e.shiftKey
    ) {
      e.preventDefault();
      opts.onJump?.();
    }

    // Ctrl+B 帮助
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "b" &&
      !e.shiftKey
    ) {
      e.preventDefault();
      opts.onHelp?.();
    }
  };

  onMounted(() => {
    window.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
}
