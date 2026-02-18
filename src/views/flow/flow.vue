<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import {
  VueFlow,
  useVueFlow,
  type Connection,
  MarkerType,
  type Node,
  type Edge
} from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import "@vue-flow/core/dist/style.css";
import {
  Plus,
  Delete,
  Download,
  Upload,
  SwitchButton,
  CircleCheckFilled,
  CircleCloseFilled,
  WarningFilled,
  ArrowUp
} from "@element-plus/icons-vue";
import SelectNode from "@/views/flow/components/selectNode.vue";
import FilterNode from "@/views/flow/components/filterNode.vue";
import StringNode from "@/views/flow/components/stringNode.vue";
import RenameNode from "@/views/flow/components/renameNode.vue";
import InputNode from "@/views/flow/components/inputNode.vue";
import {
  getExecutionConfig,
  isValidExecutionPath,
  useFilter,
  usePath,
  useRename,
  useSelect,
  useStr,
  useInput,
  useHeaders
} from "@/store/modules/flow";
import { nanoid } from "nanoid";
import { useWorkflowStore } from "@/store/modules/workflow";
import { useWorkflowManager } from "@/utils/workflowManager";
import { message } from "@/utils/message";
import { invoke } from "@tauri-apps/api/core";
import { useQuoting, useSkiprows } from "@/store/modules/options";

const isLoading = ref(false);
const validationExpanded = ref(true);
const nodeTypes = ["start", "select", "filter", "str", "rename"];
const customNodeTypes = {
  select: SelectNode,
  filter: FilterNode,
  str: StringNode,
  rename: RenameNode,
  start: InputNode
};
const vueFlowRef = ref();
const workflowStore = useWorkflowStore();
const pathStore = usePath();
const headerStore = useHeaders();
const filterStore = useFilter();
const selectStore = useSelect();
const strStore = useStr();
const renameStore = useRename();
const inputStore = useInput();
const quoting = useQuoting();
const skiprows = useSkiprows();

const { getNodes, getEdges } = useVueFlow();

const initialNodes = computed(() => {
  if (!workflowStore.currentId) return [];
  return workflowStore.getWorkflowData(workflowStore.currentId)?.nodes || [];
});

const initialEdges = computed(() => {
  if (!workflowStore.currentId) return [];
  return workflowStore.getWorkflowData(workflowStore.currentId)?.edges || [];
});

interface ValidationError {
  type: "error" | "warning";
  code: string;
  message: string;
}

const validationResults = computed<ValidationError[]>(() => {
  const errors: ValidationError[] = [];
  const nodes = initialNodes.value;
  const edges = initialEdges.value;

  // 检查start节点数量
  const startNodes = nodes.filter(n => n.type === "start");

  if (startNodes.length === 0) {
    errors.push({
      type: "error",
      code: "no_start",
      message: "工作流必须包含一个start节点"
    });
  } else if (startNodes.length > 1) {
    errors.push({
      type: "error",
      code: "multi_start",
      message: `工作流只能有一个start节点,当前找到 ${startNodes.length} 个`
    });
  }

  // 检查start节点是否有输出连接
  if (startNodes.length === 1) {
    const startId = startNodes[0].id;
    const hasOutput = edges.some(e => e.source === startId);

    if (!hasOutput) {
      errors.push({
        type: "error",
        code: "start_no_output",
        message: "Start节点未连接到其他节点"
      });
    }
  }

  // 检查悬空的边(连接的节点不存在)
  const nodeIds = new Set(nodes.map(n => n.id));
  edges.forEach(edge => {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        type: "error",
        code: "invalid_edge_source",
        message: `边 ${edge.id} 的源节点不存在`
      });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        type: "error",
        code: "invalid_edge_target",
        message: `边 ${edge.id} 的目标节点不存在`
      });
    }
  });

  // 检查孤立节点(非start节点没有输入连接)
  const connectedTargetIds = new Set(edges.map(e => e.target));
  nodes.forEach(node => {
    if (node.type === "start") return;

    if (!connectedTargetIds.has(node.id)) {
      errors.push({
        type: "warning",
        code: "node_no_input",
        message: `节点 "${node.data?.label || node.type}" 没有输入连接`
      });
    }
  });

  return errors;
});

const hasErrors = computed(() =>
  validationResults.value.some(e => e.type === "error")
);
const hasWarnings = computed(() =>
  validationResults.value.some(e => e.type === "warning")
);
const errorCount = computed(
  () => validationResults.value.filter(e => e.type === "error").length
);
const warningCount = computed(
  () => validationResults.value.filter(e => e.type === "warning").length
);

