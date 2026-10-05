$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Deschide PowerShell ca administrator si ruleaza din nou acest script.'
}
& winget install --id Microsoft.WSL --exact --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
if ($LASTEXITCODE -ne 0) {
    & wsl --version
    if ($LASTEXITCODE -ne 0) { throw 'Instalarea WSL a esuat. Verifica mesajul de mai sus.' }
}
& wsl --install --no-distribution
if ($LASTEXITCODE -ne 0) { throw 'Configurarea WSL a esuat. Verifica mesajul de mai sus.' }
$docker = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
if (-not (Test-Path -LiteralPath $docker)) {
    & winget install --id Docker.DockerDesktop --exact --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
    if ($LASTEXITCODE -ne 0) { throw 'Instalarea Docker Desktop a esuat.' }
}
Write-Host 'Instalarea s-a terminat. Repornește Windows daca este cerut, apoi deschide Docker Desktop.'
Write-Host 'Verifica docker run --rm hello-world, apoi porneste Pregateste mediul.cmd din pachetul desktop.'
