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
    }
  ]
} satisfies RouteConfigsTable;
