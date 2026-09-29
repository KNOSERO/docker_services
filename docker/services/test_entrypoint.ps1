$ErrorActionPreference = 'Stop'

$root = Join-Path $PSScriptRoot 'test-fixture'
$bin = Join-Path $root 'bin'
$log = Join-Path $root 'calls.log'
New-Item -ItemType Directory -Force $bin | Out-Null
New-Item -ItemType File -Force $log | Out-Null

$mock = @'
#!/bin/sh
printf '%s\n' "$*" >> "$SERVICES_TEST_LOG"
'@
Set-Content (Join-Path $bin 'ansible-playbook') $mock -NoNewline
$bash = (Get-Command bash -ErrorAction SilentlyContinue).Source
if (-not $bash) {
    $bash = Join-Path ${env:ProgramFiles} 'Git\bin\bash.exe'
}
if (-not (Test-Path $bash)) { throw 'bash is required to run the entrypoint seam test' }
$mockPath = ((Join-Path $bin 'ansible-playbook') -replace '\\', '/')
& $bash -lc "chmod +x '$mockPath'"

$entrypoint = Get-Content (Join-Path $PSScriptRoot 'entrypoint.sh') -Raw
$replacement = 'PRIVATE_KEY="' + $root + '/id_home_lab"'
$entrypoint = $entrypoint -replace 'PRIVATE_KEY="/run/services-secrets/id_home_lab"', $replacement
$entrypoint = $entrypoint -replace 'install -d -m 0700 /root/.ssh', 'true'
$entrypoint = $entrypoint -replace 'install -m 0600 "\$PRIVATE_KEY" /root/.ssh/id_home_lab', 'true'
$entrypointPath = Join-Path $root 'entrypoint.sh'
Set-Content $entrypointPath $entrypoint -NoNewline
Set-Content (Join-Path $root 'id_home_lab') 'test-key'

$env:SERVICES_TEST_LOG = $log
$env:PATH = "$bin;$env:PATH"
& $bash $entrypointPath

$calls = Get-Content $log
if ($calls.Count -ne 5) { throw "Expected 5 Ansible stages, got $($calls.Count)" }
if ($calls[0] -notmatch 'prepare.yml') { throw 'Network preparation must be first' }
if ($calls[1] -notmatch 'onyx.*dns/playbook.yml') { throw 'DNS on onyx must be second' }
if ($calls[2] -notmatch 'ruby.*dns/playbook.yml') { throw 'DNS on ruby must be third' }
if ($calls[3] -notmatch 'ruby.*proxy/playbook.yml') { throw 'Proxy on ruby must be fourth' }
if ($calls[4] -notmatch 'ruby.*portainer/playbook.yml') { throw 'Portainer on ruby must be fifth' }

Remove-Item $root -Recurse -Force
Write-Output 'entrypoint seam test passed'
