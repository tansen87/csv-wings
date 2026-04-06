<script setup lang="ts">
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { Icon } from "@iconify/vue";
import { useCommandStore } from "@/store/modules/commands";

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
          <SiliconeInput placeholder="Search for command..." v-model="searchText" />
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
        </el-scrollbar>
      </div>

      <div class="cmd-main-container">
        <div class="cmd-main">
          <component v-for="item in commands" :key="item.route" :is="getComponent(item.route)"
            v-show="activeTab === item.route.split('/').pop()" @add-log="addLog" />
        </div>

        <div class="resize-handle" @mousedown="startResize"></div>

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
  </div>
</template>

<style lang="scss" scoped>
.cmd-container {
  width: 100%;
  height: calc(100vh - 36px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cmd-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.cmd-sidebar {
  width: 200px;
  background-color: #f5f7fa;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 8px 16px;
  border-bottom: 1px solid #e4e7ed;
}

.dark .sidebar-header {
  border-bottom: 1px solid #888585;
  background-color: #706c6c;
}

.commands-list {
  flex: 1;
  background-color: var(--el-fill-color-light);
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.15s ease;
}

.commands-content {
  padding: 8px 0;
}

.cmd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  margin: 0 8px 8px 8px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;

  &:hover {
    background-color: #e9e9e9;
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.2),
      0 2px 5px rgba(0, 0, 0, 0.2);
    transform: translateY(-1px);
  }

  &.active {
    background-color: #d8d7d7;
    color: #000000;
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.2),
      0 2px 5px rgba(0, 0, 0, 0.2);
  }
}

.cmd-main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cmd-main {
  flex: 1;
  overflow: auto;
  background-color: #f5f7fa;
}

.dark .cmd-main {
  background-color: #5c5959;
}

.resize-handle {
  height: 4px;
  background-color: #e4e7ed;
  cursor: ns-resize;
  transition: background-color 0.3s;

  &:hover {
    background-color: #409eff;
  }
}

.log-output {
  background-color: #f5f7fa;
  border-top: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 100px;
}

.log-header {
  padding: 8px 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: white;

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }
}

.log-content {
  flex: 1;
  padding: 16px;
}

.log-item {
  margin-bottom: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;

  &.info {
    background-color: #ecf5ff;
    color: #409eff;
  }

  &.success {
    background-color: #f0f9eb;
    color: #67c23a;
  }

  &.error {
    background-color: #fef0f0;
    color: #f56c6c;
  }

  &.warning {
    background-color: #fdf6ec;
    color: #e6a23c;
  }
}

.log-time {
  font-weight: 600;
  margin-right: 8px;
  color: #909399;
}

.log-message {
  word-break: break-all;
}

.dark .log-output {
  background-color: #1f1f1f;
  border-top: 1px solid #303030;
}

.dark .log-header {
  border-bottom: 1px solid #303030;
  background-color: #303030;

  h3 {
    color: #e0e0e0;
  }
}

.dark .log-item {
  &.info {
    background-color: #1a2b47;
    color: #66b1ff;
  }

  &.success {
    background-color: #223a1f;
    color: #85ce61;
  }

  &.error {
    background-color: #471a1a;
    color: #f78989;
  }

  &.warning {
    background-color: #47331a;
    color: #ebb563;
  }
}

.dark .log-time {
  color: #707070;
}
</style>
