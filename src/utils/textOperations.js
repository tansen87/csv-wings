import { invoke } from "@tauri-apps/api/core";
export async function openFile(params) {
    return await invoke("open_file", { params });
}
export async function getFileContent(params) {
    return await invoke("get_file_content", { params });
}
export async function searchFile(params) {
    return await invoke("search_file", { params });
}
export async function replaceText(params) {
    await invoke("close_file", { path: params.path });
    return await invoke("replace_text", {
        params: {
            ...params,
            encoding: params.encoding || "UTF-8"
        }
    });
}
export async function closeFile(path) {
    return await invoke("close_file", { path });
}
export async function cleanupSessions() {
    return await invoke("cleanup_sessions");
}
//# sourceMappingURL=textOperations.js.map