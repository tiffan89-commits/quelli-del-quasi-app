param([Parameter(Mandatory=$true)][string]$InstallRoot)
$ErrorActionPreference='Stop';$root=(Resolve-Path -LiteralPath $InstallRoot).Path;$envFile=Join-Path $root 'config\app.env';$content=Get-Content -LiteralPath $envFile -Raw
if($content -notmatch '(?m)^SELFHOST_PREVIEW_KEY=([^\r\n]{32,})\r?$' -or $content -notmatch '(?m)^SELFHOST_TEST_INSTANCE=true\r?$'){throw 'Tunnel consentito solo per una prova privata con chiave di protezione'}
$key=[regex]::Match($content,'(?m)^SELFHOST_PREVIEW_KEY=([^\r\n]+)').Groups[1].Value
$port=[regex]::Match($content,'(?m)^PORT=(\d+)').Groups[1].Value;if(-not $port){$port='3000'}
$exe=Join-Path $root 'tools\cloudflared.exe';if(-not(Test-Path -LiteralPath $exe)){throw 'cloudflared.exe mancante: scaricarlo dalla release ufficiale Cloudflare'}
$pidFile=Join-Path $root 'data\tunnel.pid';$log=Join-Path $root 'logs\tunnel.err.log';$running=$null
if(Test-Path -LiteralPath $pidFile){$savedId=[int](Get-Content -LiteralPath $pidFile);$running=Get-CimInstance Win32_Process -Filter "ProcessId=$savedId" -ErrorAction SilentlyContinue;if($running -and $running.ExecutablePath -ne $exe){throw 'PID tunnel diverso: nessun processo estraneo modificato'}}
if(-not $running){$p=Start-Process -FilePath $exe -ArgumentList @('tunnel','--no-autoupdate','--url',"http://127.0.0.1:$port",'--protocol','http2','--loglevel','info') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root 'logs\tunnel.out.log') -RedirectStandardError $log -PassThru;$p.Id | Set-Content -LiteralPath $pidFile}
$origin=$null
for($i=0;$i -lt 30;$i++){if(Test-Path -LiteralPath $log){$text=Get-Content -LiteralPath $log -Raw;$match=[regex]::Match($text,'https://[a-z0-9-]+\.trycloudflare\.com');if($match.Success -and $text.Contains('Registered tunnel connection')){$origin=$match.Value;break}};Start-Sleep -Seconds 1}
if(-not $origin){throw 'Tunnel non pronto: consultare logs/tunnel.err.log'}
$configured=[regex]::Match($content,'(?m)^PUBLIC_ORIGIN=([^\r\n]+)').Groups[1].Value
if($configured -ne $origin){$content=[regex]::Replace($content,'(?m)^PUBLIC_ORIGIN=[^\r\n]+','PUBLIC_ORIGIN='+$origin);[IO.File]::WriteAllText($envFile,$content,[Text.UTF8Encoding]::new($false));& (Join-Path $PSScriptRoot 'Stop-Local.ps1') -InstallRoot $root;& (Join-Path $PSScriptRoot 'Start-Local.ps1') -InstallRoot $root}
[IO.File]::WriteAllText((Join-Path $root 'config\test-link.txt'),$origin+'/_preview/access?key='+$key+"`n",[Text.UTF8Encoding]::new($false))
Write-Output 'Tunnel HTTPS protetto pronto; link privato nel file config/test-link.txt. Non pubblicare questo file.'
