import { reactive, computed, readonly } from "vue";

export interface TaskProgress {
  current: number;
  total: number;
  visible: boolean;
}

export function useTaskProgress() {
  const progressMap = reactive(new Map<string, TaskProgress>());
  // 只暴露可见任务
  const visibleProgress = computed(() => {
    const result: Record<string, TaskProgress> = {};
    for (const [key, state] of progressMap.entries()) {
      if (state.visible) {
        result[key] = state;
      }
    }
    return result;
  });

  function ensureProgress(taskName: string): TaskProgress {
    if (!progressMap.has(taskName)) {
      progressMap.set(taskName, { current: 0, total: 0, visible: true });
    }
    return progressMap.get(taskName)!;
  }

  function finishProgress(taskName: string): void {
    const state = progressMap.get(taskName);
    if (state) {
      state.visible = false;
      // 3秒后自动清理
      setTimeout(() => {
        // 再次检查是否仍为 hidden,防止被重新激活
        if (progressMap.get(taskName)?.visible === false) {
          progressMap.delete(taskName);
        }
      }, 3000);
    }
  }

  function updateProgress(
    taskName: string,
    { current, total }: Partial<Pick<TaskProgress, "current" | "total">>
  ): void {
    const state = ensureProgress(taskName);
    if (current !== undefined) state.current = current;
    if (total !== undefined) state.total = total;
  }

  return {
    visibleProgress: readonly(visibleProgress),
    ensureProgress,
    finishProgress,
    updateProgress
  };
}
