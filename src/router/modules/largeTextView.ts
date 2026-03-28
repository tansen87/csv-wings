const Layout = () => import("@/layout/index.vue");

export default {
  path: "/",
  name: "fileView",
  component: Layout,
  redirect: "/text/fileView",
  meta: {
    icon: "text",
    title: "fileView",
    rank: 0
  },
  children: [
    {
      path: "/text/fileView",
      name: "fileView",
      component: () => import("@/views/text/fileView.vue"),
      meta: {
        title: "Text View"
      }
    }
  ]
} satisfies RouteConfigsTable;
