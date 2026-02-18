<script setup lang="ts">
import { getCurrentWindow } from "@tauri-apps/api/window";
import Setting from "@iconify-icons/ri/settings-3-line";
import Sun from "@iconify-icons/ri/sun-line";
import Moon from "@iconify-icons/ri/moon-line";
import Subtract from "@iconify-icons/ri/subtract-line";
import Fullscreen from "@iconify-icons/ri/fullscreen-line";
import FullscreenExit from "@iconify-icons/ri/fullscreen-exit-line";
import Close from "@iconify-icons/ri/close-line";
import { useNav } from "@/layout/hooks/useNav";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { onMounted, onUnmounted, ref } from "vue";
import { listen } from "@tauri-apps/api/event";

const { onPanel } = useNav();
const { dataTheme, dataThemeChange } = useDataThemeChange();
const appWindow = getCurrentWindow();
const isMaximized = ref(false);

function themeChange() {
  dataTheme.value = !dataTheme.value;
  dataThemeChange();
}

const minimize = async () => {
  await appWindow.minimize();
};
const maximize = async () => {
  await appWindow.toggleMaximize();
  isMaximized.value = await appWindow.isMaximized();
};
const close = async () => {
  await appWindow.close();
};
const titileDblClick = async () => {
  await appWindow.toggleMaximize();
  isMaximized.value = await appWindow.isMaximized();
};

let unlistenResize: (() => void) | null = null;
onMounted(async () => {
  isMaximized.value = await appWindow.isMaximized();
  unlistenResize = await listen("tauri://resize", async () => {
    isMaximized.value = await appWindow.isMaximized();
  });
});
onUnmounted(() => {
  unlistenResize?.();
});
</script>

<template>
  <div
    class="navbar bg-[#fff] shadow-sm shadow-[rgba(0, 21, 41, 0.08)] dark:shadow-[#0d0d0d]"
  >
    <div class="titlebar-overlay" @dblclick="titileDblClick" />
    <div class="vertical-header-right">
      <SiliconeLink @click="themeChange" class="set-icon">
        <IconifyIconOffline v-if="dataTheme" :icon="Moon" />
        <IconifyIconOffline v-else :icon="Sun" />
      </SiliconeLink>
      <SiliconeLink @click="onPanel" class="set-icon">
        <IconifyIconOffline :icon="Setting" />
      </SiliconeLink>
      <SiliconeLink @click="minimize" class="set-icon">
        <IconifyIconOffline :icon="Subtract" />
      </SiliconeLink>
      <SiliconeLink @click="maximize" class="set-icon">
        <IconifyIconOffline :icon="isMaximized ? FullscreenExit : Fullscreen" />
      </SiliconeLink>
      <SiliconeLink @click="close" class="set-icon">
        <IconifyIconOffline :icon="Close" />
      </SiliconeLink>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.navbar {
  width: 100%;
  height: 36px;

  .titlebar-overlay {
    position: absolute;
    top: 0;
    left: 0;
    // 宽度减去按钮区域
    width: calc(100% - 200px);
    height: 100%;
    z-index: 10;
    background: transparent;
    -webkit-app-region: drag;
    cursor: default;
  }

  .vertical-header-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 36px;
  }
}
</style>
