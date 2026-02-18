export default {
  path: "/text",
  redirect: "/text/largeTextView",
  meta: {
    icon: "text",
    title: "largeTextView",
    rank: 3
  },
  children: [
    {
      path: "/text/largeTextView",
      name: "largeTextView",
      component: () => import("@/views/text/largeTextView.vue"),
      meta: {
        title: "Large Text View"
      }
    }
  ]
} satisfies RouteConfigsTable;
