<script setup lang="ts">
import { ref } from "vue";
import { open, save } from "@tauri-apps/plugin-dialog";
import { appConfigDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpened, SwitchButton } from "@element-plus/icons-vue";
import { message } from "@/utils/message";

const folderPath = ref("");
const [isLoading, isPath] = [ref(false), ref(false)];

async function selectFolder() {
  isPath.value = false;

  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: await appConfigDir()
  });
  if (Array.isArray(selected)) {
    folderPath.value = selected.toString();
  } else if (selected === null) {
    return;
  } else {
    folderPath.value = selected;
  }
  isPath.value = true;
}

// invoke traverse
async function traverseDirectory() {
  if (folderPath.value === "") {
    message("No folder selected", { type: "warning" });
    return;
  }

  const output = await save({
    title: "Export",
    defaultPath: `filename_${new Date().getTime()}.xlsx`,
    filters: [{ name: "Excel", extensions: ["xlsx"] }]
  });
  if (output === "" || output === null) {
    message("No file saved selected", { type: "warning" });
    return;
  }

  try {
    isLoading.value = true;
    const result: string = await invoke("traverse", {
      folderPath: folderPath.value,
      output: output
    });
    message(`${result}`, { type: "success" });
  } catch (err) {
    message(err.toString(), { type: "error", duration: 10000 });
  }
  isLoading.value = false;
}
</script>

<template>
  <el-form class="page-container">
    <div class="splitter-container">
      <div class="custom-container2">
        <SiliconeButton @click="selectFolder()" :icon="FolderOpened" text>
          Open Folder
        </SiliconeButton>

        <SiliconeButton
          @click="traverseDirectory()"
          :loading="isLoading"
          :icon="SwitchButton"
          text
          >Run
        </SiliconeButton>
      </div>
      <SiliconeText class="mt-2">
        <span v-if="isPath">{{ folderPath }}</span>
        <span v-else>Traverse the directory to obtain filenames</span>
      </SiliconeText>
    </div>
  </el-form>
</template>
