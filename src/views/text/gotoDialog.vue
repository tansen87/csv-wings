<script setup lang="ts">
import { ref, reactive, nextTick, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  totalLines?: number;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "goTo", lineNumber: number): void;
}>();

const visible = ref(props.modelValue);
const lineInput = ref();

const form = reactive({
  lineNumber: ""
});

watch(
  () => props.modelValue,
  val => {
    visible.value = val;
    if (val) {
      nextTick(() => {
        form.lineNumber = "";
        lineInput.value?.focus();
      });
    }
  }
);

watch(visible, val => {
  emit("update:modelValue", val);
});

function handleGoTo() {
  const lineNum = parseInt(form.lineNumber, 10);

  if (isNaN(lineNum) || lineNum < 1) {
    return;
  }

  if (props.totalLines && lineNum > props.totalLines) {
    return;
  }

  emit("goTo", lineNum);
  emit("update:modelValue", false);
}

function handleClose() {
  emit("update:modelValue", false);
}
</script>

<template>
  <SiliconeDialog
    v-model="visible"
    title="跳转到行"
    width="400px"
    :close-on-click-modal="false"
    @close="handleClose"
    :modal="false"
    modal-penetrable
    draggable
  >
    <el-form ref="formRef" :model="form" @submit.prevent>
      <el-form-item>
        <SiliconeInput
          v-model="form.lineNumber"
          placeholder="请输入行号"
          ref="lineInput"
          @keyup.enter="handleGoTo"
          clearable
        />
      </el-form-item>

      <div class="flex justify-between">
        <SiliconeTag type="success"> {{ totalLines }} lines </SiliconeTag>
        <SiliconeButton type="success" @click="handleGoTo"> Go </SiliconeButton>
      </div>
    </el-form>
  </SiliconeDialog>
</template>
