import { defineStore } from "pinia";

export const useQuoting = defineStore("quoting", {
  state: () => ({
    quoting: true
  }),
  actions: {
    toggleQuoting() {
      this.quoting = !this.quoting;
    },
    setQuoting(value) {
      this.quoting = !!value;
    }
  },
  persist: true
});

export const useFlexible = defineStore("flexible", {
  state: () => ({
    flexible: false
  }),
  actions: {
    setFlexible(value) {
      this.flexible = !!value;
    }
  },
  persist: true
});

export const useSkiprows = defineStore("skiprows", {
  state: () => ({
    skiprows: 0
  }),
  actions: {
    setSkiprows(value: string) {
      this.skiprows = Math.max(0, parseInt(value) || 0);
    }
  },
  persist: true
});

export const useProgress = defineStore("progress", {
  state: () => ({
    progress: true
  }),
  actions: {
    setProgress(value) {
      this.progress = !!value;
    }
  },
  persist: true
});

export const useThreads = defineStore("threads", {
  state: () => ({
    threads: 0
  }),
  actions: {
    setThreads(value: string) {
      this.threads = Math.max(0, parseInt(value) || 0);
    }
  },
  persist: true
});

export const useDelimiter = defineStore("delimiter", {
  state: () => ({
    delimiter: "|"
  }),
  actions: {
    setDelimiter(value: string) {
      this.delimiter = value;
    }
  },
  persist: true
});

export const ENCODING_OPTIONS = [
  // Unicode编码
  { label: "UTF-8", value: "UTF-8" },
  { label: "UTF-16LE", value: "UTF-16LE" },
  { label: "UTF-16BE", value: "UTF-16BE" },
  // 中文编码
  { label: "简体中文(GBK)", value: "GBK" },
  { label: "简体中文(GB18030)", value: "GB18030" },
  { label: "繁体中文(BIG5)", value: "BIG5" },
  // Windows编码
  { label: "中欧(Windows-1250)", value: "Windows-1250" },
  { label: "西里尔(Windows-1251)", value: "Windows-1251" },
  { label: "西欧(Windows-1252)", value: "Windows-1252" },
  { label: "希腊(Windows-1253)", value: "Windows-1253" },
  { label: "土耳其(Windows-1254)", value: "Windows-1254" },
  { label: "希伯来(Windows-1255)", value: "Windows-1255" },
  { label: "阿拉伯(Windows-1256)", value: "Windows-1256" },
  { label: "波罗的海(Windows-1257)", value: "Windows-1257" },
  { label: "越南(Windows-1258)", value: "Windows-1258" },
  { label: "泰文(Windows-874)", value: "Windows-874" },
  // 日文编码
  { label: "日文(Shift_JIS)", value: "Shift_JIS" },
  { label: "日文(EUC-JP)", value: "EUC-JP" },
  // 韩文编码
  { label: "韩文(EUC-KR)", value: "EUC-KR" }
] as const;

export type EncodingValue = (typeof ENCODING_OPTIONS)[number]["value"];

export const useEncoding = defineStore("encoding", {
  state: () => ({
    encoding: "UTF-8" as EncodingValue
  }),
  actions: {
    setEncoding(value: string) {
      this.encoding = value;
    }
  },
  persist: true
});
