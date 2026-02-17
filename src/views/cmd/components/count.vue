<script setup lang="ts">
import { ref } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { ElIcon } from "element-plus";
import {
  Loading,
  FolderOpened,
  CloseBold,
  Select,
  SwitchButton
} from "@element-plus/icons-vue";
import { useDark } from "@pureadmin/utils";
import { shortFileName, useDynamicHeight, updateEvent } from "@/utils/utils";
import { message } from "@/utils/message";
import { useMarkdown, mdCount } from "@/utils/markdown";
import { useSkiprows } from "@/store/modules/options";

const mode = ref("count");
const modeOptions = [
  { label: "Count", value: "count" },
  { label: "Check", value: "check" }
];
const path = ref("");
const [dialog, isLoading] = [ref(false), ref(false)];
const fileSelect = ref([]);
const { dynamicHeight } = useDynamicHeight(82);
const { mdShow } = useMarkdown(mdCount);
const { isDark } = useDark();
const skiprows = useSkiprows();

listen("info", (event: Event<string>) => {
  const filename = event.payload;
  updateEvent(fileSelect, filename, file => {
    file.status = "";
  });
});
listen("err", (event: Event<string>) => {
  const [filename, message] = event.payload.split("|");
  updateEvent(fileSelect, filename, file => {
    file.status = "error";
    file.message = message;
  });
});
listen("success", (event: Event<string>) => {
  const [filename, message] = event.payload.split("|");
  updateEvent(fileSelect, filename, file => {
    file.status = "success";
    file.message = message;
  });
});

async function selectFile() {
  const selected = await open({
    multiple: true,
    filters: [
      {
        name: "csv",
        extensions: ["*"]
      }
    ]
  });
  if (Array.isArray(selected)) {
    path.value = selected.join("|").toString();
    const nonEmptyRows = selected.filter((row: any) => row.trim() !== "");
    fileSelect.value = nonEmptyRows.map((file: any) => {
      return { filename: shortFileName(file), status: " " };
    });
  } else if (selected === null) {
    return;
  } else {
    path.value = selected;
  }
}

// invoke count
async function countData() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const rtime: string = await invoke("count", {
      path: path.value,
      mode: mode.value,
      skiprows: skiprows.skiprows
    });
    message(`${mode.value} done, elapsed time: ${rtime} s`, {
      type: "success"
    });
  } catch (err) {
    message(err.toString(), { type: "error" });
  }
  isLoading.value = false;
}
</script>

<template>
  <el-form class="page-container">
    <el-splitter>
      <el-splitter-panel size="200" :resizable="false">
        <div class="splitter-container mr-1">
          <SiliconeButton @click="selectFile()" :icon="FolderOpened" text>
            Open File(s)
          </SiliconeButton>

          <div class="mode-toggle mt-2">
            <span
              v-for="item in modeOptions"
              :key="item.value"
              class="mode-item"
              :class="{
                active: mode === item.value,
                'active-dark': isDark && mode === item.value
              }"
              @click="mode = item.value"
            >
              {{ item.label }}
            </span>
          </div>

          <el-link @click="dialog = true" class="mt-auto" underline="never">
            <SiliconeText class="mb-[1px]">Count</SiliconeText>
          </el-link>
        </div>
      </el-splitter-panel>

      <el-splitter-panel>
        <SiliconeButton
          @click="countData()"
          :loading="isLoading"
          :icon="SwitchButton"
          text
          class="mb-2 ml-1"
        >
          Run
        </SiliconeButton>

        <SiliconeTable
          :data="fileSelect"
          :height="dynamicHeight"
          show-overflow-tooltip
        >
          <el-table-column type="index" width="35" />
          <el-table-column prop="filename" label="File" />
          <el-table-column prop="status" label="Status">
            <template #default="scope">
              <ElIcon v-if="scope.row.status === ''" class="is-loading">
                <Loading />
              </ElIcon>
              <ElIcon
                v-else-if="scope.row.status === 'success'"
                color="#00CD66"
              >
                <Select />
              </ElIcon>
              <ElIcon v-else-if="scope.row.status === 'error'" color="#FF0000">
                <CloseBold />
              </ElIcon>
            </template>
          </el-table-column>
          <el-table-column prop="message" label="Message">
            <template #default="scope">
              <span v-if="scope.row.status === 'error'">
                {{ scope.row.message }}
              </span>
            </template>
          </el-table-column>
        </SiliconeTable>
      </el-splitter-panel>
    </el-splitter>

    <SiliconeDialog
      v-model="dialog"
      title="Count - Count the rows of CSV files"
      width="70%"
    >
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </SiliconeDialog>
  </el-form>
</template>
