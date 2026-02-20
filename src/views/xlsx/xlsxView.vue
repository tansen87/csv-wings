<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpened, Files, Loading } from "@element-plus/icons-vue";
import { useDynamicHeight } from "@/utils/utils";
import { message } from "@/utils/message";
import { viewOpenFile, xlsxToJson } from "@/utils/view";

const path = ref("");
const filename = ref("");
const sheets = ref<string[]>([]);
const selectedSheet = ref("");
const nrows = ref(20);

const [tableColumn, tableData] = [ref<any[]>([]), ref<any[]>([])];
const isLoading = ref(false);
const { dynamicHeight } = useDynamicHeight(80);

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

onUnmounted(() => {
  // 清空数据
  [path, filename, selectedSheet].forEach(r => (r.value = ""));
  [sheets, tableColumn, tableData].forEach(r => (r.value = []));
});
</script>

<template>
  <el-form class="page-container">
    <el-splitter>
      <el-splitter-panel size="180" :resizable="false">
        <div class="splitter-container mr-1">
          <SiliconeButton @click="selectFile()" :icon="FolderOpened" text>
            Open xlsx
          </SiliconeButton>

          <div v-if="sheets.length > 0" class="mt-2">
            <el-text>Sheet:</el-text>
            <SiliconeSelect
              v-model="selectedSheet"
              placeholder="Select sheet"
              filterable
            >
              <el-option
                v-for="sheet in sheets"
                :key="sheet"
                :label="sheet"
                :value="sheet"
              />
            </SiliconeSelect>
          </div>

          <div v-if="sheets.length > 0" class="mt-2">
            <el-text class="mb-1">Preview Rows:</el-text>
            <SiliconeInputNumber
              v-model="nrows"
              :min="1"
              :max="1000"
              controls-position="right"
              style="width: 176px"
            />
          </div>

          <div class="mt-auto flex items-center">
            <el-icon v-if="isLoading" class="mr-2 is-loading">
              <Loading />
            </el-icon>
            <el-text v-if="isLoading" type="info">Loading...</el-text>
          </div>
        </div>
      </el-splitter-panel>

      <el-splitter-panel>
        <SiliconeTable
          :data="tableData"
          :height="dynamicHeight"
          show-overflow-tooltip
          v-loading="isLoading"
        >
          <el-table-column
            v-for="column in tableColumn"
            :key="column.prop"
            :prop="column.prop"
            :label="column.label"
          />
        </SiliconeTable>

        <SiliconeText class="mt-2" truncated :max-lines="1">
          <el-icon><Files /></el-icon>{{ path }}
        </SiliconeText>
      </el-splitter-panel>
    </el-splitter>
  </el-form>
</template>
