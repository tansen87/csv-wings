import { nextTick, onMounted, onUnmounted, Ref, ref, watch } from "vue";
import { useDark } from "@pureadmin/utils";
import { marked } from "marked";
import Prism from "prismjs";
import "prismjs/components/prism-sql";

const themeMap = {
  dark: "prism-tomorrow.css",
  light: "prism-solarizedlight.css"
};

const loadedThemes = new Set<string>();

function usePrismTheme(isDark: Ref<boolean>) {
  const loadTheme = async (themeType: "dark" | "light") => {
    const themePath = themeMap[themeType];

    if (loadedThemes.has(themePath)) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/node_modules/prismjs/themes/${themePath}`;

    link.onload = () => {
      loadedThemes.add(themePath);
      Prism.highlightAll();
    };

    document.head.appendChild(link);
  };

  const removeOldTheme = (themeType: "dark" | "light") => {
    const oldTheme = themeMap[themeType];
    document.head.querySelectorAll("link").forEach(link => {
      if (link.href.endsWith(oldTheme)) {
        link.remove();
        loadedThemes.delete(oldTheme);
      }
    });
  };

  watch(
    isDark,
    newVal => {
      const targetTheme = newVal ? "dark" : "light";
      removeOldTheme(newVal ? "light" : "dark");
      loadTheme(targetTheme);
    },
    { immediate: true }
  );

  onUnmounted(() => {
    Object.values(themeMap).forEach(theme => {
      removeOldTheme(theme === themeMap.dark ? "dark" : "light");
    });
  });
}

export function useMarkdown(mdInitFn: () => string) {
  const { isDark } = useDark();
  const markdown = ref(mdInitFn());
  const mdShow = ref(marked.parse(markdown.value));

  usePrismTheme(isDark);

  const highlightCode = async () => {
    await nextTick();
    Prism.highlightAll();
  };

  onMounted(() => {
    highlightCode();
  });

  watch(markdown, async newContent => {
    mdShow.value = marked.parse(newContent);
    await highlightCode();
  });

  return {
    markdown,
    mdShow,
    mdUpdate: (newMarkdownFn: () => string) => {
      markdown.value = newMarkdownFn();
    }
  };
}

export function mdApply() {
  return `
  ### OPERATIONS
  | Operations | Description                                       |
  | :--------- | :------------------------------------------------ |
  | Copy       | mark a column for copying                         |
  | Len        | return string length                              |
  | Lower      | transform to lowercase                            |
  | Upper      | transform to uppercase                            |
  | Trim       | trim (drop whitespace left & right of the string) |
  | Ltrim      | left trim whitespace                              |
  | Rtrim      | right trim whitespace                             |
  | Replace    | replace all matches of a pattern                  |
  | Round      | round off, AKA "Bankers Rounding"                 |
  | Squeeze    | compress consecutive whitespaces                  |
  | Strip      | replace \\ r and \\ n with whitespaces            |
  
  ### DynFmt
  Dynamically constructs a new column from other columns.

  ### CalcConv
  Parse and evaluate math expressions into a new column, with support for units and conversions.
`;
}

export function mdCat() {
  return `
\`\`\`
sample file
test1.csv
┌─────┬────────┐
│ idx │ name   │
├─────┼────────┤
│  1  │ tom    │
│  2  │ jerry  │
│  3  | tansen |
└─────┴────────┘

test2.csv
┌─────┬─────┐
│ age │ idx │
├─────┼─────┤
│ 10  │  4  │
│ 21  │  5  │
│ 31  |  6  |
└─────┴─────┘
\`\`\`

### 1. Column
\`\`\`
┌─────┬────────┬─────┐
│ idx │ name   │ age │
├─────┼────────┤─────┤
│  1  │ tom    │     │
│  2  │ jerry  │     │
│  3  | tansen |     │
│  4  │        │ 10  │
│  5  │        │ 21  │
│  6  │        │ 31  │
└─────┴────────┴─────┘
\`\`\`
`;
}

export function mdSplit() {
  return `
### 1. Rows (standard csv file)
\`\`\`
sample file
┌─────┬────────┐
│ idx │ name   │
├─────┼────────┤
│  1  │ tom    │
│  2  │ jerry  │
│  3  | tansen |
└─────┴────────┘
\`\`\`
(Split rows: <u>2</u>, Split mode: <u>Rows</u>)
\`\`\`
split 1
┌─────┬────────┐
│ idx │ name   │
├─────┼────────┤
│  1  │ tom    │
│  2  │ jerry  │
└─────┴────────┘

split 2
┌─────┬────────┐
│ idx │ name   │
├─────┼────────┤
│  3  | tansen |
└─────┴────────┘
\`\`\`

### 2. Lines
\`\`\`
sample file
------------------------
idx,name
hello world...
say hello.
this is a test for lines.
------------------------
\`\`\`
(Split rows: <u>2</u>, Split mode: <u>Lines</u>)
\`\`\`
split 1
------------------------
idx,name
hello world...
say hello.
------------------------

split 2
------------------------
idx,name
this is a test for lines.
------------------------
\`\`\`
`;
}

export function mdStr() {
  return `
\`\`\`
sample file
┌─────┬──────────┐
│ idx │ name     │
├─────┼──────────┤
│  1  │ tom-1    │
│  2  │ jerry-2  │
│  3  | tansen-3 |
└─────┴──────────┘
\`\`\`

### 1. Left
(Select column: <u>name</u>, Number of the string: <u>3</u>)
\`\`\`
┌─────┬──────────┬────────────┐
│ idx │ name     │ name_nchar │
├─────┼──────────┼────────────┤
│  1  │ tom-1    │    tom     │
│  2  │ jerry-2  │    jer     │
│  3  | tansen-3 |    han     │
└─────┴──────────┴────────────┘
\`\`\`

### 2. Right
(Select column: <u>name</u>, Number of the string: <u>3</u>)
\`\`\`
┌─────┬──────────┬────────────┐
│ idx │ name     │ name_nchar │
├─────┼──────────┼────────────┤
│  1  │ tom-1    │    m-1     │
│  2  │ jerry-2  │    y-2     │
│  3  | tansen-3 |    n-3     │
└─────┴──────────┴────────────┘
\`\`\`

### 3. Slice
(Select column: <u>name</u>, Start index: <u>1</u>, Length of the slice: <u>3</u>)
\`\`\`
┌─────┬──────────┬────────────┐
│ idx │ name     │ name_slice │
├─────┼──────────┼────────────┤
│  1  │ tom-1    │   tom      │
│  2  │ jerry-2  │   jer      │
│  3  | tansen-3 |   han      │
└─────┴──────────┴────────────┘
\`\`\`
(Select column: <u>name</u>, Start index: <u>-1</u>, Length of the slice: <u>3</u>)
\`\`\`
┌─────┬──────────┬────────────┐
│ idx │ name     │ name_slice │
├─────┼──────────┼────────────┤
│  1  │ tom-1    │   m-1      │
│  2  │ jerry-2  │   y-2      │
│  3  | tansen-3 |   n-3      │
└─────┴──────────┴────────────┘
\`\`\`

### 4. SplitN
(Select column: <u>name</u>, nth/max number of items to return: <u>1</u>, Substring to split by: <u>-</u>)
\`\`\`
┌─────┬──────────┬──────────┐
│ idx │ name     │ name_nth │
├─────┼──────────┼──────────┤
│  1  │ tom-1    │  tom     │
│  2  │ jerry-2  │  jerry   │
│  3  | tansen-3 |  tansen  │
└─────┴──────────┴──────────┘
\`\`\`

### 5. SplitMax
(Select column: <u>name</u>, nth/max number of items to return: <u>2</u>, Substring to split by: <u>-</u>)
\`\`\`
┌─────┬──────────┬────────────┬────────────┐
│ idx │ name     │ name_nmax1 │ name_nmax2 │
├─────┼──────────┼────────────┼────────────┤
│  1  │ tom-1    │  tom       │     1      │
│  2  │ jerry-2  │  jerry     │     2      │
│  3  | tansen-3 |  tansen    │     3      │
└─────┴──────────┴────────────┴────────────┘
\`\`\`

### 6. PadLeft
(Select column: <u>idx</u>, Pad the string until it reaches this length: <u>2</u>, The character to pad the string with: <u>*</u>)
\`\`\`
┌─────┬──────────┐
│ idx │ name     │
├─────┼──────────┤
│ *1  │ tom-1    │
│ *2  │ jerry-2  │
│ *3  | tansen-3 |
└─────┴──────────┘
\`\`\`

### 7. PadRight
(Select column: <u>idx</u>, Pad the string until it reaches this length: <u>2</u>, The character to pad the string with: <u>*</u>)
\`\`\`
┌─────┬──────────┐
│ idx │ name     │
├─────┼──────────┤
│ 1*  │ tom-1    │
│ 2*  │ jerry-2  │
│ 3*  | tansen-3 |
└─────┴──────────┘
\`\`\`

### 7. PadBoth
(Select column: <u>idx</u>, Pad the string until it reaches this length: <u>3</u>, The character to pad the string with: <u>*</u>)
\`\`\`
┌─────┬──────────┐
│ idx │ name     │
├─────┼──────────┤
│ *1* │ tom-1    │
│ *2* │ jerry-2  │
│ *3* | tansen-3 |
└─────┴──────────┘
\`\`\`
`;
}

export function mdSearch() {
  return `
# 1. equal
(Column: <u>name</u>; Condition: <u>tom|jerry</u>)
\`\`\`
    test.csv             test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │
│  2  │ jerry  │        │  2  │ jerry  │
│  3  | tansen |        └─────┴────────┘
└─────┴────────┘
\`\`\`

# 2. equal_multi
(Column: <u>name</u>; Condition: <u>tom|jerry</u>)
\`\`\`
    test.csv             test_tom.csv          test_jerry.csv
┌─────┬────────┐        ┌─────┬────────┐       ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │   +   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤       ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │       │  2  │ jerry  │
│  2  │ jerry  │        └─────┴────────┘       └─────┴────────┘
│  3  | tansen |
└─────┴────────┘
\`\`\`

# 3. not_equal
(Column: <u>name</u>; Condition: <u>tom|jerry</u>)
\`\`\`
    test.csv             test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │        │ idx │ name   │
├─────┼────────┤   =>   ├─────┼────────┤
│  1  │ tom    │        │  3  │ tansen │
│  2  │ jerry  │        └─────┴────────┘
│  3  | tansen |
└─────┴────────┘
\`\`\`

# 4. contains
(Column: <u>name</u>; Condition: <u>om|jer</u>)
\`\`\`
    test.csv             test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │
│  2  │ jerry  │        │  2  │ jerry  │
│  3  | tansen |        └─────┴────────┘
└─────┴────────┘
\`\`\`

# 5. contains_multi
(Column: <u>name</u>; Condition: <u>om|jer</u>)
\`\`\`
  test.csv                 test_om.csv           test_jer.csv
┌─────┬────────┐        ┌─────┬────────┐       ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │   +   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤       ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │       │  2  │ jerry  │
│  2  │ jerry  │        └─────┴────────┘       └─────┴────────┘
│  3  | tansen |
└─────┴────────┘
\`\`\`

# 6. not_contains
(Column: <u>name</u>; Condition: <u>om|jer</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  3  │ tansen │
│  2  │ jerry  │        └─────┴────────┘
│  3  | tansen |
└─────┴────────┘
\`\`\`

# 7. starts_with
(Column: <u>name</u>; Condition: <u>to|jer</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │
│  2  │ jerry  │        │  2  │ jerry  │
│  3  | tansen |        └─────┴────────┘
└─────┴────────┘
\`\`\`

# 8. starts_with_multi
(Column: <u>name</u>; Condition: <u>to|jer</u>)
\`\`\`
    test.csv               test_to.csv           test_jer.csv
┌─────┬────────┐        ┌─────┬────────┐       ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │   +   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤       ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │       │  2  │ jerry  │
│  2  │ jerry  │        └─────┴────────┘       └─────┴────────┘
│  3  | tansen |
└─────┴────────┘
\`\`\`

# 9. not_starts_with
(Column: <u>name</u>; Condition: <u>to|jer</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  3  │ tansen │
│  2  │ jerry  │        └─────┴────────┘
│  3  | tansen |
└─────┴────────┘
\`\`\`

# 10. ends_with
(Column: <u>name</u>; Condition: <u>om|rry</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │
│  2  │ jerry  │        │  2  │ jerry  │
│  3  | tansen |        └─────┴────────┘
└─────┴────────┘
\`\`\`

# 11. ends_with_multi
(Column: <u>name</u>; Condition: <u>om|rry</u>)
\`\`\`
    test.csv              test_om.csv              test_rry.csv
┌─────┬────────┐        ┌─────┬────────┐       ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │   +   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤       ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │       │  2  │ jerry  │
│  2  │ jerry  │        └─────┴────────┘       └─────┴────────┘
│  3  | tansen |
└─────┴────────┘
\`\`\`

# 12. not_ends_with
(Column: <u>name</u>; Condition: <u>om|rry</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  3  │ tansen │
│  2  │ jerry  │        └─────┴────────┘
│  3  | tansen |
└─────┴────────┘
\`\`\`

# 13. regex
(Column: <u>name</u>; Condition: <u>tansen</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │
│  2  │ jerry  │        │  2  │ jerry  │
│  3  | tansen |        └─────┴────────┘
└─────┴────────┘
\`\`\`

# 14. is_null
(Column: <u>name</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │     │        │
│  2  │ jerry  │        └─────┴────────┘
│  3  | tansen |
└─────┴────────┘
\`\`\`

# 15. is_not_null
(Column: <u>name</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐    
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │
│  2  │ jerry  │        │  2  │ jerry  │
│  3  | tansen |        │  3  | tansen |
└─────┴────────┘        └─────┴────────┘
\`\`\`

# 16. gt
(Column: <u>idx</u>; Condition: <u>2</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  3  | tansen |
│  2  │ jerry  │        └─────┴────────┘
│  3  | tansen |
└─────┴────────┘
\`\`\`

# 17. ge
(Column: <u>idx</u>; Condition: <u>2</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  2  │ jerry  │
│  2  │ jerry  │        │  3  | tansen |
│  3  | tansen |        └─────┴────────┘
└─────┴────────┘
\`\`\`

# 18. lt
(Column: <u>idx</u>; Condition: <u>2</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │
│  2  │ jerry  │        └─────┴────────┘
│  3  | tansen |
└─────┴────────┘
\`\`\`

# 19. le
(Column: <u>idx</u>; Condition: <u>2</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │
│  2  │ jerry  │        │  2  │ jerry  │
│  3  | tansen |        └─────┴────────┘
└─────┴────────┘
\`\`\`

# 20. between
(Column: <u>idx</u>; Condition: <u>1|2</u>)
\`\`\`
    test.csv            test_search.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │
│  2  │ jerry  │        │  2  │ jerry  │
│  3  | tansen |        └─────┴────────┘
└─────┴────────┘
\`\`\`
`;
}

export function mdRename() {
  return `
\`\`\`
sample file
┌─────┬────────┐
│ idx │ name   │
├─────┼────────┤
│  1  │ tom    │
│  2  │ jerry  │
│  3  | tansen |
└─────┴────────┘
\`\`\`
Set new headers: idx1, name1
\`\`\`
┌──────┬────────┐
│ idx1 │ name1  │
├──────┼────────┤
│  1   │ tom    │
│  2   │ jerry  │
│  3   | tansen |
└──────┴────────┘
\`\`\`
`;
}

export function mdSelect() {
  return `
# 1. Include
(SELECTION MODE: <u>Include</u>; COLUMNS: <u>name,idx</u>)
\`\`\`
          sample file                       result
┌─────┬────────┬─────────────┐          ┌────────┬─────┐
│ idx │ name   │ _filename_  │          │ name   │ idx │
├─────┼────────┼─────────────┤    =>    ├────────┼─────┤
│  1  │ tom    │ test1.csv   │          │ tom    │  1  │
│  2  │ jerry  │ test1.csv   │          │ jerry  │  2  │
│  3  | tansen | test1.csv   │          │ tansen |  3  |
└─────┴────────┴─────────────┘          └────────┴─────┘
\`\`\`

# 2. Exclude
(SELECTION MODE: <u>Exclude</u>; COLUMNS: <u>name,idx</u>)
\`\`\`
          sample file                        result
┌─────┬────────┬─────────────┐          ┌─────────────┐
│ idx │ name   │ _filename_  │          │ _filename_  │
├─────┼────────┼─────────────┤    =>    ├─────────────┤
│  1  │ tom    │ test1.csv   │          │ test1.csv   │
│  2  │ jerry  │ test1.csv   │          │ test1.csv   │
│  3  | tansen | test1.csv   │          │ test1.csv   │
└─────┴────────┴─────────────┘          └─────────────┘                
\`\`\`
`;
}

export function mdFill() {
  return `
# 1. fill
(COLUMNS: <u>name</u>, FILL VALUE: <u>jerry</u>)
\`\`\`
    test.csv              test_fill.csv
┌─────┬─────────┐       ┌─────┬─────────┐
│ idx │ name    │   =>  │ idx │ name    │
├─────┼─────────┤       ├─────┼─────────┤
│  1  │         │       │  1  │ jerry   │
│  2  │ jerry   │       │  2  │ jerry   │
│  3  |         |       │  3  | jerry   |
└─────┴─────────┘       └─────┴─────────┘
\`\`\`

# 2. f-fill
(COLUMNS: <u>name</u>)
\`\`\`
    test.csv              test_fill.csv
┌─────┬─────────┐       ┌─────┬─────────┐
│ idx │ name    │   =>  │ idx │ name    │
├─────┼─────────┤       ├─────┼─────────┤
│  1  │         │       │  1  │         │
│  2  │ jerry   │       │  2  │ jerry   │
│  3  |         |       │  3  | jerry   |
└─────┴─────────┘       └─────┴─────────┘
\`\`\`
  `;
}

export function mdCount() {
  return `
### 1. Count
\`\`\`
Count result: 3
┌─────┬────────┐
│ idx │ name   │
├─────┼────────┤
│  1  │ tom    │
│  2  │ jerry  │
│  3  | tansen |
└─────┴────────┘
\`\`\`

### 2. Check - detecting issues caused by double quotation marks
\`\`\`
Check result: 2 (This is an incorrect result)
┌─────┬────────┐
│ idx │ name   │
├─────┼────────┤
│  1  │  tom   │
│  2  │ "jerry │
│  3  | tansen |
└─────┴────────┘
\`\`\`
  `;
}

export function mdJoin() {
  return `
\`\`\`
sample file
left.csv           right.csv
┌─────┬────────┐   ┌─────┬──────┐
│ idx │ name   │   │ idx │ age  │
├─────┼────────┤   ├─────┼──────┤
│  1  │ tom    │   │  1  │ 20   │
│  2  │ jerry  │   │  3  | 18   |
│  3  | tansen |   │  5  │ 10   |
└─────┴────────┘   └─────┴──────┘
\`\`\`

### inner
\`\`\`
inner join result (left_on='idx', right_on='idx')
┌─────┬────────┬─────┬──────┐
│ idx │ name   │ idx │ age  │
├─────┼────────┼─────┼──────┤
│  1  │ tom    │  1  │ 20   │
│  3  │ tansen │  3  | 18   |
└─────┴────────┴─────┴──────┘
\`\`\`

### left
\`\`\`
left outer join result (left_on='idx', right_on='idx')
┌─────┬────────┬─────┬──────┐
│ idx │ name   │ idx │ age  │
├─────┼────────┼─────┼──────┤
│  1  │ tom    │  1  │ 20   │
│  2  │ jerry  |     |      |
│  3  | tansen |  3  │ 18   |
└─────┴────────┴─────┴──────┘
\`\`\`

### right
\`\`\`
right outer join result (left_on='idx', right_on='idx')
┌─────┬────────┬─────┬──────┐
│ idx │ name   │ idx │ age  │
├─────┼────────┼─────┼──────┤
│  1  │ tom    │  1  │ 20   │
│  3  │ tansen │  3  | 18   |
│     |        │  5  │ 10   |
└─────┴────────┴─────┴──────┘
\`\`\`

### full
\`\`\`
full outer join result (left_on='idx', right_on='idx')
┌─────┬────────┬─────┬──────┐
│ idx │ name   │ idx │ age  │
├─────┼────────┼─────┼──────┤
│  1  │ tom    │  1  │ 20   │
│  2  │ jerry  │     |      |
│  3  | tansen |  3  │ 18   |
│     |        │  5  │ 10   |
└─────┴────────┴─────┴──────┘
\`\`\`

### cross
\`\`\`
cross join result (left_on='idx', right_on='idx')
┌─────┬────────┬─────┬──────┐
│ idx │ name   │ idx │ age  │
├─────┼────────┼─────┼──────┤
│  1  │ tom    │  1  │ 20   │
│  1  │ tom    │  3  │ 18   │
│  1  │ tom    │  5  │ 10   │
│  2  │ jerry  │  1  | 20   |
│  2  │ jerry  │  3  | 18   |
│  2  │ jerry  │  5  | 10   |
│  3  | tansen |  1  │ 20   |
│  3  | tansen |  3  │ 18   |
│  3  | tansen |  5  │ 10   |
└─────┴────────┴─────┴──────┘
\`\`\`

### left semi
\`\`\`
left semi join result (left_on='idx', right_on='idx')
┌─────┬────────┐
│ idx │ name   │
├─────┼────────┤
│  1  │ tom    │
│  3  | tansen |
└─────┴────────┘
\`\`\`

### left anti
\`\`\`
left anti join result (left_on='idx', right_on='idx')
┌─────┬────────┐
│ idx │ name   │
├─────┼────────┤
│  2  │ jerry  │
└─────┴────────┘
\`\`\`

### right semi
\`\`\`
right semi join result (left_on='idx', right_on='idx')
┌─────┬──────┐
│ idx │ age  │
├─────┼──────┤
│  1  │ 20   │
│  3  | 18   |
└─────┴──────┘
\`\`\`

### right anti
\`\`\`
right anti join result (left_on='idx', right_on='idx')
┌─────┬──────┐
│ idx │ age  │
├─────┼──────┤
│  5  │ 10   |
└─────┴──────┘
\`\`\`
`;
}

export function mdSkip() {
  return `
(SKIP ROWS: 2)
\`\`\`
    test.csv              test_skip.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │  2  │ jerry  │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  3  | tansen |
│  2  │ jerry  │        └─────┴────────┘
│  3  | tansen |
└─────┴────────┘
\`\`\`
  `;
}

export function mdEnumer() {
  return `
(COLUMNS NAME: row_number; START: <u>1</u>; STEP: <u>1</u>)
\`\`\`
    test.csv                   test_enumer.csv
┌─────┬────────┐        ┌────────────┬──────┬────────┐
│ idx │ name   │        │ row_number │ idx  │ name   │
├─────┼────────┤        ├────────────┼──────┼────────┤
│  1  │ tom    │        │     1      │  1   │ tom    │
│  2  │ jerry  │        │     2      │  2   │ jerry  │
│  3  | tansen |        │     3      |  3   | tansen │
└─────┴────────┘        └────────────┴──────┴────────┘
\`\`\`
`;
}

export function mdPinyin() {
  return `
# 1. Upper
(COLUMNS: <u>name</u>)
\`\`\`
    test.csv             test_pinyin.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ 汤姆   │        │  1  │ TANGMU │
│  2  │ 杰瑞   │        │  2  │ JIERUI │
│  3  | tansen |        │  3  | tansen |
└─────┴────────┘        └─────┴────────┘
\`\`\`

# 2. Lower
(COLUMNS: <u>name</u>)
\`\`\`
    test.csv             test_pinyin.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ 汤姆   │        │  1  │ tangmu │
│  2  │ 杰瑞   │        │  2  │ jierui │
│  3  | tansen |        │  3  | tansen |
└─────┴────────┘        └─────┴────────┘
\`\`\`
`;
}

export function mdReplace() {
  return `
(Column: <u>name</u>, REGEX PATTERN: <u>tom</u>, REPLACEMENT: <u>cat</u>)
\`\`\`
    test.csv            test_replace.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │  name  │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  1  │ cat    │
│  2  │ jerry  │        │  2  │ jerry  │
│  3  | tansen |        │  3  | tansen |
└─────┴────────┘        └─────┴────────┘
\`\`\`
`;
}

export function mdReverse() {
  return `
\`\`\`
sample file
┌─────┬────────┐
│ idx │ name   │
├─────┼────────┤
│  1  │ tom    │
│  2  │ jerry  │
│  3  | tansen |
└─────┴────────┘
\`\`\`

\`\`\`
Reverse result
┌─────┬────────┐
│ idx │ name   │
├─────┼────────┤
│  3  │ tansen │
│  2  │ jerry  │
│  1  | tom    |
└─────┴────────┘
\`\`\`
`;
}

export function mdSort() {
  return `
### Documents to be added...
`;
}

export function mdTranspose() {
  return `
\`\`\`
sample file
┌─────┬────────┐
│ idx │ name   │
├─────┼────────┤
│  1  │ tom    │
│  2  │ jerry  │
│  3  | tansen |
└─────┴────────┘
\`\`\`

\`\`\`
Transpose result
┌─────┬─────┬──────┬───────┐
│ idx │ 1   │ 2    │ 3     │
├─────┼─────┼──────┼───────┤
│ name│ tom │ jerry│ tansen│
└─────┴─────┴──────┴───────┘
\`\`\`
`;
}

export function mdSeparate() {
  return `
### Suggestion: set quoting to false
\`\`\`
   sample file            good file           bad file
┌─────┬────────┐      ┌─────┬────────┐     ┌─────┬────────┐
│ idx │ name   │  =>  │ idx │ name   │  +  │  1  │ tom,1  │
├─────┼────────┤      ├─────┼────────┤     └─────┴────────┘
│  1  │ tom,1  │      │  2  │ jerry  │
│  2  │ jerry  │      │  3  | tansen |
│  3  | tansen |      └─────┴────────┘
└─────┴────────┘
\`\`\`
`;
}

export function mdSlice() {
  return `
(Start: <u>1</u>; End: <u>2</u>)
\`\`\`
    test.csv             test_slice.csv
┌─────┬────────┐        ┌─────┬────────┐
│ idx │ name   │   =>   │ idx │ name   │
├─────┼────────┤        ├─────┼────────┤
│  1  │ tom    │        │  1  │ tom    │
│  2  │ jerry  │        │  2  │ jerry  │
│  3  | tansen |        └─────┴────────┘
└─────┴────────┘
\`\`\`
`;
}

export function mdIndex() {
  return `
### With an index, count & slice work instantaneously; and multithreading is enabled for the split.
---
### Slice only supports an index of skiprows equal to 0.
---
\`\`\`
`;
}

export function mdInsert() {
  return `
### position support: left, l, right, r, before, b, after, a
\`\`\`
sample file
┌─────┬───────┐
│ idx │ name  │
├─────┼───────┤
│  1  │ tom   │
│  2  │ ts    │
└─────┴───────┘
\`\`\`

(column: idx, position: <u>left|-1</u>, values: <u>CNY|3</u>)
\`\`\`
┌─────┬─────┬──────┬───┐
│ CNY | idx │ name | 3 │
├─────┼─────┼──────┼───┤
│ CNY |  1  │ tom  | 3 │
│ CNY |  2  │ ts   │ 3 |
└─────┴─────┴──────┴───┘
\`\`\`
`;
}

export function mdDedup() {
  return `
Remove duplicate rows from a CSV file...

### Modes
- **Keep First**: ...
- **Keep Last**: ...
- **Keep Duplicates**: ...
`;
}
