export default {
  path: "/cmd",
  redirect: "/cmd/index",
  meta: {
    icon: "command",
    title: "cmd",
    rank: 1
  },
  children: [
    {
      path: "/cmd/index",
      name: "cmd",
      component: () => import("@/views/cmd/index.vue"),
      meta: {
        title: "cmd"
      }
    },
    {
      path: "/cmd/components/idx",
      name: "csv_idx",
      component: () => import("@/views/cmd/components/idx.vue"),
      meta: {
        title: "csv_idx",
        showLink: false
      }
    },
    {
      path: "/cmd/components/apply",
      name: "apply",
      component: () => import("@/views/cmd/components/apply.vue"),
      meta: {
        title: "apply",
        showLink: false
      }
    },
    {
      path: "/cmd/components/cat",
      name: "cat",
      component: () => import("@/views/cmd/components/cat.vue"),
      meta: {
        title: "cat",
        showLink: false
      }
    },
    {
      path: "/cmd/components/convert",
      name: "convert",
      component: () => import("@/views/cmd/components/convert.vue"),
      meta: {
        title: "convert",
        showLink: false
      }
    },
    {
      path: "/cmd/components/count",
      name: "count",
      component: () => import("@/views/cmd/components/count.vue"),
      meta: {
        title: "count",
        showLink: false
      }
    },
    {
      path: "/cmd/components/rename",
      name: "rename",
      component: () => import("@/views/cmd/components/rename.vue"),
      meta: {
        title: "rename",
        showLink: false
      }
    },
    {
      path: "/cmd/components/select",
      name: "select",
      component: () => import("@/views/cmd/components/select.vue"),
      meta: {
        title: "select",
        showLink: false
      }
    },
    {
      path: "/cmd/components/separate",
      name: "separate",
      component: () => import("@/views/cmd/components/separate.vue"),
      meta: {
        title: "separate",
        showLink: false
      }
    },
    {
      path: "/cmd/components/search",
      name: "search",
      component: () => import("@/views/cmd/components/search.vue"),
      meta: {
        title: "search",
        showLink: false
      }
    },
    {
      path: "/cmd/components/searchChain",
      name: "search chain",
      component: () => import("@/views/cmd/components/searchChain.vue"),
      meta: {
        title: "search chain",
        showLink: false
      }
    },
    {
      path: "/cmd/components/fill",
      name: "fill",
      component: () => import("@/views/cmd/components/fill.vue"),
      meta: {
        title: "fill",
        showLink: false
      }
    },
    {
      path: "/cmd/components/split",
      name: "split",
      component: () => import("@/views/cmd/components/split.vue"),
      meta: {
        title: "split",
        showLink: false
      }
    },
    {
      path: "/cmd/components/skip",
      name: "skip",
      component: () => import("@/views/cmd/components/skip.vue"),
      meta: {
        title: "skip",
        showLink: false
      }
    },
    {
      path: "/cmd/components/slice",
      name: "slice",
      component: () => import("@/views/cmd/components/slice.vue"),
      meta: {
        title: "slice",
        showLink: false
      }
    },
    {
      path: "/cmd/components/enumerate",
      name: "enumerate",
      component: () => import("@/views/cmd/components/enumerate.vue"),
      meta: {
        title: "enumerate",
        showLink: false
      }
    },
    {
      path: "/cmd/components/pinyin",
      name: "pinyin",
      component: () => import("@/views/cmd/components/pinyin.vue"),
      meta: {
        title: "chinese to pinyin",
        showLink: false
      }
    },
    {
      path: "/cmd/components/replace",
      name: "replace",
      component: () => import("@/views/cmd/components/replace.vue"),
      meta: {
        title: "replace",
        showLink: false
      }
    },
    {
      path: "/cmd/components/join",
      name: "join",
      component: () => import("@/views/cmd/components/join.vue"),
      meta: {
        title: "join",
        showLink: false
      }
    },
    {
      path: "/cmd/components/sort",
      name: "sort",
      component: () => import("@/views/cmd/components/sort.vue"),
      meta: {
        title: "sort",
        showLink: false
      }
    },
    {
      path: "/cmd/components/string",
      name: "string",
      component: () => import("@/views/cmd/components/string.vue"),
      meta: {
        title: "string",
        showLink: false
      }
    },
    {
      path: "/cmd/components/reverse",
      name: "reverse",
      component: () => import("@/views/cmd/components/reverse.vue"),
      meta: {
        title: "reverse",
        showLink: false
      }
    },
    {
      path: "/cmd/components/transpose",
      name: "transpose",
      component: () => import("@/views/cmd/components/transpose.vue"),
      meta: {
        title: "transpose",
        showLink: false
      }
    },
    {
      path: "/cmd/components/insert",
      name: "insert",
      component: () => import("@/views/cmd/components/insert.vue"),
      meta: {
        title: "insert",
        showLink: false
      }
    },
    {
      path: "/cmd/components/datefmt",
      name: "datefmt",
      component: () => import("@/views/cmd/components/datefmt.vue"),
      meta: {
        title: "datefmt",
        showLink: false
      }
    },
    {
      path: "/cmd/components/traverse",
      name: "traverse",
      component: () => import("@/views/cmd/components/traverse.vue"),
      meta: {
        title: "traverse directory",
        showLink: false
      }
    }
  ]
} satisfies RouteConfigsTable;
