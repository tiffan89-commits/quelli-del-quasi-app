param([Parameter(Mandatory=$true)][string]$InstallRoot,[switch]$Database)
$ErrorActionPreference='Stop';$root=(Resolve-Path -LiteralPath $InstallRoot).Path;$envFile=Join-Path $root 'config\app.env'
if(-not(Test-Path -LiteralPath (Join-Path $root 'app\runtime\server.mjs'))){throw 'Installazione non riconosciuta'}
foreach($kind in @('server','worker')){
 $file=Join-Path $root "data\$kind.pid";if(-not(Test-Path -LiteralPath $file)){continue};$id=[int](Get-Content -LiteralPath $file)
 $p=Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
 if($p){if(-not $p.CommandLine.Contains($envFile) -or $p.CommandLine -notlike "*runtime/$kind.mjs*"){throw 'PID non riconosciuto: nessun processo estraneo terminato'};Stop-Process -Id $id}
 Remove-Item -LiteralPath $file
}
if($Database){& (Join-Path $root 'tools\pg18\pgsql\bin\pg_ctl.exe') stop -D (Join-Path $root 'data\postgres18') -m fast -w;if($LASTEXITCODE -ne 0){throw 'Database non fermato'}}
