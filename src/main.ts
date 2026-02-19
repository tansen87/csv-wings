import App from "./App.vue";
import router from "./router";
import { setupStore } from "@/store";
import ElementPlus from "element-plus";
import { getServerConfig } from "./config";
import { createApp, Directive } from "vue";
import { MotionPlugin } from "@vueuse/motion";
import { injectResponsiveStorage } from "@/utils/responsive";

// 引入重置样式
import "./style/reset.scss";
// 导入公共样式
import "./style/index.scss";
// 一定要在main.ts中导入tailwind.css，防止vite每次hmr都会请求src/style/index.scss整体css文件导致热更新慢的问题
import "./style/tailwind.css";
import "element-plus/dist/index.css";
// 导入字体图标
import "./assets/iconfont/iconfont.js";
import "./assets/iconfont/iconfont.css";

import "./style/silicone-message.scss";
import "./style/silicone-messagebox.scss";

const app = createApp(App);

// 自定义指令
import * as directives from "@/directives";
Object.keys(directives).forEach(key => {
  app.directive(key, (directives as { [key: string]: Directive })[key]);
});

// 全局注册`@iconify/vue`图标库
import {
  IconifyIconOffline,
  IconifyIconOnline,
  FontIcon
} from "./components/ReIcon";
app.component("IconifyIconOffline", IconifyIconOffline);
app.component("IconifyIconOnline", IconifyIconOnline);
app.component("FontIcon", FontIcon);

// 全局注册自定义组件样式
import SiliconeButton from "@/layout/silicone/siliconeButton.vue";
import SiliconeSelect from "@/layout/silicone/siliconeSelect.vue";
import SiliconeInput from "@/layout/silicone/siliconeInput.vue";
import SiliconeProgress from "@/layout/silicone/siliconeProgress.vue";
import SiliconeTable from "@/layout/silicone/siliconeTable.vue";
import SiliconeInputNumber from "@/layout/silicone/siliconeInputNumber.vue";
import SiliconeText from "@/layout/silicone/siliconeText.vue";
import SiliconeCard from "@/layout/silicone/siliconeCard.vue";
import SiliconeSwitch from "@/layout/silicone/siliconeSwitch.vue";
import SiliconeDialog from "@/layout/silicone/siliconeDialog.vue";
import SiliconeLink from "@/layout/silicone/siliconeLink.vue";
import SiliconeTooltip from "@/layout/silicone/siliconeTooltip.vue";
import SiliconeTag from "@/layout/silicone/siliconeTag.vue";
app.component("SiliconeButton", SiliconeButton);
app.component("SiliconeSelect", SiliconeSelect);
app.component("SiliconeInput", SiliconeInput);
app.component("SiliconeProgress", SiliconeProgress);
app.component("SiliconeTable", SiliconeTable);
app.component("SiliconeInputNumber", SiliconeInputNumber);
app.component("SiliconeText", SiliconeText);
app.component("SiliconeCard", SiliconeCard);
app.component("SiliconeSwitch", SiliconeSwitch);
app.component("SiliconeDialog", SiliconeDialog);
app.component("SiliconeLink", SiliconeLink);
app.component("SiliconeTooltip", SiliconeTooltip);
app.component("SiliconeTag", SiliconeTag);

// 全局注册按钮级别权限组件
import { Auth } from "@/components/ReAuth";
app.component("Auth", Auth);

getServerConfig(app).then(async config => {
  app.use(router);
  await router.isReady();
  injectResponsiveStorage(app, config);
  setupStore(app);
  app.use(MotionPlugin).use(ElementPlus);

  app.mount("#app");
});

// 禁用鼠标右键
window.addEventListener("contextmenu", e => e.preventDefault());

// input textarea可以输入空格
document.addEventListener(
  "keydown",
  e => {
    // 只处理聚焦在可编辑元素上的空格键
    const target = e.target as HTMLElement;
    if (
      e.code === "Space" &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true")
    ) {
      e.stopPropagation(); // 阻止冒泡到 WebView/Tauri 层
    }
  },
  true
);
