<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import {
  FolderOpened,
  Loading,
  Select,
  CloseBold,
  SwitchButton
} from "@element-plus/icons-vue";
import { useDynamicHeight, updateEvent } from "@/utils/utils";
import { message } from "@/utils/message";
import { trimOpenFile } from "@/utils/view";
import { useMarkdown, mdSkip } from "@/utils/markdown";
import { useProgress } from "@/store/modules/options";

const path = ref("");
const fileSelect = ref([]);
const skipRows = ref("1");
const [dialog, isLoading] = [ref(false), ref(false)];
const { dynamicHeight } = useDynamicHeight(82);
const { mdShow } = useMarkdown(mdSkip);
const progress = useProgress();

listen("update-msg", (event: Event<string>) => {
  const [filename, rows] = event.payload.split("|");
  updateEvent(fileSelect, filename, file => {
    file.currentRows = rows;
  });
});
listen("total-msg", (event: Event<string>) => {
  const [filename, rows] = event.payload.split("|");
  console.log(rows);
  updateEvent(fileSelect, filename, file => {
    file.totalRows = rows;
  });
});
listen("info", (event: Event<string>) => {
  const filename = event.payload;
  updateEvent(fileSelect, filename, file => {
    file.status = "loading";
  });
});
listen("err", (event: Event<string>) => {
  const [filename, message] = event.payload.split("|");
  updateEvent(fileSelect, filename, file => {
    file.status = "error";
    file.message = message;
  });
  isLoading.value = false;
});
listen("success", (event: Event<string>) => {
  const filename = event.payload;
  updateEvent(fileSelect, filename, file => {
    file.status = "success";
  });
});

async function selectFile() {
  fileSelect.value = [];
  const trimFile = await trimOpenFile(true, "csv", ["*"], {
    includeStatus: true
  });
  path.value = trimFile.filePath;
  fileSelect.value = trimFile.fileInfo;
}

// invoke skip
async function skipLines() {
  if (path.value === "") {
    message("CSV file not selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const result: string = await invoke("skip", {
      path: path.value,
      skipRows: skipRows.value,
      progress: progress.progress
    });
    message(`Skip done, elapsed time: ${result} s`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error", duration: 10000 });
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
            Open File(s)
          </SiliconeButton>

          <el-tooltip content="skip rows" effect="light" placement="right">
            <SiliconeInput v-model="skipRows" class="mt-2" />
          </el-tooltip>

          <el-link @click="dialog = true" class="mt-auto" underline="never">
            <SiliconeText class="mb-[1px]">Skip</SiliconeText>
          </el-link>
        </div>
      </el-splitter-panel>

      <el-splitter-panel>
        <SiliconeButton
          @click="skipLines()"
          :loading="isLoading"
          :icon="SwitchButton"
          text
          class="mb-2"
          >Run
        </SiliconeButton>

        <SiliconeTable
          :data="fileSelect"
          :height="dynamicHeight"
          show-overflow-tooltip
          tooltip-effect="light"
        >
          <el-table-column type="index" width="35" />
          <el-table-column prop="filename" label="File" />
          <el-table-column prop="status" label="Status" width="70">
            <template #default="scope">
              <ElIcon v-if="scope.row.status === 'loading'" class="is-loading">
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
              <SiliconeProgress
                v-if="
                  scope.row.totalRows !== 0 &&
                  isFinite(scope.row.currentRows / scope.row.totalRows)
                "
                :percentage="
                  Math.round(
                    (scope.row.currentRows / scope.row.totalRows) * 100
                  )
                "
              />
            </template>
          </el-table-column>
        </SiliconeTable>
      </el-splitter-panel>
    </el-splitter>

    <el-dialog v-model="dialog" title="Skip - Skip rows from CSV" width="70%">
      <el-scrollbar :height="dynamicHeight * 0.7">
        <div v-html="mdShow" />
      </el-scrollbar>
    </el-dialog>
  </el-form>
</template>
