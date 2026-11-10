param([Parameter(Mandatory=$true)][string]$InstallRoot,[string]$Domain='casa.quellidelquasi.com',[int]$AppPort=8845,[int]$DatabasePort=55433)
$ErrorActionPreference='Stop'
$principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Apri PowerShell come amministratore: Windows deve autorizzare la installazione dei servizi.'}
$root=(Resolve-Path -LiteralPath $InstallRoot).Path
if(-not(Test-Path -LiteralPath (Join-Path $root 'app\runtime\server.mjs')) -or -not(Test-Path -LiteralPath (Join-Path $root 'data\postgres18\PG_VERSION'))){throw 'Cartella server non riconosciuta: nessuna modifica eseguita.'}
if($Domain -notmatch '^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$'){throw 'Dominio non valido'}
$node=(Get-Command node.exe).Source
$guard=Join-Path $root 'tools\QuasiMemoryGuard.exe'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
foreach($file in @('tools\winsw.exe','tools\caddy.exe','config\app.env')){if(-not(Test-Path -LiteralPath (Join-Path $root $file))){throw "File mancante: $file"}}
foreach($name in @('QuasiPostgres','QuasiWeb','QuasiWorker','QuasiCaddy')){if(Get-Service -Name $name -ErrorAction SilentlyContinue){throw "Servizio $name già presente. Usare la procedura di aggiornamento, senza reinstallarlo."}}
& $compiler /nologo /platform:x64 "/out:$guard" (Join-Path $PSScriptRoot 'MemoryGuard.cs')
if($LASTEXITCODE -ne 0){throw 'Compilazione del limite di memoria non riuscita'}
$services=Join-Path $root 'services';New-Item -ItemType Directory -Path $services -Force | Out-Null
function Xml([string]$value){$separator=[string][char]92;[Security.SecurityElement]::Escape($value.Replace($separator+$separator,$separator))}
# All permission changes stay within this explicitly selected server directory.
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().Name
function Set-PrivateAcl([string]$target,[string[]]$readers,[string[]]$writers){
 $item=Get-Item -LiteralPath $target;$acl=Get-Acl -LiteralPath $target;$acl.SetAccessRuleProtection($true,$false)
 foreach($r in @($acl.Access)){$acl.RemoveAccessRuleSpecific($r)}
 $inherit=if($item.PSIsContainer){[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'}else{[Security.AccessControl.InheritanceFlags]::None}
 foreach($id in @($owner,'S-1-5-18','S-1-5-32-544')){$who=if($id -like 'S-*'){[Security.Principal.SecurityIdentifier]::new($id)}else{[Security.Principal.NTAccount]::new($id)};$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($who,'FullControl',$inherit,'None','Allow'))}
 foreach($id in $readers){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'ReadAndExecute',$inherit,'None','Allow'))}
 foreach($id in $writers){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'Modify',$inherit,'None','Allow'))}
 Set-Acl -LiteralPath $target -AclObject $acl
}
Set-PrivateAcl $root @('S-1-5-19','S-1-5-20') @()
Set-PrivateAcl (Join-Path $root 'data') @() @('S-1-5-19')
Set-PrivateAcl (Join-Path $root 'data\postgres18') @() @('S-1-5-20')
Set-PrivateAcl (Join-Path $root 'logs') @() @('S-1-5-19','S-1-5-20')
Set-PrivateAcl (Join-Path $root 'config') @('S-1-5-19') @()
foreach($name in @('owner.env','db-owner-password.txt')){if(Test-Path -LiteralPath (Join-Path $root "config\$name")){Set-PrivateAcl (Join-Path $root "config\$name") @() @()}}
@"
$Domain {
 encode zstd gzip
 header {
  X-Content-Type-Options nosniff
  Referrer-Policy no-referrer
  X-Frame-Options DENY
 }
 reverse_proxy 127.0.0.1:$AppPort
}
"@ | Set-Content -LiteralPath (Join-Path $root 'config\Caddyfile') -Encoding utf8
function Add-QuasiService([string]$id,[string]$exe,[string]$arguments,[string]$account,[string]$depend='',[string]$extra=''){
 $destination=Join-Path $services "$id.exe";Copy-Item -LiteralPath (Join-Path $root 'tools\winsw.exe') -Destination $destination
 $dependency=if($depend){'<depend>'+$(Xml $depend)+'</depend>'}else{''}
 $content='<service><id>'+$id+'</id><name>Quelli del Quasi - '+$id+'</name><description>Server autonomo Quelli del Quasi</description><executable>'+$(Xml $exe)+'</executable><arguments>'+$(Xml $arguments)+'</arguments><workingdirectory>'+$(Xml (Join-Path $root 'app'))+'</workingdirectory><serviceaccount><domain>NT AUTHORITY</domain><user>'+$account+'</user></serviceaccount><startmode>Automatic</startmode><delayedAutoStart>true</delayedAutoStart><onfailure action="restart" delay="10 sec"/><stoptimeout>60 sec</stoptimeout><logpath>'+$(Xml (Join-Path $root 'logs'))+'</logpath><log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>8</keepFiles></log>'+$dependency+$extra+'</service>'
 [IO.File]::WriteAllText((Join-Path $services "$id.xml"),$content,[Text.UTF8Encoding]::new($false));& $destination install;if($LASTEXITCODE -ne 0){throw "Installazione $id non riuscita"}
}
$pg=Join-Path $root 'tools\pg18\pgsql\bin\pg_ctl.exe'
& $pg status -D (Join-Path $root 'data\postgres18') | Out-Null
if($LASTEXITCODE -eq 0){& $pg stop -D (Join-Path $root 'data\postgres18') -m fast -w;if($LASTEXITCODE -ne 0){throw 'Arresto database non completato'}}
Add-QuasiService 'QuasiPostgres' (Join-Path $root 'tools\pg18\pgsql\bin\postgres.exe') ('-D "'+(Join-Path $root 'data\postgres18')+'" -p '+$DatabasePort+' -h 127.0.0.1') 'NetworkService'
$guardEnv='<env name="SELFHOST_MEMORY_GUARD" value="'+$(Xml $guard)+'"/>'
Add-QuasiService 'QuasiWeb' $node ('--env-file="'+(Join-Path $root 'config\app.env')+'" runtime/server.mjs') 'LocalService' 'QuasiPostgres' $guardEnv
Add-QuasiService 'QuasiWorker' $node ('--env-file="'+(Join-Path $root 'config\app.env')+'" runtime/worker.mjs') 'LocalService' 'QuasiPostgres' $guardEnv
$extra='<env name="XDG_DATA_HOME" value="'+$(Xml (Join-Path $root 'data\caddy'))+'"/><env name="XDG_CONFIG_HOME" value="'+$(Xml (Join-Path $root 'data\caddy-config'))+'"/>'
Add-QuasiService 'QuasiCaddy' (Join-Path $root 'tools\caddy.exe') ('run --config "'+(Join-Path $root 'config\Caddyfile')+'" --adapter caddyfile') 'LocalService' 'QuasiWeb' $extra
foreach($port in @(80,443)){if(-not(Get-NetFirewallRule -Name "QuasiWeb$port" -ErrorAction SilentlyContinue)){New-NetFirewallRule -Name "QuasiWeb$port" -DisplayName "Quelli del Quasi HTTPS/HTTP $port" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -Program (Join-Path $root 'tools\caddy.exe') | Out-Null}}
foreach($name in @('QuasiPostgres','QuasiWeb','QuasiWorker','QuasiCaddy')){Start-Service -Name $name}
Get-Service QuasiPostgres,QuasiWeb,QuasiWorker,QuasiCaddy | Select-Object Name,Status,StartType
