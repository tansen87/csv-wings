<script setup lang="ts">
import { ref, reactive, nextTick, watch } from "vue";
import type { FormInstance } from "element-plus";
import { message } from "@/utils/message";

interface ReplaceParams {
  search: string;
  replace: string;
  replaceAll: boolean;
  caseSensitive: boolean;
  useRegex: boolean;
}

const props = defineProps<{
  modelValue: boolean;
  searchQuery?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "replace", params: ReplaceParams): void;
}>();

const visible = ref(props.modelValue);
const formRef = ref<FormInstance>();

const form = reactive({
  search: props.searchQuery || "",
  replace: "",
  caseSensitive: false,
  useRegex: false
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

    try {
      emit("replace", {
        search: form.search,
        replace: form.replace,
        replaceAll,
        caseSensitive: form.caseSensitive,
        useRegex: form.useRegex
      });
    } catch (err) {
      message(`replace failed: ${err}`, { type: "error" });
      return;
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
    title="替换"
    width="400px"
    :close-on-click-modal="false"
    @close="handleClose"
    :modal="false"
    modal-penetrable
    draggable
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
      <el-form-item label="查找" prop="search">
        <SiliconeInput
          v-model="form.search"
          placeholder="请输入要查找的内容"
          ref="searchInput"
          @keyup.enter="focusReplaceInput"
        />
      </el-form-item>

      <el-form-item label="替换为" prop="replace">
        <SiliconeInput
          v-model="form.replace"
          placeholder="请输入替换后的内容"
          ref="replaceInput"
          @keyup.enter="doReplace(false)"
        />
      </el-form-item>

      <el-form-item>
        <el-checkbox v-model="form.caseSensitive">区分大小写</el-checkbox>
        <el-checkbox v-model="form.useRegex">正则表达式</el-checkbox>
      </el-form-item>
    </el-form>

    <div class="flex justify-end gap-3">
      <SiliconeButton @click="handleClose">Cancel</SiliconeButton>
      <SiliconeButton
        type="success"
        @click="doReplace(false)"
        :loading="props.loading"
      >
        Replace
      </SiliconeButton>
      <SiliconeButton
        type="warning"
        @click="doReplace(true)"
        :loading="props.loading"
      >
        Replace All
      </SiliconeButton>
    </div>
  </SiliconeDialog>
</template>