const statusClass = computed(() => {
  if (hasErrors.value) return "status-error";
  if (hasWarnings.value) return "status-warning";
  return "status-success";
});

const statusIcon = computed(() => {
  if (hasErrors.value) return CircleCloseFilled;
  if (hasWarnings.value) return WarningFilled;
  return CircleCheckFilled;
});

const statusText = computed(() => {
  if (hasErrors.value) return `${errorCount.value} errors`;
  if (hasWarnings.value) return `${warningCount.value} warnings`;
  return "Verified";
});

const onDragStart = (event: DragEvent, type: string) => {
  event.dataTransfer?.setData("application/vueflow", type);
  event.dataTransfer.effectAllowed = "move";
};

const onDragOver = (event: DragEvent) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
};

const onDrop = (event: DragEvent) => {
  event.preventDefault();
  const vueFlow = vueFlowRef.value;
  if (!vueFlow || !workflowStore.currentId) return;

  const type = event.dataTransfer?.getData("application/vueflow");
  if (!type || !nodeTypes.includes(type)) return;

  const position = vueFlow.project({ x: event.offsetX, y: event.offsetY });

  const newNode: Node = {
    id: nanoid(),
    type,
    position,
    data: { label: `${type} Node` }
  };

  workflowStore.addNode(newNode);
};

function handleConnect(connection: Connection) {
  if (!connection.source || !connection.target) return;
  if (connection.source === connection.target) return;

  const newEdge: Edge = {
    id: nanoid(),
    ...connection,
    markerEnd: {
      type: MarkerType.Arrow,
      color: "#666",
      width: 20,
      height: 20
    }
  };

  workflowStore.addEdge(newEdge);
}

function loadCurrentWorkflow() {}

const { createWorkflow, deleteWorkflow, exportWorkflow, importWorkflow } =
  useWorkflowManager(loadCurrentWorkflow);

onMounted(() => {
  if (workflowStore.list.length === 0) {
    workflowStore.create("Default");
  }
});

async function runWorkflow() {
  if (hasErrors.value) {
    message("工作流存在错误,无法运行", { type: "error" });
    validationExpanded.value = true;
    return;
  }

  if (hasWarnings.value) {
    message(`工作流有 ${warningCount.value} 个警告`, { type: "warning" });
  }

  try {
    isLoading.value = true;

    const nodes: Node[] = getNodes.value;
    const edges: Edge[] = getEdges.value;

    const { isValid, reason } = isValidExecutionPath(nodes, edges);

    if (!isValid) {
      let msg = "Invalid flow configuration.";
      switch (reason) {
        case "no_start":
          msg = "Flow muststartwith exactly one <Start> node.";
          break;
        case "multi_start":
          msg = "Flow must have only one <Start> node. Multiple found.";
          break;
        case "no_path":
          msg = "No valid execution path from <Start>.";
          break;
        default:
          msg = "Flow validation failed.";
      }
      message(msg, { type: "warning" });
      isLoading.value = false;
      return;
    }

    // 从当前 workflow 的start节点获取路径
    const startNode = nodes.find(n => n.type === "start");
    let filePath = "";

    if (startNode?.id) {
      const inputData = inputStore.getInput(startNode.id);
      if (inputData?.path && inputData?.isPath) {
        filePath = inputData.path;
      }
    }

    if (!filePath) {
      filePath = pathStore.path;
    }

    if (!filePath) {
      message("CSV file not selected", { type: "warning" });
      isLoading.value = false;
      return;
    }

    const config = getExecutionConfig(nodes, edges, {
      selectStore,
      filterStore,
      strStore,
      renameStore
    });

    const jsonConfig = JSON.stringify(config);
    const rtime: string = await invoke("flow", {
      path: filePath,
      jsonConfig: jsonConfig,
      quoting: quoting.quoting,
      skiprows: skiprows.skiprows
    });
    isLoading.value = false;
    message(`Flow done, elapsed time: ${rtime} s`, { type: "success" });
  } catch (err) {
    isLoading.value = false;
    message(err.toString(), { type: "error" });
  }
}

async function onWorkflowChange(workflowId: string) {
  workflowStore.currentId = workflowId;

  // 等待 nextTick 让 VueFlow 渲染新节点
  await nextTick();

  // 找到新 workflow 的start节点
  const nodes = vueFlowRef.value?.getNodes() || [];
  const startNode = nodes.find((n: Node) => n.type === "start");

  if (startNode?.id) {
    const inputData = inputStore.getInput(startNode.id);
    if (inputData?.path && inputData?.isPath) {
      pathStore.path = inputData.path;
      if (inputData.headers) {
        headerStore.headers = inputData.headers;
      }
    }
  }
}
</script>

