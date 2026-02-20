<script setup lang="ts">
import { ref, nextTick, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  searchQuery?: string;
  caseSensitive?: boolean;
  useRegex?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "update:searchQuery", value: string): void;
  (e: "update:caseSensitive", value: boolean): void;
  (e: "update:useRegex", value: boolean): void;
  (e: "confirm", type: "visible" | "all"): void;
}>();

const visible = ref(props.modelValue);
const searchInput = ref();

// 本地状态(同步 props)
const localSearchQuery = ref(props.searchQuery || "");
const localCaseSensitive = ref(props.caseSensitive || false);
const localUseRegex = ref(props.useRegex || false);

// 监听打开状态,自动聚焦 + 同步数据
watch(
  () => props.modelValue,
  val => {
    visible.value = val;
    if (val) {
      nextTick(() => {
        localSearchQuery.value = props.searchQuery || "";
        localCaseSensitive.value = props.caseSensitive || false;
        localUseRegex.value = props.useRegex || false;
        searchInput.value?.focus();
      });
    }
  }
);

// 同步外部状态变化
watch(
  () => props.searchQuery,
  val => {
    localSearchQuery.value = val || "";
  }
);
watch(
  () => props.caseSensitive,
  val => {
    localCaseSensitive.value = val || false;
  }
);
watch(
  () => props.useRegex,
  val => {
    localUseRegex.value = val || false;
  }
);

// 同步 visible 状态
watch(visible, val => {
  emit("update:modelValue", val);
});

// 当前视图搜索
function handleSearchVisible() {
  emit("update:searchQuery", localSearchQuery.value);
  emit("update:caseSensitive", localCaseSensitive.value);
  emit("update:useRegex", localUseRegex.value);
  emit("confirm", "visible");
}

// 搜索整个文件
function handleSearchAll() {
  emit("update:searchQuery", localSearchQuery.value);
  emit("update:caseSensitive", localCaseSensitive.value);
  emit("update:useRegex", localUseRegex.value);
  emit("confirm", "all");
}

function handleClose() {
  emit("update:modelValue", false);
}
</script>

<template>
  <SiliconeDialog
    v-model="visible"
    title="查找"
    width="400px"
    :close-on-click-modal="false"
    @close="handleClose"
    :modal="false"
    modal-penetrable
    draggable
  >
    <el-form @submit.prevent>
      <el-form-item label="查找">
        <SiliconeInput
          v-model="localSearchQuery"
          placeholder="请输入要查找的内容"
          @keyup.enter="handleSearchVisible"
          clearable
        />
      </el-form-item>

      <el-form-item>
        <el-checkbox v-model="localCaseSensitive">区分大小写</el-checkbox>
        <el-checkbox v-model="localUseRegex">正则表达式</el-checkbox>
      </el-form-item>
    </el-form>

    <div class="flex justify-end gap-2">
      <SiliconeButton
        type="success"
        @click="handleSearchVisible"
        :loading="loading"
      >
        Search
      </SiliconeButton>
      <SiliconeButton
        type="success"
        @click="handleSearchAll"
        :loading="loading"
      >
        Search All
      </SiliconeButton>
    </div>
  </SiliconeDialog>
</template>
