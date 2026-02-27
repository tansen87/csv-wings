import { defineStore } from "pinia";

export const useCommandStore = defineStore("command", {
  state: () => ({
    commands: [
      {
        title: "Index",
        icon: "ri:rocket-line",
        description: "Create an index for a CSV",
        route: "/cmd/components/idx"
      },
      {
        title: "Apply",
        icon: "ri:stack-line",
        description:
          "Apply a series of transformation functions to CSV column/s",
        route: "/cmd/components/apply"
      },
      {
        title: "Cat",
        icon: "ri:merge-cells-vertical",
        description:
          "Merge multiple CSV or Excel files into one CSV or xlsx file",
        route: "/cmd/components/cat"
      },
      {
        title: "Count",
        icon: "ri:numbers-line",
        description: "Count the rows of CSV files",
        route: "/cmd/components/count"
      },
      {
        title: "Convert",
        icon: "ri:exchange-2-line",
        description: "File type conversion",
        route: "/cmd/components/convert"
      },
      {
        title: "Rename",
        icon: "ri:heading",
        description: "Rename the columns of a CSV",
        route: "/cmd/components/rename"
      },
      {
        title: "Select",
        icon: "ri:check-double-line",
        description: "Select, re-order columns",
        route: "/cmd/components/select"
      },
      {
        title: "Separate",
        icon: "ri:menu-search-line",
        description: "Separate CSV into good and bad rows",
        route: "/cmd/components/separate"
      },
      {
        title: "Search",
        icon: "ri:filter-2-line",
        description: "Select fields matching rows",
        route: "/cmd/components/search"
      },
      {
        title: "Search Chain",
        icon: "ri:filter-3-fill",
        description: "Chain search selects fields that match rows",
        route: "/cmd/components/searchChain"
      },
      {
        title: "Fill",
        icon: "ri:rhythm-fill",
        description: "Fill empty fields in selected columns of a CSV",
        route: "/cmd/components/fill"
      },
      {
        title: "Split",
        icon: "ri:scissors-cut-line",
        description: "Split one CSV file into many CSV files",
        route: "/cmd/components/split"
      },
      {
        title: "Skip",
        icon: "ri:skip-up-line",
        description: "Skip rows from CSV",
        route: "/cmd/components/skip"
      },
      {
        title: "Slice",
        icon: "ri:timeline-view",
        description: "Returns rows of a CSV file in the specified range",
        route: "/cmd/components/slice"
      },
      {
        title: "Enumerate",
        icon: "ri:sort-number-asc",
        description: "Add a new column enumerating the lines of a CSV file",
        route: "/cmd/components/enumerate"
      },
      {
        title: "Pinyin",
        icon: "ri:pinyin-input",
        description: "Convert Chinese to Pinyin for specific column in CSV",
        route: "/cmd/components/pinyin"
      },
      {
        title: "Replace",
        icon: "ri:find-replace-line",
        description: "Replace occurrences of a pattern across a CSV file",
        route: "/cmd/components/replace"
      },
      {
        title: "Join",
        icon: "ri:merge-cells-horizontal",
        description: "Joins two sets of CSV data on the specified columns",
        route: "/cmd/components/join"
      },
      {
        title: "Sort",
        icon: "ri:sort-alphabet-asc",
        description: "Sorts CSV data lexicographically",
        route: "/cmd/components/sort"
      },
      {
        title: "String",
        icon: "ri:formula",
        description: "String expr: slice, split, pad...",
        route: "/cmd/components/string"
      },
      {
        title: "Reverse",
        icon: "ri:arrow-up-down-line",
        description: "Reverses rows of CSV data",
        route: "/cmd/components/reverse"
      },
      {
        title: "Transpose",
        icon: "ri:loop-left-line",
        description: "Transpose rows/columns of a CSV",
        route: "/cmd/components/transpose"
      },
      {
        title: "Insert",
        icon: "ri:insert-column-right",
        description: "Insert columns through index",
        route: "/cmd/components/insert"
      },
      {
        title: "DateFmt",
        icon: "ri:calendar-line",
        description: "Format Dates",
        route: "/cmd/components/datefmt"
      },
      {
        title: "Traverse",
        icon: "ri:align-right",
        description: "Traverse the directory to obtain filenames",
        route: "/cmd/components/traverse"
      }
    ]
  })
});
