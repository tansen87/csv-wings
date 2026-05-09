<script setup lang="ts">
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { Icon } from "@iconify/vue";
import { useCommandStore } from "@/store/modules/commands";
import { useDark } from "@pureadmin/utils";
import { emitter } from "@/utils/mitt";
import setting from "@/layout/components/setting/index.vue";

import Apply from "./components/apply.vue";
import Cat from "./components/cat.vue";
import Convert from "./components/convert.vue";
import Count from "./components/count.vue";
import Datefmt from "./components/datefmt.vue";
import Dedup from "./components/dedup.vue";
import EnumerByGroup from "./components/enumerByGroup.vue";
import Enumerate from "./components/enumerate.vue";
import Fill from "./components/fill.vue";
import Idx from "./components/idx.vue";
import Insert from "./components/insert.vue";
import Join from "./components/join.vue";
import Pinyin from "./components/pinyin.vue";
import Rename from "./components/rename.vue";
import Replace from "./components/replace.vue";
import Reverse from "./components/reverse.vue";
import Search from "./components/search.vue";
import SearchChain from "./components/searchChain.vue";
import Select from "./components/select.vue";
import Separate from "./components/separate.vue";
import Skip from "./components/skip.vue";
import Slice from "./components/slice.vue";
import Sort from "./components/sort.vue";
import Split from "./components/split.vue";
import StringComp from "./components/string.vue";
import Transpose from "./components/transpose.vue";
import Traverse from "./components/traverse.vue";

const commandStore = useCommandStore();
const { commands } = storeToRefs(commandStore);
const searchText = ref("");
const activeTab = ref(commands.value[0]?.route.split('/').pop() || 'idx');
const logHeight = ref(200);
const isResizing = ref(false);

const { isDark, toggleDark } = useDark();

// Logs state
const logs = ref([]);

const filteredCommands = computed(() => {
  return commands.value.filter(command =>
    command.title.toLowerCase().includes(searchText.value.toLowerCase())
  );
});

// Map route names to components
const componentMap = {
  apply: Apply,
  cat: Cat,
  convert: Convert,
  count: Count,
  datefmt: Datefmt,
  dedup: Dedup,
  enumerByGroup: EnumerByGroup,
  enumerate: Enumerate,
  fill: Fill,
  idx: Idx,
  insert: Insert,
  join: Join,
  pinyin: Pinyin,
  rename: Rename,
  replace: Replace,
  reverse: Reverse,
  search: Search,
  searchChain: SearchChain,
  select: Select,
  separate: Separate,
  skip: Skip,
  slice: Slice,
  sort: Sort,
  split: Split,
  string: StringComp,
  transpose: Transpose,
  traverse: Traverse
};

// Get component by route name
const getComponent = (route) => {
  const routeName = route.split('/').pop();
  return componentMap[routeName];
};

// Log management functions
const addLog = (message: string, type = 'info') => {
  const time = new Date().toLocaleTimeString();
  logs.value.push({ message, type, time });
};

const clearLog = () => {
  logs.value = [];
};

