const Layout = () => import("@/layout/index.vue");

export default {
  path: "/",
  name: "text",
  component: Layout,
  redirect: "/text/largeTextView",
  meta: {
    icon: "text",
    title: "largeTextView",
    rank: 0
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
