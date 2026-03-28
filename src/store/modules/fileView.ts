import { defineStore } from "pinia";
import { ref } from "vue";

export const useFileView = defineStore("file-view", () => {
  const currentPath = ref<string | null>(null);

  function openFile(path: string) {
    currentPath.value = path;
  }

  function closeFile() {
    currentPath.value = null;
  }

  return {
    currentPath,
    openFile,
    closeFile
  };
});
