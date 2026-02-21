<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Document } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import { viewOpenFile, xlsxToJson } from "@/utils/view";
import { useDynamicHeight } from "@/utils/utils";
import { useShortcuts } from "@/utils/globalShortcut";

const path = ref("");
const filename = ref("");
const sheets = ref<string[]>([]);
const selectedSheet = ref("");
const nrows = ref(50);

const [tableColumn, tableData] = [ref<any[]>([]), ref<any[]>([])];
const isLoading = ref(false);
const { dynamicHeight } = useDynamicHeight(136);

async function selectFile() {
  const selected = await viewOpenFile(false, "xlsx", ["xlsx"]);

  if (!selected || typeof selected !== "string") {
    path.value = "";
    filename.value = "";
    return;
  }

  path.value = selected;
  filename.value = selected.split(/[/\\]/).pop() || "";

  try {
    isLoading.value = true;

    const result = await invoke<
      [Record<string, string[]>, Record<string, string>]
    >("map_excel_sheets", { path: path.value });

    const sheetMap = result[0];
    const fileSheets = sheetMap[filename.value] || [];

    if (fileSheets.length === 0) {
      message("No sheets found in the Excel file", { type: "warning" });
      selectedSheet.value = "";
      [sheets, tableColumn, tableData].forEach(r => (r.value = []));
      return;
    }

    sheets.value = fileSheets;
    selectedSheet.value = fileSheets[0];

    await loadPreview();
  } catch (err) {
    message(err.toString(), { type: "error" });
    [sheets, tableColumn, tableData].forEach(r => (r.value = []));
  } finally {
    isLoading.value = false;
  }
}

async function loadPreview() {
  if (!path.value || !selectedSheet.value) return;
  try {
    const { columnView, dataView } = await xlsxToJson(
      path.value,
      selectedSheet.value,
      nrows.value
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
  } catch (err) {
    message(`Failed to preview sheet: ${err}`, { type: "error" });
    tableData.value = [];
    tableColumn.value = [];
  }
}

watch(selectedSheet, () => {
  if (selectedSheet.value) {
    loadPreview();
  }
});

watch(nrows, () => {
  if (selectedSheet.value && path.value) {
    loadPreview();
  }
});

useShortcuts({
  onOpenFile: () => selectFile()
});

onUnmounted(() => {
  // 清空数据
  [path, filename, selectedSheet].forEach(r => (r.value = ""));
  [sheets, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <div class="file-viewer">
    <SiliconeCard v-if="path && sheets.length" shadow="never">
      <div class="flex items-center gap-2 mt-1 mb-1 ml-1 mr-1">
        <SiliconeButton
          @click="selectFile()"
          :loading="isLoading"
          text
          size="small"
        >
          Open Xlsx
        </SiliconeButton>
        <div class="flex-grow" />
        <SiliconeSelect
          v-model="selectedSheet"
          placeholder="Select sheet"
          filterable
          style="width: 150px"
          size="small"
        >
          <el-option
            v-for="sheet in sheets"
            :key="sheet"
            :label="sheet"
            :value="sheet"
          />
        </SiliconeSelect>
        <SiliconeInputNumber
          v-model="nrows"
          :min="1"
          :max="500"
          controls-position="right"
          style="width: 150px"
          size="small"
        />
      </div>
    </SiliconeCard>

    <SiliconeCard v-if="path && sheets.length" shadow="never">
      <SiliconeTag type="info" size="small" class="mb-1 mt-1 ml-1">
        {{ path }}
      </SiliconeTag>
    </SiliconeCard>

    <el-empty v-if="!path" :image-size="200">
      <template #image>
        <el-icon :size="200" color="#909399">
          <Document />
        </el-icon>
      </template>
      <template #description>
        <div class="flex flex-col text-center">
          <div class="flex gap-4">
            <SiliconeTag type="success" @click="selectFile">
              Open Xlsx
            </SiliconeTag>
            <SiliconeTag>Ctrl + D</SiliconeTag>
          </div>
        </div>
      </template>
    </el-empty>

    <div v-else class="flex-1 flex flex-col min-h-0">
      <SiliconeCard shadow="never" class="flex-1 flex flex-col p-2">
        <el-scrollbar>
          <SiliconeTable
            :data="tableData"
            show-overflow-tooltip
            v-loading="isLoading"
            class="mb-1 ml-1 mr-1 mt-1"
            :style="{ width: 'calc(100% - 8px)' }"
            :height="dynamicHeight"
          >
            <el-table-column
              v-for="column in tableColumn"
              :key="column.prop"
              :prop="column.prop"
              :label="column.label"
            />
          </SiliconeTable>
        </el-scrollbar>
      </SiliconeCard>
    </div>
  </div>
</template>

<style scoped>
:deep(.el-card__body) {
  padding: 0 !important;
}

.file-viewer {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 36px);
  padding: 8px;
  gap: 8px;
  background: #f5f7fa;
  user-select: none;
}
.dark .file-viewer {
  background: #1a1a1a;
}
</style>
