export default {
  path: "/xlsx",
  redirect: "/xlsx/xlsxView",
  meta: {
    icon: "fileExcel",
    title: "xlsxview",
    rank: 2
  },
  children: [
    {
      path: "/xlsx/xlsxView",
      name: "xlsxView",
      component: () => import("@/views/xlsx/xlsxView.vue"),
      meta: {
        title: "Xlsx View"
      }
    }
  ]
} satisfies RouteConfigsTable;
