param([Parameter(Mandatory=$true)][string]$InstallRoot)
$ErrorActionPreference='Stop';$root=(Resolve-Path -LiteralPath $InstallRoot).Path
if(-not(Test-Path -LiteralPath (Join-Path $root 'app\runtime\server.mjs'))){throw 'Installazione non riconosciuta'}
# Stop the writers before invoking this script; no automatic service interruption.
foreach($name in @('QuasiWeb','QuasiWorker')){if((Get-Service -Name $name -ErrorAction SilentlyContinue).Status -eq 'Running'){throw 'Fermare prima web e worker per ottenere DB e file coerenti'}}
foreach($kind in @('server','worker')){$pidFile=Join-Path $root "data\$kind.pid";if(Test-Path -LiteralPath $pidFile){$id=[int](Get-Content $pidFile);if(Get-Process -Id $id -ErrorAction SilentlyContinue){throw "Fermare il processo locale $kind prima del backup"}}}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss';$dest=Join-Path $root "backups\$stamp";New-Item -ItemType Directory -Path $dest | Out-Null
$ownerEnv=Get-Content -LiteralPath (Join-Path $root 'config\owner.env') | Where-Object {$_ -like 'DATABASE_URL=*'} | Select-Object -First 1
if(-not $ownerEnv){throw 'Connessione proprietario mancante'}
$dbUri=[Uri]::new($ownerEnv.Substring(13));$parts=$dbUri.UserInfo.Split(':',2)
$activeLine=Get-Content -LiteralPath (Join-Path $root 'config\app.env') | Where-Object {$_ -like 'DATABASE_URL=*'} | Select-Object -First 1
if(-not $activeLine){throw 'Connessione app attiva mancante'}
$activeUri=[Uri]::new($activeLine.Substring(13));$database=[Uri]::UnescapeDataString($activeUri.AbsolutePath.TrimStart('/'))
if($dbUri.Host -notin @('127.0.0.1','localhost','::1') -or $activeUri.Host -ne $dbUri.Host -or $activeUri.Port -ne $dbUri.Port -or $database -notmatch '^quasi[a-zA-Z0-9_]*$'){throw 'Database attivo fuori dal cluster locale previsto'}
try{$env:PGPASSWORD=[Uri]::UnescapeDataString($parts[1]);& (Join-Path $root 'tools\pg18\pgsql\bin\pg_dump.exe') -h $dbUri.Host -p $dbUri.Port -U ([Uri]::UnescapeDataString($parts[0])) -d $database -Fc --no-owner --no-acl -f (Join-Path $dest 'database.dump');if($LASTEXITCODE -ne 0){throw 'pg_dump non completato'}}finally{Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue}
Copy-Item -LiteralPath (Join-Path $root 'config') -Destination (Join-Path $dest 'config') -Recurse
$dataLine=Get-Content -LiteralPath (Join-Path $root 'config\app.env') | Where-Object {$_ -like 'SELFHOST_DATA_DIR=*'} | Select-Object -First 1
$state=if($dataLine){[IO.Path]::GetFullPath($dataLine.Substring(18))}else{Join-Path $root 'data'}
if(-not($state.TrimEnd('\') -eq (Join-Path $root 'data') -or $state.StartsWith((Join-Path $root 'data')+'\',[StringComparison]::OrdinalIgnoreCase))){throw 'Cartella dati fuori dalla installazione: verificare il percorso prima del backup'}
if(Test-Path -LiteralPath (Join-Path $state 'blobs')){Copy-Item -LiteralPath (Join-Path $state 'blobs') -Destination (Join-Path $dest 'blobs') -Recurse}
if(Test-Path -LiteralPath (Join-Path $state 'jobs')){Copy-Item -LiteralPath (Join-Path $state 'jobs') -Destination (Join-Path $dest 'jobs') -Recurse}
foreach($name in @('ddns-state.json','caddy','caddy-config')){if(Test-Path -LiteralPath (Join-Path $root "data\$name")){Copy-Item -LiteralPath (Join-Path $root "data\$name") -Destination (Join-Path $dest $name) -Recurse}}
Get-FileHash -LiteralPath (Join-Path $dest 'database.dump') -Algorithm SHA256 | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dest 'checksum.json')
Write-Output "Backup locale completo: $dest. Contiene dati personali e chiavi: cifrarlo prima di spostarlo fuori dal PC."
