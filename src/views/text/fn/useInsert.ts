import { reactive, Ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { message } from "@/utils/message";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";
import { TaskProgress } from "./useProgress";

export interface InsertOptions {
  path: Ref<string | null>;
  tableHeader: Ref<string[]>;
  ensureProgress: (name: string) => TaskProgress;
  finishProgress: (name: string) => void;
}

export function useInsertColumn(options: InsertOptions) {
  const { path, tableHeader, ensureProgress, finishProgress } = options;
  const state = reactive({
    inserting: false
  });

  async function insertColumn(
    referenceColumn: string,
    position: "left" | "right"
  ) {
    if (!path.value) {
      message("No file opened", { type: "warning" });
      return;
    }

    if (!tableHeader.value.includes(referenceColumn)) {
      message("Invalid reference column", { type: "error" });
      return;
    }

    const rawValue = prompt("Enter default value for all rows (optional):");
    if (rawValue === null) return;

    const TASK_NAME = "insert";
    const progressState = ensureProgress(TASK_NAME);
    const unlistenUpdate = await listen("update-insert-rows", event => {
      progressState.current = event.payload as number;
    });
    const unlistenTotal = await listen("total-insert-rows", event => {
      progressState.total = event.payload as number;
    });

    try {
      state.inserting = true;
      const rtime: string = await invoke("insert", {
        path: path.value,
        column: referenceColumn,
        position: position,
        values: rawValue || "",
        skiprows: useSkiprows().skiprows,
        quoting: useQuoting().quoting,
        flexible: useFlexible().flexible,
        progress: true
      });

      message(
        `Column inserted successfully (${parseFloat(rtime).toFixed(2)}s)`,
        {
          type: "success"
        }
      );
    } catch (e) {
      message(`Insert failed: ${e}`, { type: "error" });
    } finally {
      state.inserting = false;
      finishProgress(TASK_NAME);
      unlistenUpdate();
      unlistenTotal();
    }
  }

  return {
    insertColumn
  };
}
