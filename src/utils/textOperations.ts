import { invoke } from "@tauri-apps/api/core";

export interface FileInfo {
  path: string;
  size: number;
  encoding: string;
  line_count: number;
}

export interface SearchMatch {
  line_number: number;
  line_content: string;
  match_start: number;
  match_length: number;
  byte_offset: number;
}

export interface SearchResult {
  total_matches: number;
  matches: SearchMatch[];
  page: number;
  page_size: number;
}

export interface OpenFileParams {
  path: string;
  encoding?: string;
}

export interface GetLinesParams {
  path: string;
  start_line: number;
  end_line: number;
  encoding?: string;
}

export interface SearchParams {
  path: string;
  query: string;
  case_sensitive: boolean;
  use_regex: boolean;
  page: number;
  page_size: number;
}

export interface ReplaceParams {
  path: string;
  search_query: string;
  replace_text: string;
  replace_all: boolean;
  case_sensitive: boolean;
  encoding?: string;
}

export async function openFile(params: OpenFileParams): Promise<FileInfo> {
  return await invoke("open_file", { params });
}

export async function getFileContent(
  params: GetLinesParams
): Promise<string[]> {
  return await invoke("get_file_content", { params });
}

export async function searchFile(params: SearchParams): Promise<SearchResult> {
  return await invoke("search_file", { params });
}

export async function replaceText(params: ReplaceParams): Promise<number> {
  // 关闭缓存
  await invoke("close_file", { path: params.path });
  // 调用流式替换
  return await invoke("replace_text", {
    params: {
      ...params,
      encoding: params.encoding || "UTF-8"
    }
  });
}

export async function closeFile(path: string): Promise<void> {
  return await invoke("close_file", { path });
}