<template>
  <div class="page-container flex flex-col h-[calc(100vh-36px)]">
    <div class="p-2 border-b flex items-center">
      <SiliconeButton @click="createWorkflow" :icon="Plus" text>
        New
      </SiliconeButton>
      <SiliconeButton
        v-if="workflowStore.currentId && workflowStore.list.length > 1"
        @click="deleteWorkflow"
        :icon="Delete"
        type="danger"
        text
      >
        Delete
      </SiliconeButton>
      <SiliconeButton @click="exportWorkflow" :icon="Download" text>
        Export
      </SiliconeButton>
      <SiliconeButton @click="importWorkflow" :icon="Upload" text>
        Import
      </SiliconeButton>
      <SiliconeButton
        @click="runWorkflow"
        :icon="SwitchButton"
        type="success"
        text
        :loading="isLoading"
      >
        Run
      </SiliconeButton>

      <SiliconeSelect
        v-if="workflowStore.list.length > 0"
        v-model="workflowStore.currentId"
        style="width: 120px"
        class="ml-auto"
        @change="onWorkflowChange"
      >
        <el-option
          v-for="wf in workflowStore.list"
          :key="wf.id"
          :label="wf.name"
          :value="wf.id"
        />
      </SiliconeSelect>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <div class="w-[80px] p-1 border-r border-[#ddd]">
        <div
          v-for="type in nodeTypes"
          :key="type"
          class="draggable-node text-center cursor-move p-1 bg-gray-100 rounded"
          draggable="true"
          @dragstart="onDragStart($event, type)"
        >
          {{ type }}
        </div>
      </div>

      <div class="flex-1 relative">
        <VueFlow
          ref="vueFlowRef"
          :node-types="customNodeTypes"
          :nodes="initialNodes"
          :edges="initialEdges"
          @connect="handleConnect"
          @drop="onDrop"
          @dragover="onDragOver"
          :fit-view-on-init="true"
        >
          <Background />

          <div
            v-show="validationResults.length > 0 || validationExpanded"
            class="validation-panel"
            :class="{
              'has-errors': hasErrors,
              'has-warnings': hasWarnings,
              'is-expanded': validationExpanded
            }"
          >
            <div
              class="validation-header"
              @click="validationExpanded = !validationExpanded"
            >
              <div class="header-left">
                <el-icon class="status-icon" :class="statusClass">
                  <component :is="statusIcon" />
                </el-icon>
                <span class="status-text">{{ statusText }}</span>
              </div>
              <div class="header-right">
                <el-icon
                  class="expand-icon"
                  :class="{ 'is-expanded': validationExpanded }"
                >
                  <ArrowUp />
                </el-icon>
              </div>
            </div>

            <div class="validation-content-wrapper">
              <div class="validation-content">
                <div
                  v-for="(error, index) in validationResults"
                  :key="index"
                  class="validation-item"
                  :class="error.type"
                  :style="{ animationDelay: `${index * 0.04}s` }"
                >
                  <el-icon class="item-icon">
                    <CircleCloseFilled v-if="error.type === 'error'" />
                    <WarningFilled v-else />
                  </el-icon>
                  <span class="item-text">{{ error.message }}</span>
                </div>

                <div
                  v-if="validationResults.length === 0"
                  class="success-message"
                >
                  <el-icon class="success-icon"><CircleCheckFilled /></el-icon>
                  <span>工作流配置正确</span>
                </div>
              </div>
            </div>
          </div>
        </VueFlow>
      </div>
    </div>
  </div>
</template>

<style scoped>
.draggable-node {
  padding: 8px 16px;
  margin-bottom: 10px;
  border: none;
  cursor: pointer;
  border-radius: 12px;
  text-align: center;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
    sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  background-color: #f0f0f0;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.15s ease;
}
.draggable-node:hover {
  background-color: #e9e9e9;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15), 0 2px 5px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

/* 暗色模式 */
.dark .draggable-node {
  color: #d3d3d3;
  background-color: #333;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.3);
}
.dark .draggable-node:hover {
  background-color: #3a3a3a;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.15),
    0 2px 5px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
}

/* 验证面板样式 */
.validation-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 300px;
  background: var(--el-bg-color, #ffffff);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.06);
  z-index: 1000;
  overflow: hidden;
  transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease,
    max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 400px;
}

/* 收起状态 */
.validation-panel:not(.is-expanded) {
  max-height: 48px;
}

.validation-panel:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 12px 32px rgba(0, 0, 0, 0.08);
}

.validation-panel.has-errors {
  border-color: var(--el-color-danger-light-3, #f56c6c);
}

.validation-panel.has-errors:hover {
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.2),
    0 12px 32px rgba(245, 108, 108, 0.15);
}

