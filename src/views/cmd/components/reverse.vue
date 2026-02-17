<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpened, Files, SwitchButton } from "@element-plus/icons-vue";
import { useDynamicHeight } from "@/utils/utils";
import { viewOpenFile, toJson } from "@/utils/view";
import { message } from "@/utils/message";
import { mdReverse, useMarkdown } from "@/utils/markdown";
import { useFlexible, useQuoting, useSkiprows } from "@/store/modules/options";

const path = ref("");
const [tableColumn, tableData] = [ref([]), ref([])];
const [isLoading, dialog] = [ref(false), ref(false)];
const { dynamicHeight } = useDynamicHeight(120);
const { mdShow } = useMarkdown(mdReverse);
const quoting = useQuoting();
const skiprows = useSkiprows();
const flexible = useFlexible();

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) {
    path.value = "";
    return;
  }

  try {
    const { columnView, dataView } = await toJson(
      path.value,
      skiprows.skiprows
    );
    tableColumn.value = columnView;
    tableData.value = dataView;
  } catch (err) {
    message(err.toString(), { type: "error", duration: 10000 });
  }
}

// invoke reverse
async function reverseData() {
  if (path.value === "") {
    message("File not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const rtime: string = await invoke("reverse", {
      path: path.value,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows,
      flexible: flexible.flexible
    });
    message(`Reverse done, elapsed time: ${rtime} s`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}
</script>

<template>
  <el-form class="page-container">
    <el-splitter>
      <el-splitter-panel size="180" :resizable="false">
        <div class="splitter-container mr-1">
          <SiliconeButton @click="selectFile()" :icon="FolderOpened" text>
            Open File
          </SiliconeButton>

          <el-link @click="dialog = true" class="mt-auto" underline="never">
            <SiliconeText class="mb-[1px]">Reverse</SiliconeText>
          </el-link>
        </div>
      </el-splitter-panel>

      <el-splitter-panel>
        <SiliconeButton
          @click="reverseData()"
          :loading="isLoading"
          :icon="SwitchButton"
          text
          class="ml-1 mb-2"
          >Run
        </SiliconeButton>

        <SiliconeTable
          :data="tableData"
          :height="dynamicHeight"
          show-overflow-tooltip
        >
          <el-table-column
            v-for="column in tableColumn"
            :prop="column.prop"
            :label="column.label"
            :key="column.prop"
          />
        </SiliconeTable>

        <SiliconeText class="mt-2" truncated :max-lines="1">
          <el-icon><Files /></el-icon>{{ path }}
        </SiliconeText>
      </el-splitter-panel>
    </el-splitter>

    <SiliconeDialog
      v-model="dialog"
      title="Reverse - Reverse order of rows in a CSV"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
