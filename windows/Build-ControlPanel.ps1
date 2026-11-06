param([string]$InstallRoot='C:\ProgramData\QuelliDelQuasiServer')
$ErrorActionPreference='Stop'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(-not(Test-Path -LiteralPath $compiler)){throw 'Compilatore .NET Framework Windows non disponibile'}
$root=(Resolve-Path -LiteralPath $InstallRoot).Path
if(-not(Test-Path -LiteralPath (Join-Path $root 'app\runtime\admin-control.mjs'))){throw 'Controller locale non installato'}
$dest=Join-Path $root 'control';New-Item -ItemType Directory -Path $dest -Force | Out-Null
& $compiler /nologo /target:winexe /optimize+ /reference:System.Windows.Forms.dll /reference:System.Drawing.dll ('/out:'+(Join-Path $dest 'Quasi-Server.exe')) (Join-Path $PSScriptRoot 'control\ServerPanel.cs')
if($LASTEXITCODE -ne 0){throw 'Compilazione pannello non riuscita'}
Write-Output (Join-Path $dest 'Quasi-Server.exe')