.validation-panel.has-warnings {
  border-color: var(--el-color-warning-light-3, #e6a23c);
}

.validation-panel.has-warnings:hover {
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.2),
    0 12px 32px rgba(230, 162, 60, 0.15);
}

.validation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
  background: var(--el-fill-color-blank, #ffffff);
  transition: background 0.2s ease;
  border-bottom: 1px solid transparent;
  flex-shrink: 0;
}

.validation-header:hover {
  background: var(--el-fill-color-light, #f5f7fa);
  border-bottom-color: var(--el-border-color-lighter, #ebeef5);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.status-error {
  color: var(--el-color-danger, #f56c6c);
}
.status-warning {
  color: var(--el-color-warning, #e6a23c);
}
.status-success {
  color: var(--el-color-success, #67c23a);
}

.status-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
  letter-spacing: -0.01em;
}

.expand-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary, #909399);
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.expand-icon.is-expanded {
  transform: rotate(180deg);
}

/* 内容区域 - 使用 max-height 实现平滑折叠 */
.validation-content-wrapper {
  overflow: hidden;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}

.validation-panel:not(.is-expanded) .validation-content-wrapper {
  max-height: 0;
  opacity: 0;
}

.validation-panel.is-expanded .validation-content-wrapper {
  max-height: 350px;
  opacity: 1;
}

.validation-content {
  max-height: 280px;
  overflow-y: auto;
  padding: 8px;
}

.validation-item {
  display: flex;
  align-items: flex-start;
  padding: 10px 12px;
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 1.6;
  border-radius: 8px;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease;
  animation: item-slide-in 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  opacity: 0;
  transform: translateX(-8px);
}

.validation-item:hover {
  transform: translateX(2px);
}

.validation-item:last-child {
  margin-bottom: 0;
}

.validation-item.error {
  color: var(--el-color-danger, #f56c6c);
  background: linear-gradient(
    135deg,
    rgba(245, 108, 108, 0.08) 0%,
    rgba(245, 108, 108, 0.04) 100%
  );
  border: 1px solid rgba(245, 108, 108, 0.15);
}

.validation-item.warning {
  color: var(--el-color-warning, #e6a23c);
  background: linear-gradient(
    135deg,
    rgba(230, 162, 60, 0.08) 0%,
    rgba(230, 162, 60, 0.04) 100%
  );
  border: 1px solid rgba(230, 162, 60, 0.15);
}

.item-icon {
  font-size: 15px;
  margin-right: 10px;
  margin-top: 1px;
  flex-shrink: 0;
}

.item-text {
  flex: 1;
  word-break: break-word;
}

.success-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  color: var(--el-color-success, #67c23a);
  font-size: 13px;
  gap: 8px;
}

.success-icon {
  font-size: 28px;
}

/* 面板整体进入/退出动画 */
.slide-fade-enter-active {
  transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-12px) scale(0.96);
  max-height: 0;
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
  max-height: 0;
}

/* 列表项滑入动画 */
@keyframes item-slide-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 收起时列表项淡出动画 */
.validation-panel:not(.is-expanded) .validation-item {
  animation: item-slide-out 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes item-slide-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(-8px);
  }
}

/* 滚动条样式 */
.validation-content::-webkit-scrollbar {
  width: 6px;
}

.validation-content::-webkit-scrollbar-track {
  background: transparent;
}

.validation-content::-webkit-scrollbar-thumb {
  background: var(--el-border-color, #dcdfe6);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.validation-content::-webkit-scrollbar-thumb:hover {
  background: var(--el-text-color-placeholder, #c0c4cc);
}

/* Dark mode 适配 */
.dark .validation-panel {
  background: #2d2d2d;
  border-color: #444444;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.15);
}

.dark .validation-panel:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 12px 32px rgba(0, 0, 0, 0.2);
}

.dark .validation-header:hover {
  background: #363636;
  border-bottom-color: #444444;
}

.dark .validation-item.error {
  background: linear-gradient(
    135deg,
    rgba(245, 108, 108, 0.15) 0%,
    rgba(245, 108, 108, 0.08) 100%
  );
  border-color: rgba(245, 108, 108, 0.25);
}

.dark .validation-item.warning {
  background: linear-gradient(
    135deg,
    rgba(230, 162, 60, 0.15) 0%,
    rgba(230, 162, 60, 0.08) 100%
  );
  border-color: rgba(230, 162, 60, 0.25);
}

.dark .validation-content::-webkit-scrollbar-thumb {
  background: #555555;
}

.dark .validation-content::-webkit-scrollbar-thumb:hover {
  background: #666666;
}
</style>
