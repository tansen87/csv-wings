<script setup lang="ts">
import { ref, reactive, nextTick, watch } from "vue";
import type { FormInstance } from "element-plus";

interface ReplaceParams {
  search: string;
  replace: string;
  replaceAll: boolean;
  caseSensitive: boolean;
}

const props = defineProps<{
  modelValue: boolean;
  searchQuery?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "replace", params: ReplaceParams): void;
}>();

const visible = ref(props.modelValue);
const loading = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  search: props.searchQuery || "",
  replace: "",
  caseSensitive: false
});

const rules = {
  search: [{ required: true, message: "请输入查找内容", trigger: "blur" }]
};

watch(
  () => props.modelValue,
  val => {
    visible.value = val;
    if (val) {
      nextTick(() => {
        form.search = props.searchQuery || "";
        formRef.value?.clearValidate();
        (
          searchInput.value?.$el.querySelector("input") as HTMLInputElement
        )?.focus();
      });
    }
  }
);

watch(visible, val => {
  emit("update:modelValue", val);
});

const searchInput = ref();
const replaceInput = ref();

function focusReplaceInput() {
  nextTick(() => {
    (
      replaceInput.value?.$el.querySelector("input") as HTMLInputElement
    )?.focus();
  });
}

async function doReplace(replaceAll: boolean) {
  await formRef.value?.validate(valid => {
    if (!valid) return;

    loading.value = true;
    try {
      emit("replace", {
        search: form.search,
        replace: form.replace,
        replaceAll,
        caseSensitive: form.caseSensitive
      });
    } finally {
      loading.value = false;
    }
  });
}

function handleClose() {
  emit("update:modelValue", false);
}
</script>

<template>
  <SiliconeDialog
    v-model="visible"
    title="查找与替换"
    width="500px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
      <!-- 查找 -->
      <el-form-item label="查找内容" prop="search">
        <el-input
          v-model="form.search"
          placeholder="请输入要查找的内容"
          ref="searchInput"
          @keyup.enter="focusReplaceInput"
        />
      </el-form-item>

      <el-form-item label="替换为" prop="replace">
        <el-input
          v-model="form.replace"
          placeholder="请输入替换后的内容"
          ref="replaceInput"
          @keyup.enter="doReplace(false)"
        />
      </el-form-item>

      <el-form-item>
        <el-checkbox v-model="form.caseSensitive">区分大小写</el-checkbox>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <SiliconeButton @click="handleClose">Cancel</SiliconeButton>
        <SiliconeButton
          type="primary"
          @click="doReplace(false)"
          :loading="loading"
        >
          Replace
        </SiliconeButton>
        <SiliconeButton
          type="success"
          @click="doReplace(true)"
          :loading="loading"
        >
          Replace All
        </SiliconeButton>
      </div>
    </template>
  </SiliconeDialog>
</template>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
