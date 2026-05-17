<script setup lang="ts">
import "animate.css";
// 引入 src/components/ReIcon/src/offlineIcon.ts 文件中所有使用addIcon添加过的本地图标
import "@/components/ReIcon/src/offlineIcon";
import { useSettingStoreHook } from "@/store/modules/settings";
import { h, reactive, computed, defineComponent } from "vue";

import appMain from "./components/appMain.vue";
import setting from "./components/setting/index.vue";
import backTop from "@/assets/svg/back_top.svg?component";

const pureSetting = useSettingStoreHook();

const set = reactive({
  fixedHeader: computed(() => {
    return pureSetting.fixedHeader;
  })
});

const layoutHeader = defineComponent({
  render() {
    return h(
      "div",
      {
        class: { "fixed-header": set.fixedHeader },
        style: []
      },
      {
        default: () => []
      }
    );
  }
});
</script>

<template>
  <div class="app-wrapper">
    <div class="main-container">
      <div v-if="set.fixedHeader">
        <layout-header />
        <app-main :fixed-header="set.fixedHeader" />
      </div>
      <el-scrollbar v-else>
        <el-backtop
          title="回到顶部"
          target=".main-container .el-scrollbar__wrap"
        >
          <backTop />
        </el-backtop>
        <layout-header />
        <app-main :fixed-header="set.fixedHeader" />
      </el-scrollbar>
    </div>
    <setting />
  </div>
</template>

<style lang="scss" scoped>
.app-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
