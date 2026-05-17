<script setup lang="ts">
import { ref } from "vue";
import { useDark } from "@pureadmin/utils";
import { emitter } from "@/utils/mitt";
import {
  useDelimiter,
  useFlexible,
  useProgress,
  useQuoting,
  useSkiprows,
  useThreads
} from "@/store/modules/setting";

const dialog = ref(false);

emitter.on("openPanel", () => {
  dialog.value = true;
});

const quotingStore = useQuoting();
const flexibleStore = useFlexible();
const skiprowsStore = useSkiprows();
const progressStore = useProgress();
const threadsStore = useThreads();
const delimiterStore = useDelimiter();

const opts = ref("general");
const options = [
  { label: "General", value: "general" },
  { label: "Read/Write", value: "readwrite" }
];
const { isDark } = useDark();
</script>

<template>
  <SiliconeDialog v-model="dialog" title="Setting" width="70%">
    <div class="mode-toggle ml-[0px] mb-1 py-1">
      <span
        v-for="item in options"
        :key="item.value"
        class="mode-item mx-0.5 w-24"
        :class="{
          active: opts === item.value,
          'active-dark': isDark && opts === item.value
        }"
        @click="opts = item.value"
      >
        {{ item.label }}
      </span>
    </div>
    <el-scrollbar max-height="60vh">
      <div v-if="opts === 'general'" class="mt-1">
        <SiliconeCard class="mb-1">
          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-title">skiprows</span>
              <span class="setting-desc"> Number of lines skipped </span>
            </div>
            <SiliconeInputNumber
              v-model="skiprowsStore.skiprows"
              :min="0"
              size="small"
            />
          </div>
        </SiliconeCard>
        <SiliconeCard class="mb-1">
          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-title">progress</span>
              <span class="setting-desc">
                When set to false, no progress bar
              </span>
            </div>
            <SiliconeSwitch
              :model-value="progressStore.progress"
              @change="progressStore.setProgress"
              inline-prompt
              class="setting-switch"
              active-text="true"
              inactive-text="false"
            />
          </div>
        </SiliconeCard>
        <SiliconeCard class="mb-1">
          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-title">threads</span>
              <span class="setting-desc"> Number of threads used </span>
            </div>
            <SiliconeInputNumber
              v-model="threadsStore.threads"
              :min="0"
              size="small"
            />
          </div>
        </SiliconeCard>
      </div>

      <div v-if="opts === 'readwrite'" class="mt-1">
        <SiliconeCard class="mb-1">
          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-title">quoting</span>
              <span class="setting-desc">
                When set to false, ignore all double quotes
              </span>
            </div>
            <SiliconeSwitch
              :model-value="quotingStore.quoting"
              @change="quotingStore.setQuoting"
              inline-prompt
              class="setting-switch"
              active-text="true"
              inactive-text="false"
            />
          </div>
        </SiliconeCard>
        <SiliconeCard class="mb-1">
          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-title">flexible</span>
              <span class="setting-desc">
                When set to false, enable column count check
              </span>
            </div>
            <SiliconeSwitch
              :model-value="flexibleStore.flexible"
              @change="flexibleStore.setFlexible"
              inline-prompt
              class="setting-switch"
              active-text="true"
              inactive-text="false"
            />
          </div>
        </SiliconeCard>
        <SiliconeCard class="mb-1">
          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-title">delimiter</span>
              <span class="setting-desc"> Write the delimiter for CSV </span>
            </div>
            <SiliconeSelect
              style="width: 60px"
              v-model="delimiterStore.delimiter"
            >
              <el-option label="|" value="|" />
              <el-option label="," value="," />
              <el-option label=";" value=";" />
              <el-option label="\t" value="\t" />
            </SiliconeSelect>
          </div>
        </SiliconeCard>
      </div>
    </el-scrollbar>
  </SiliconeDialog>
</template>

<style lang="scss" scoped>
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.setting-label {
  display: flex;
  flex-direction: column;
}
.setting-title {
  font-weight: bold;
  font-size: 18px;
}
.setting-desc {
  font-size: 12px;
}
</style>
