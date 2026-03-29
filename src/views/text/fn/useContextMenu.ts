import { Ref, ref, reactive, onMounted, onUnmounted, nextTick } from "vue";
import {
  useInsertColumn,
  InsertOptions as BaseInsertOptions
} from "./useInsert";
import { TaskProgress } from "./useProgress";

export interface ContextMenuOptions
  extends Omit<BaseInsertOptions, "askDefaultValue"> {
  path: Ref<string | null>;
  tableHeader: Ref<string[]>;
  ensureProgress: (name: string) => TaskProgress;
  finishProgress: (name: string) => void;
}

export function useContextMenu(options: ContextMenuOptions) {
  const { path, tableHeader, ensureProgress, finishProgress } = options;

  const rightClickInfo = ref<{ column: string; index: number } | null>(null);
  const showMenu = ref(false);
  const menuPosition = reactive({ x: -1000, y: -1000 });
  const contextMenuRef = ref<HTMLElement | null>(null);

  const insertApi = useInsertColumn({
    path,
    tableHeader,
    ensureProgress,
    finishProgress
  });

  function handleGlobalContextmenu(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const cell = target.closest(
      ".el-table__header-wrapper .el-table__cell"
    ) as HTMLElement | null;

    if (!cell) return;

    const headerRow = cell.parentElement;
    if (!headerRow) return;

    const colIndex = Array.from(headerRow.children).indexOf(cell);
    if (colIndex < 0 || colIndex >= tableHeader.value.length) return;

    const clickedColumn = tableHeader.value[colIndex];
    if (!clickedColumn) return;

    rightClickInfo.value = { column: clickedColumn, index: colIndex };
    menuPosition.x = event.clientX;
    menuPosition.y = event.clientY;

    nextTick(() => {
      showMenu.value = true;
    });
  }

  function handleEscapeKey(event: KeyboardEvent) {
    if (event.key === "Escape" && showMenu.value) {
      showMenu.value = false;
    }
  }

  onMounted(() => {
    document.addEventListener("contextmenu", handleGlobalContextmenu);
    document.addEventListener("keydown", handleEscapeKey);
  });

  onUnmounted(() => {
    document.removeEventListener("contextmenu", handleGlobalContextmenu);
    document.removeEventListener("keydown", handleEscapeKey);
  });

  async function insertColumn(side: "left" | "right") {
    if (rightClickInfo.value) {
      await insertApi.insertColumn(rightClickInfo.value.column, side);
    }
    showMenu.value = false;
  }

  function closeMenu() {
    showMenu.value = false;
  }

  return {
    showMenu,
    menuPosition,
    rightClickInfo,
    contextMenuRef,
    insertColumn,
    closeMenu
  };
}
