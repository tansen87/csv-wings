<script setup lang="ts">
import { ref } from "vue";
import { Document } from "@element-plus/icons-vue";
import TextView from "./largeTextView.vue";
import CsvView from "./csvView.vue";
import { viewOpenFile } from "@/utils/view";
import { useFileView } from "@/store/modules/fileView";

const fileView = useFileView();
const viewMode = ref("text");
const viewOpts = [
  { label: "Text", value: "text" },
  { label: "CSV", value: "csv" }
];

async function openFile() {
  try {
    const path = await viewOpenFile(false, "text/csv", ["*"]);
    if (path) {
      fileView.openFile(path);
    }
  } catch (error) {
    console.warn("Open file cancelled or failed:", error);
  }
}
</script>

<template>
  <div>
    <el-empty v-if="!fileView.currentPath" :image-size="180">
      <template #image>
        <el-icon :size="180" color="#909399"><Document /></el-icon>
      </template>

      <template #description>
        <el-form class="mode-toggle-v w-35 mb-4 h-8">
          <span
            v-for="item in viewOpts"
            :key="item.value"
            class="mode-item"
            :class="{ active: viewMode === item.value }"
            @click="viewMode = item.value"
          >
            {{ item.label }}
          </span>
        </el-form>
        <SiliconeButton text @click="openFile" type="success">
          Open {{ viewMode }} File
        </SiliconeButton>
      </template>
    </el-empty>

    <TextView
      v-if="viewMode === 'text' && fileView.currentPath"
      :path="String(fileView.currentPath)"
    />

    <CsvView
      v-else-if="viewMode === 'csv' && fileView.currentPath"
      :path="String(fileView.currentPath)"
    />
  </div>
</template>
