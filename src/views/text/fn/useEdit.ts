import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { computed, reactive, ref, Ref } from "vue";
import { TaskProgress } from "./useProgress";
import { message } from "@/utils/message";

export interface EditOptions {
  tableHeader: Ref<string[]>;
  originalHeader: Ref<string[]>;
  currentDataLine: Ref<number>;
  originalDataSnapshot: Ref<Record<number, Record<string, string>>>;
  tableData: Ref<Record<string, string>[]>;
}

export function useEdit(
  options: EditOptions,
  pathRef: Ref<string | null>,
  ensureProgress: (name: string) => TaskProgress,
  finishProgress: (name: string) => void
) {
  const {
    tableHeader,
    originalHeader,
    currentDataLine,
    originalDataSnapshot,
    tableData
  } = options;
  const state = reactive({ saving: false });
  const editCache = ref(new Map<number, Record<string, string>>());
  const editedCells = ref(new Set<string>());

  // 根据原始字段名找新表头字段名
  function getNewHeaderByOriginal(orig: string): string | null {
    const index = originalHeader.value.indexOf(orig);
    if (index === -1 || index >= tableHeader.value.length) return null;
    return tableHeader.value[index];
  }

  // 判断某个单元格是否被修改
  function isCellModified(globalLine: number, header: string): boolean {
    return editedCells.value.has(`${globalLine}-${header}`);
  }

  // 判断某行是否有任意修改
  function isLineModified(globalLine: number): boolean {
    for (const key of editedCells.value) {
      if (key.startsWith(`${globalLine}-`)) return true;
    }
    return false;
  }

  // 单元格失焦时触发
  function onCellEdit(viewRowIndex: number, origField: string) {
    const globalLine = currentDataLine.value + viewRowIndex;
    const newField = getNewHeaderByOriginal(origField);
    if (!newField) return;

    const row = tableData?.value?.[viewRowIndex];
    const currentValue = row?.[origField] ?? "";
    const originalValue =
      originalDataSnapshot.value[globalLine]?.[origField] ?? "";

    if (currentValue !== originalValue) {
      const cachedRow = editCache.value.get(globalLine) || {};
      const newRow: Record<string, string> = {};

      for (let i = 0; i < tableHeader.value.length; i++) {
        const nh = tableHeader.value[i];
        const oh = originalHeader.value[i];
        newRow[nh] =
          i === originalHeader.value.indexOf(origField)
            ? currentValue
            : cachedRow[nh] ??
              originalDataSnapshot.value[globalLine]?.[oh] ??
              "";
      }

      editCache.value.set(globalLine, newRow);
      editedCells.value.add(`${globalLine}-${newField}`);
    } else {
      const cacheKey = `${globalLine}-${newField}`;
      editedCells.value.delete(cacheKey);

      const cachedRow = editCache.value.get(globalLine);
      if (cachedRow) {
        const { [newField]: _, ...rest } = cachedRow;

        let allOriginal = true;
        for (let i = 0; i < tableHeader.value.length; i++) {
          const nh = tableHeader.value[i];
          const oh = originalHeader.value[i];
          const origVal = originalDataSnapshot.value[globalLine]?.[oh] ?? "";
          if (rest[nh] !== undefined && rest[nh] !== origVal) {
            allOriginal = false;
            break;
          }
        }

        if (allOriginal || Object.keys(rest).length === 0) {
          editCache.value.delete(globalLine);
        } else {
          editCache.value.set(globalLine, rest);
        }
      }
    }
  }

  // 清除所有编辑状态
  function clearEdits() {
    editCache.value.clear();
    editedCells.value.clear();
  }

  async function saveEdits(outputPath: string | null) {
    const edits = Array.from(editCache.value.entries()).map(([line, data]) => ({
      line,
      data
    }));
    const TASK_NAME = "save";
    ensureProgress(TASK_NAME);
    try {
      state.saving = true;
      await invoke("table_edit", {
        path: pathRef.value,
        newHeaders: tableHeader.value,
        edits: edits,
        outputPath: outputPath
      });
      clearEdits();
      message("Changes saved successfully!", { type: "success" });
    } catch (e) {
      message(`Save failed: ${e}`, { type: "error" });
    } finally {
      state.saving = false;
      finishProgress(TASK_NAME);
    }
  }

  async function saveAsNewFile() {
    const outputPath = await save({
      title: "Save Edited CSV",
      defaultPath: `edited_${new Date().getTime()}`,
      filters: [
        {
          name: "CSV",
          extensions: ["csv"]
        }
      ]
    });
    if (outputPath) {
      await saveEdits(outputPath);
    }
  }

  return {
    saving: computed(() => state.saving),
    editCache,
    editedCells,
    getNewHeaderByOriginal,
    isCellModified,
    isLineModified,
    onCellEdit,
    clearEdits,
    saveEdits,
    saveAsNewFile
  };
}
