<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useQuoting, useSkiprows } from "@/store/modules/options";
import { viewOpenFile } from "@/utils/view";

const path = ref("");
const loading = ref(false);

const emit = defineEmits<{
  (e: 'add-log', message: string, type: string): void
}>();

const addLog = (message: string, type: string = 'info') => {
  emit('add-log', `[Index] ${message}`, type);
};

async function selectFile() {
  path.value = await viewOpenFile(false, "csv", ["*"]);
  if (path.value === null) return;
  addLog(`Selected file: ${path.value}`, 'info');
}

// invoke csv_idx
async function createIndex() {
  if (path.value === "") {
    addLog(`CSV file not selected`, 'warning');
    return;
  }

  try {
    loading.value = true;
    addLog(`Processing file: ${path.value}`, 'info');
    const rtime: string = await invoke("csv_idx", {
      path: path.value,
      quoting: useQuoting().quoting,
      skiprows: useSkiprows().skiprows
    });
    addLog(`Create index done, elapsed time: ${rtime} s`, 'success');
  } catch (e) {
    addLog(`${e}`, 'error');
  }
  loading.value = false;
}

onUnmounted(() => {
  path.value = "";
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <SiliconeCard class="p-4 m-4 rounded-md">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold flex items-center gap-2">
          <Icon icon="ri:rocket-line" />
          Index
        </h1>
        <div class="h-5 w-px bg-gray-300 dark:bg-gray-600" />
        <div class="text-xs font-semibold text-gray-400 tracking-wider">
          Create an index for CSVs
        </div>
      </div>
    </SiliconeCard>

    <div class="flex-1 flex flex-col overflow-y-hidden px-4 pb-4 gap-4 min-h-0">
      <SiliconeCard class="file-section">
        <div class="flex justify-between items-center mb-4">
          <div class="text-xs font-semibold text-gray-400 tracking-wider">
            SELECTED FILE
          </div>
          <div class="flex items-center">
            <SiliconeButton @click="selectFile()" size="small" text>
              <Icon icon="ri:folder-open-line" class="w-4 h-4" />
            </SiliconeButton>
            <SiliconeButton @click="createIndex()" :loading="loading" size="small" text>
              <Icon icon="ri:play-large-line" class="w-4 h-4" />
            </SiliconeButton>
          </div>
        </div>
        <SiliconeText type="info">
          <span v-if="path">{{ path }}</span>
          <span v-else>No file selected. Click <Icon icon="ri:folder-open-line" class="inline align-middle w-4 h-4" /> to select a CSV file</span>
        </SiliconeText>
      </SiliconeCard>

      <SiliconeCard>
        <div class="text-xs font-semibold text-gray-400 tracking-wider mb-4">
          USAGE
        </div>
        <div class="flex flex-col gap-2">
          <SiliconeText type="info">1. Click
              <Icon icon="ri:folder-open-line" class="w-4 h-4 inline align-middle" /> to select CSV files
            </SiliconeText>
          <SiliconeText type="info">2. Click
              <Icon icon="ri:play-large-line" class="w-4 h-4 inline align-middle" /> to create an index for the selected CSV file
            </SiliconeText>
          <SiliconeText type="info">3. Check the output log for details</SiliconeText>
        </div>
      </SiliconeCard>
    </div>
  </div>
</template>

<style scoped>
:deep(.silicone-card) {
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}
</style>
