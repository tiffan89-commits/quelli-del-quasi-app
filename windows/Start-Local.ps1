param([Parameter(Mandatory=$true)][string]$InstallRoot,[int]$DatabasePort=55433,[switch]$WithTunnel)
$ErrorActionPreference='Stop';$root=(Resolve-Path -LiteralPath $InstallRoot).Path
if(-not(Test-Path -LiteralPath (Join-Path $root 'app\runtime\server.mjs'))){throw 'Cartella installazione non valida'}
$pg=Join-Path $root 'tools\pg18\pgsql\bin\pg_ctl.exe'
& $pg status -D (Join-Path $root 'data\postgres18') | Out-Null
if($LASTEXITCODE -ne 0){& $pg start -D (Join-Path $root 'data\postgres18') -l (Join-Path $root 'logs\postgres.log') -o "-p $DatabasePort -h 127.0.0.1" -w;if($LASTEXITCODE -ne 0){throw 'Database non avviato'}}
$node=(Get-Command node.exe).Source;$app=Join-Path $root 'app';$envFile=Join-Path $root 'config\app.env'
foreach($kind in @('server','worker')){
 $pidFile=Join-Path $root "data\$kind.pid"
 if(Test-Path -LiteralPath $pidFile){$savedId=[int](Get-Content -LiteralPath $pidFile);$running=Get-CimInstance Win32_Process -Filter "ProcessId=$savedId" -ErrorAction SilentlyContinue;if($running -and $running.CommandLine -like "*runtime/$kind.mjs*" -and $running.CommandLine.Contains($envFile)){continue}}
 $p=Start-Process -FilePath $node -ArgumentList @('--env-file="'+$envFile+'"',"runtime/$kind.mjs") -WorkingDirectory $app -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root "logs\$kind.out.log") -RedirectStandardError (Join-Path $root "logs\$kind.err.log") -PassThru
 $p.Id | Set-Content -LiteralPath $pidFile
}
$portLine=Get-Content -LiteralPath $envFile | Where-Object {$_ -match '^PORT=\d+$'} | Select-Object -First 1
$appPort=if($portLine){[int]$portLine.Substring(5)}else{3000};$ready=$false
for($attempt=0;$attempt -lt 50;$attempt++){try{$health=Invoke-RestMethod -Uri "http://127.0.0.1:$appPort/healthz" -TimeoutSec 2;if($health.ok){$ready=$true;break}}catch{};Start-Sleep -Milliseconds 100}
if(-not $ready){throw 'Il web non risponde: controllare logs/server.err.log prima di proseguire'}
if($WithTunnel){& (Join-Path $PSScriptRoot 'Start-Tunnel.ps1') -InstallRoot $root}
Write-Output 'Database, web e worker verificati nella sessione utente. Per avvio prima del login Windows usare Install-Services.ps1.'
