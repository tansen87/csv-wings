import { watch, Ref, computed, reactive } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { message } from "@/utils/message";
import {
  useFlexible,
  useQuoting,
  useSkiprows,
  useThreads
} from "@/store/modules/options";
import { TaskProgress } from "./useProgress";

interface ColumnConfig {
  column: string;
  mode: string;
  condition: string;
}

export function useSearch(
  pathRef: Ref<string | null>,
  ensureProgress: (name: string) => TaskProgress,
  finishProgress: (name: string) => void
) {
  const state = reactive({
    filtering: false,
    showSearchDialog: false,
    columnConfigs: [
      { column: "", mode: "equal", condition: "" }
    ] as ColumnConfig[],
    logics: [] as string[]
  });

  watch(
    () => state.columnConfigs,
    newConfigs => {
      const n = newConfigs.length;
      state.logics = Array(n > 0 ? n - 1 : 0).fill("and");
    },
    { deep: true, immediate: true }
  );

  function addColumn() {
    state.columnConfigs.push({ column: "", mode: "equal", condition: "" });
  }

  function removeColumn(index: number) {
    if (state.columnConfigs.length <= 1) return;
    state.columnConfigs.splice(index, 1);
  }

  async function executeSearch() {
    const path = pathRef.value;
    if (!path) {
      message("Please open a CSV file first", { type: "warning" });
      return;
    }

    const validConfigs = state.columnConfigs.filter(
      cfg => cfg.column.trim() !== "" && cfg.condition.trim() !== ""
    );

    if (validConfigs.length === 0) {
      message("Please fill in at least one valid filtering condition", {
        type: "warning"
      });
      return;
    }

    const TASK_NAME = "search";
    const progressState = ensureProgress(TASK_NAME);
    const unlistenUpdate = await listen("update-search-rows", event => {
      progressState.current = event.payload as number;
    });
    const unlistenTotal = await listen("total-search-rows", event => {
      progressState.total = event.payload as number;
    });

    try {
      state.filtering = true;
      const res: [string, string] = await invoke("search_chain", {
        path,
        configs: validConfigs,
        logics: state.logics,
        progress: true,
        quoting: useQuoting().quoting,
        flexible: useFlexible().flexible,
        skiprows: useSkiprows().skiprows,
        threads: useThreads().threads
      });

      const [matchCount, timeStr] = res;
      state.showSearchDialog = false;
      message(
        `Filter done: ${matchCount} rows matched, elapsed ${parseFloat(
          timeStr
        ).toFixed(1)} s`,
        { type: "success" }
      );
    } catch (e) {
      message(`filter failed: ${e}`, { type: "error" });
    } finally {
      state.filtering = false;
      finishProgress(TASK_NAME);
      unlistenUpdate();
      unlistenTotal();
    }
  }

  return {
    filtering: computed(() => state.filtering),
    showSearchDialog: computed({
      get: () => state.showSearchDialog,
      set: (value: boolean) => {
        state.showSearchDialog = value;
      }
    }),
    columnConfigs: computed({
      get: () => state.columnConfigs,
      set: (value: ColumnConfig[]) => {
        state.columnConfigs = value;
      }
    }),
    logics: computed({
      get: () => state.logics,
      set: (value: string[]) => {
        state.logics = value;
      }
    }),
    addColumn,
    removeColumn,
    executeSearch
  };
}
