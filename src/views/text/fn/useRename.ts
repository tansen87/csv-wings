import { computed, reactive, Ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { message } from "@/utils/message";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";
import { TaskProgress } from "./useProgress";

export function useRename(
  pathRef: Ref<string | null>,
  ensureProgress: (name: string) => TaskProgress,
  finishProgress: (name: string) => void
) {
  const state = reactive({
    renaming: false,
    editableHeaders: [] as string[],
    originalHeaders: [] as string[]
  });

  function syncHeaders(newHeaders: string[]) {
    state.editableHeaders = [...newHeaders];
    state.originalHeaders = [...newHeaders];
  }

  async function executeRename() {
    const path = pathRef.value;
    if (!path) {
      message("No file opened", { type: "warning" });
      return;
    }

    const TASK_NAME = "rename";
    const progressState = ensureProgress(TASK_NAME);
    const unlistenUpdate = await listen("update-rename-rows", event => {
      progressState.current = event.payload as number;
    });
    const unlistenTotal = await listen("total-rename-rows", event => {
      progressState.total = event.payload as number;
    });

    const newHeaders = state.editableHeaders.map(h => h.trim() || "Unnamed");
    const headersString = newHeaders.join(",");

    try {
      state.renaming = true;
      const rtime: string = await invoke("rename", {
        path,
        headers: headersString,
        progress: true,
        quoting: useQuoting().quoting,
        skiprows: useSkiprows().skiprows,
        flexible: useFlexible().flexible
      });
      message(
        `Columns renamed successfully in ${parseFloat(rtime).toFixed(1)} s`,
        {
          type: "success"
        }
      );
    } catch (e) {
      message(`Rename failed: ${e}`, { type: "error" });
    } finally {
      state.renaming = false;
      finishProgress(TASK_NAME);
      unlistenUpdate();
      unlistenTotal();
    }
  }

  return {
    renaming: computed(() => state.renaming),
    editableHeaders: computed(() => state.editableHeaders),
    originalHeaders: computed(() => state.originalHeaders),
    syncHeaders,
    executeRename
  };
}
