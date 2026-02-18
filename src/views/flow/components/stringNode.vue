<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import { Handle, Position, useNodeId } from "@vue-flow/core";
import { CloseBold } from "@element-plus/icons-vue";
import { useHeaders, useStr } from "@/store/modules/flow";
import { useWorkflowStore } from "@/store/modules/workflow";

const mode = ref("len");
const [comparand, replacement, columns] = [ref(""), ref(""), ref("")];
const nodeId = useNodeId();
const headerStore = useHeaders();
const strStore = useStr();
const isInitialized = ref(false);

// 记录当前生成的header label,用于删除时匹配
const currentHeaderLabel = ref("");

const strData = computed(() => {
  const label = generateHeaderLabel({
    mode: mode.value,
    column: columns.value
  });

  return {
    op: "str",
    mode: mode.value,
    column: columns.value,
    comparand: comparand.value,
    replacement: replacement.value,
    newcol: label // 传递新列名
  };
});

// 挂载时恢复数据
onMounted(() => {
  if (!nodeId) return;

  const saved = strStore.getStr(nodeId);

  if (saved) {
    mode.value = saved.mode || "len";
    columns.value = saved.column || "";
    comparand.value = saved.comparand || "";
    replacement.value = saved.replacement || "";

    // 恢复 header
    if (saved.mode && saved.column) {
      const label = generateHeaderLabel(saved);
      headerStore.setHeaderForNode(nodeId, label);
      currentHeaderLabel.value = label; // 记录当前 header label
    }
  }

  isInitialized.value = true;
});

watch(
  strData,
  newData => {
    if (!isInitialized.value) return;
    if (!nodeId) return;

    if (newData.mode || newData.column) {
      strStore.addStr({
        id: nodeId,
        ...newData
      });
      const label = generateHeaderLabel(newData);
      headerStore.setHeaderForNode(nodeId, label);
      currentHeaderLabel.value = label; // 记录当前 header label
    }
  },
  { deep: true }
);

function generateHeaderLabel(data: {
  mode: string;
  column: string | string[];
}): string {
  const { mode, column } = data;

  if (mode === "cat") {
    return "concatenated";
  }
  if (mode === "calcconv") {
    return "calculated";
  }

  const needCol = [
    "copy",
    "left",
    "right",
    "slice",
    "split",
    "pad_left",
    "pad_right",
    "pad_both",
    "pinyin",
    "len"
  ].includes(mode);

  if (needCol) {
    const colStr = Array.isArray(column) ? column[0] : column;
    if (colStr && colStr.trim()) {
      return `${colStr}_${mode}`;
    }
  }

  return `${column}`;
}

const props = defineProps<{ id: string }>();

function deleteBtn() {
  // 用currentHeaderLabel过滤
  if (currentHeaderLabel.value) {
    headerStore.headers = headerStore.headers.filter(
      h => h.value !== currentHeaderLabel.value
    );
  }

  strStore.removeStr(nodeId);

  const store = useWorkflowStore();
  store.removeNodes([props.id]);
}
</script>

<template>
  <div class="page-container">
    <div class="node-container">
      <Handle
        type="target"
        :position="Position.Left"
        id="input"
        class="handle-style"
      />

      <div class="flex justify-between items-center mb-1 w-full">
        <span class="font-bold"> Str </span>
        <SiliconeButton circle text @click="deleteBtn" size="small">
          <el-icon><CloseBold /></el-icon>
        </SiliconeButton>
      </div>

      <SiliconeSelect
        v-if="!new Set(['cat', 'calcconv']).has(mode)"
        v-model="columns"
        filterable
        placeholder="Select column"
        style="margin-bottom: 6px"
      >
        <el-option
          v-for="item in headerStore.headers"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </SiliconeSelect>

      <SiliconeSelect v-model="mode" filterable style="margin-bottom: 6px">
        <el-option label="DynFmt" value="cat" />
        <el-option label="CalcConv" value="calcconv" />
        <el-option label="copy" value="copy" />
        <el-option label="abs" value="abs" />
        <el-option label="neg" value="neg" />
        <el-option label="reverse" value="reverse" />
        <el-option label="strip" value="strip" />
        <el-option label="squeeze" value="squeeze" />
        <el-option label="normalize" value="normalize" />
        <el-option label="round" value="round" />
        <el-option label="len" value="len" />
        <el-option label="replace" value="replace" />
        <el-option label="RegexReplace" value="regex_replace" />
        <el-option label="trim" value="trim" />
        <el-option label="ltrim" value="ltrim" />
        <el-option label="rtrim" value="rtrim" />
        <el-option label="upper" value="upper" />
        <el-option label="lower" value="lower" />
        <el-option label="pinyin" value="pinyin" />
        <el-option label="fill" value="fill" />
        <el-option label="ForwardFill" value="f_fill" />
        <el-option label="left" value="left" />
        <el-option label="right" value="right" />
        <el-option label="slice" value="slice" />
        <el-option label="split" value="split" />
        <el-option label="PadLeft" value="pad_left" />
        <el-option label="PadRight" value="pad_right" />
        <el-option label="PadBoth" value="pad_both" />
      </SiliconeSelect>

      <template v-if="['replace', 'regex_replace'].includes(mode)">
        <SiliconeInput
          v-model="comparand"
          style="margin-bottom: 6px"
          placeholder="comparand"
        />
        <SiliconeInput v-model="replacement" placeholder="replacement" />
      </template>

      <template v-if="['split'].includes(mode)">
        <SiliconeInput
          v-model="comparand"
          style="margin-bottom: 6px"
          placeholder="delimiter"
        />
        <SiliconeInput v-model="replacement" placeholder="n" />
      </template>

      <SiliconeInput
        v-if="['cat', 'calcconv'].includes(mode)"
        v-model="comparand"
        placeholder="{col1}-{col2}+{col3}"
      />

      <SiliconeInput
        v-if="['slice'].includes(mode)"
        v-model="comparand"
        style="margin-bottom: 6px"
        placeholder="start index"
      />

      <SiliconeInput
        v-if="
          [
            'left',
            'right',
            'slice',
            'pad_left',
            'pad_right',
            'pad_both'
          ].includes(mode)
        "
        v-model="replacement"
        style="margin-bottom: 6px"
        placeholder="length"
      />

      <SiliconeInput
        v-if="['pad_left', 'pad_right', 'pad_both'].includes(mode)"
        v-model="comparand"
        placeholder="fill char"
      />

      <SiliconeInput
        v-if="['fill'].includes(mode)"
        v-model="replacement"
        placeholder="fill value"
      />

      <SiliconeSelect v-if="['pinyin'].includes(mode)" v-model="replacement">
        <el-option label="upper" value="upper" />
        <el-option label="lower" value="lower" />
      </SiliconeSelect>

      <Handle
        type="source"
        :position="Position.Right"
        id="output"
        class="handle-style"
      />
    </div>
  </div>
</template>
