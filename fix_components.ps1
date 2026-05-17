Get-ChildItem -Path "src/views/cmd/components" -Filter "*.vue" | ForEach-Object {
    $content = Get-Content -Path $_.FullName -Raw
    $modified = $false
    
    # 添加 import "./common.css";
    if ($content -notmatch 'import "./common.css"') {
        $content = $content -replace '(import \{ message \} from "@/utils/message")', "`$1`nimport `"./common.css`""
        $modified = $true
    }
    
    # 替换未被替换的 class 名称
    $replacements = @(
        @('class="file-selection-bar"', 'class="cmd-file-selection-bar"'),
        @('class="mode-toggle"', 'class="cmd-mode-toggle"'),
        @('class="mode-item"', 'class="cmd-mode-item"'),
        @('class="options-grid"', 'class="cmd-options-grid"'),
        @('class="option-section"', 'class="cmd-option-section"'),
        @('class="option-label"', 'class="cmd-option-label"'),
        @('class="stats-grid"', 'class="cmd-stats-grid"'),
        @('class="stat-card"', 'class="cmd-stat-card"'),
        @('class="stat-value"', 'class="cmd-stat-value"'),
        @('class="stat-label"', 'class="cmd-stat-label"'),
        @('class="preview-header"', 'class="cmd-preview-header"'),
        @('class="preview-title"', 'class="cmd-preview-title"'),
        @('class="mode-badge"', 'class="cmd-mode-badge"'),
        @('class="mode-toggle-inline"', 'class="cmd-mode-toggle-inline"'),
        @('class="toggle-item"', 'class="cmd-toggle-item"')
    )
    
    foreach ($replacement in $replacements) {
        if ($content -match $replacement[0]) {
            $content = $content -replace [regex]::Escape($replacement[0]), $replacement[1]
            $modified = $true
        }
    }
    
    if ($modified) {
        Set-Content -Path $_.FullName -Value $content -NoNewline
        Write-Host "Updated: $($_.Name)"
    }
}