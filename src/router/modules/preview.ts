export default {
  path: "/preview",
  redirect: "/preview/previewXlsx",
  meta: {
    icon: "fileExcel",
    title: "preview",
    rank: 1
  },
  children: [
    {
      path: "/preview/previewXlsx",
      name: "preview",
      component: () => import("@/views/preview/previewXlsx.vue"),
      meta: {
        title: "preview"
      }
    }
  ]
} satisfies RouteConfigsTable;
