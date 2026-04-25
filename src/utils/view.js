import { open } from '@tauri-apps/plugin-dialog';
export async function viewOpenFile(multiple, type, filters) {
    const result = await open({
        multiple,
        filters: [
            {
                name: type === 'text' ? 'Text Files' : 'All Files',
                extensions: filters
            }
        ]
    });
    if (result) {
        if (Array.isArray(result)) {
            return result[0];
        }
        return result;
    }
    return null;
}
//# sourceMappingURL=view.js.map