// Resize functions
const startResize = (e) => {
  isResizing.value = true;
  e.preventDefault();
  e.stopPropagation();

  const startY = e.clientY;
  const startHeight = logHeight.value;

  const handleMouseMove = (e) => {
    if (!isResizing.value) return;

    const deltaY = e.clientY - startY;
    const newHeight = Math.max(100, startHeight - deltaY);
    logHeight.value = newHeight;
  };

  const handleMouseUp = () => {
    isResizing.value = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};
</script>

<template>
  <div class="cmd-container">
    <div class="cmd-content">
      <div class="cmd-sidebar">
        <div class="sidebar-header">
          <div class="header-content">
            <SiliconeInput placeholder="Search command" v-model="searchText" />
          </div>
        </div>
        <el-scrollbar class="commands-list">
          <div class="commands-content">
            <div v-for="item in filteredCommands" :key="item.route" class="cmd-item"
              :class="{ active: activeTab === item.route.split('/').pop() }"
              @click="activeTab = item.route.split('/').pop()">
              <Icon :icon="item.icon" width="16" height="16" />
              <span>{{ item.title }}</span>
            </div>
          </div>
          <div class="bottom-controls">
            <div class="theme-toggle" @click="toggleDark">
              <Icon :icon="isDark ? 'icon-park-outline:sun' : 'icon-park-outline:moon'" width="20" height="20" />
            </div>
            <div class="setting-item" @click="emitter.emit('openPanel', '')">
              <Icon icon="ri:settings-2-line" width="20" height="20" />
            </div>
          </div>
        </el-scrollbar>
      </div>

      <div class="cmd-main-container">
        <div class="cmd-main">
          <component v-for="item in commands" :key="item.route" :is="getComponent(item.route)"
            v-show="activeTab === item.route.split('/').pop()" @add-log="addLog" />
        </div>

        <div class="resize-handle" @mousedown="startResize" />

        <div class="log-output" :style="{ height: logHeight + 'px' }">
          <div class="log-header">
            <h3>Logs</h3>
            <SiliconeButton size="small" @click="clearLog" type="danger">Clear</SiliconeButton>
          </div>
          <el-scrollbar class="log-content">
            <div v-for="(log, index) in logs" :key="index" class="log-item" :class="log.type">
              <span class="log-time">{{ log.time }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </el-scrollbar>
        </div>
      </div>
    </div>
    <!-- 系统设置 -->
    <setting />
  </div>
</template>

<style lang="scss" scoped>
:root {
  --primary-color: #6366f1;
  --primary-hover: #4f46e5;
  --primary-light: #eef2ff;
  --success-color: #10b981;
  --success-light: #d1fae5;
  --warning-color: #f59e0b;
  --warning-light: #fef3c7;
  --error-color: #ef4444;
  --error-light: #fee2e2;
  --info-color: #3b82f6;
  --info-light: #dbeafe;
  
  --card-bg: #ffffff;
  --card-border: #e5e7eb;
  --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  --card-shadow-hover: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  
  --sidebar-bg: #f8fafc;
  --sidebar-item-hover: #f1f5f9;
  --sidebar-item-active: #eef2ff;
  
  --dark-card-bg: #1e293b;
  --dark-card-border: #334155;
  --dark-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
  --dark-sidebar-bg: #0f172a;
  --dark-sidebar-item-hover: #1e293b;
  --dark-sidebar-item-active: #312e81;
}

.cmd-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.dark .cmd-container {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.cmd-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
  padding: 12px;
  gap: 12px;
}

.cmd-sidebar {
  width: 220px;
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: var(--card-shadow);
  border: 1px solid var(--card-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    box-shadow: var(--card-shadow-hover);
  }
}

.dark .cmd-sidebar {
  background: var(--dark-card-bg);
  border-color: var(--dark-card-border);
  box-shadow: var(--dark-card-shadow);
}

.sidebar-header {
  padding: 16px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.commands-list {
  flex: 1;
  background: var(--sidebar-bg);
  overflow: hidden;
}

.dark .commands-list {
  background: var(--dark-sidebar-bg);
}

.commands-content {
  padding: 8px;
  padding-bottom: 72px;
}

.commands-list {
  position: relative;
}

.bottom-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background: var(--card-bg);
  border-top: 1px solid var(--card-border);
}

.dark .bottom-controls {
  background: var(--dark-card-bg);
  border-top-color: var(--dark-card-border);
}

.theme-toggle, .setting-item {
  cursor: pointer;
  padding: 10px;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--el-text-color-regular);
  background: transparent;

  &:hover {
    background: var(--sidebar-item-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.dark .theme-toggle:hover, .dark .setting-item:hover {
  background: var(--dark-sidebar-item-hover);
}

.cmd-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  background: transparent;

  &:hover {
    background: var(--sidebar-item-hover);
    transform: translateX(4px);
  }

  &.active {
    background-color: #d8d7d7;
    color: #000000;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  svg {
    transition: all 0.25s ease;
    flex-shrink: 0;
  }
}

.dark .cmd-item {
  &:hover {
    background: var(--dark-sidebar-item-hover);
  }

  &.active {
    background-color: #b3aaaa;
    color: #ffffff;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
}

.cmd-main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 0;
}

.cmd-main {
  flex: 1;
  overflow: auto;
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: var(--card-shadow);
  border: 1px solid var(--card-border);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    box-shadow: var(--card-shadow-hover);
  }
}

.dark .cmd-main {
  background: var(--dark-card-bg);
  border-color: var(--dark-card-border);
  box-shadow: var(--dark-card-shadow);
}

.resize-handle {
  height: 8px;
  cursor: ns-resize;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 4px;
    background: linear-gradient(90deg, transparent 0%, #cbd5e1 30%, #cbd5e1 70%, transparent 100%);
    border-radius: 2px;
    transition: all 0.2s ease;
  }

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 50px;
    height: 4px;
    background: repeating-linear-gradient(
      90deg,
      #64748b 0px,
      #64748b 2px,
      transparent 2px,
      transparent 6px
    );
    border-radius: 2px;
    opacity: 0.8;
    transition: all 0.2s ease;
  }

  &:hover::before {
    height: 8px;
    background: linear-gradient(90deg, transparent 0%, var(--primary-color) 30%, var(--primary-color) 70%, transparent 100%);
  }

  &:hover::after {
    background: repeating-linear-gradient(
      90deg,
      #334155 0px,
      #334155 2px,
      transparent 2px,
      transparent 6px
    );
    opacity: 1;
    width: 70px;
  }
}

.dark .resize-handle::before {
  background: linear-gradient(90deg, transparent 0%, #475569 30%, #475569 70%, transparent 100%);
}

.dark .resize-handle::after {
  background: repeating-linear-gradient(
    90deg,
    #94a3b8 0px,
    #94a3b8 2px,
    transparent 2px,
    transparent 6px
  );
  opacity: 0.8;
}

.dark .resize-handle:hover::before {
  background: linear-gradient(90deg, transparent 0%, var(--primary-color) 30%, var(--primary-color) 70%, transparent 100%);
}

.dark .resize-handle:hover::after {
  background: repeating-linear-gradient(
    90deg,
    #ffffff 0px,
    #ffffff 2px,
    transparent 2px,
    transparent 6px
  );
  opacity: 1;
}

.log-output {
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: var(--card-shadow);
  border: 1px solid var(--card-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &:hover {
    box-shadow: var(--card-shadow-hover);
  }
}

.dark .log-output {
  background: var(--dark-card-bg);
  border-color: var(--dark-card-border);
  box-shadow: var(--dark-card-shadow);
}

.log-header {
  padding: 6px 10px;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 16px 16px 0 0;

  h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.dark .log-header {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);

  h3 {
    color: #f1f5f9;
  }
}

.log-content {
  flex: 1;
  padding: 4px;
  overflow-y: auto;
}

.log-item {
  margin-bottom: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.3s ease;
  border-left: 4px solid transparent;

  &:hover {
    transform: translateX(4px);
  }

  &.info {
    background: #dbeafe;
    color: #3b82f6;
    border-left-color: #3b82f6;
  }

  &.success {
    background: #d1fae5;
    color: #10b981;
    border-left-color: #10b981;
  }

  &.error {
    background: #fee2e2;
    color: #ef4444;
    border-left-color: #ef4444;
  }

  &.warning {
    background: #fef3c7;
    color: #f59e0b;
    border-left-color: #f59e0b;
  }
}

.dark .log-item {
  &.info {
    background: rgba(59, 130, 246, 0.15);
    color: #93c5fd;
    border-left-color: #3b82f6;
  }

  &.success {
    background: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    border-left-color: #10b981;
  }

  &.error {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
    border-left-color: #ef4444;
  }

  &.warning {
    background: rgba(245, 158, 11, 0.15);
    color: #fcd34d;
    border-left-color: #f59e0b;
  }
}

.log-time {
  font-weight: 600;
  margin-right: 12px;
  opacity: 0.7;
  font-size: 12px;
}

.log-message {
  word-break: break-all;
  line-height: 1.5;
}
</style>
