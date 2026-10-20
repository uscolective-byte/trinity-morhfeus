$ErrorActionPreference='Stop'
try {
 $inputData=[Console]::In.ReadToEnd() | ConvertFrom-Json
 if($inputData.name -notmatch '^[a-z][a-z0-9-]{0,50}$'){throw 'name'}
 $directory=[string]$inputData.directory
 New-Item -ItemType Directory -Force -Path $directory | Out-Null
 $file=Join-Path $directory ($inputData.name+'.dpapi')
 $value=''
 if($inputData.operation -eq 'set'){
  $protected=ConvertFrom-SecureString (ConvertTo-SecureString ([string]$inputData.value) -AsPlainText -Force)
  [IO.File]::WriteAllText($file,$protected)
 }elseif($inputData.operation -eq 'get'){
  if(Test-Path -LiteralPath $file){
   $secure=ConvertTo-SecureString ([IO.File]::ReadAllText($file))
   $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
   try{$value=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
  }
 }else{throw 'operation'}
 @{value=$value}|ConvertTo-Json -Compress
}catch{[Console]::Error.WriteLine('Credential storage operation failed.');exit 1}
