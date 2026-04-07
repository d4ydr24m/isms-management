# 프로젝트 정보
- PowerShell 5.1+ (Windows 기본 내장)
- 용도: ISMS-P Windows PC 취약점 점검 자동화 스크립트
- 대상 환경: Windows 10·11 클라이언트 PC
- 스크립트: scripts/isms_vuln_check_windows.ps1, scripts/pc_security_v2.1.ps1
- 실행 방식: 관리자 권한 자동 승격(Self-elevation) 후 실행

# PowerShell 보안 점검

## Injection
- `Invoke-Expression`(IEX) 사용 금지 → 직접 cmdlet 호출 또는 ScriptBlock 사용
  (IEX는 입력 문자열을 그대로 실행하므로 코드 인젝션의 주요 원인)
- `[ScriptBlock]::Create($userInput)` 도 동일하게 위험 → 사용 금지
- 외부 입력을 문자열 조합으로 명령에 포함 금지
  → 파라미터 바인딩 또는 ArgumentList로 전달
  ```powershell
  # 금지: 문자열 조합
  Invoke-Expression "Get-Process -Id $userInput"
  # 권장: ScriptBlock + ArgumentList
  Invoke-Command -ScriptBlock { param($id) Get-Process -Id $id } -ArgumentList $userInput
  ```
- 파라미터에 반드시 타입 지정: `[int]`, `[string]` 등으로 입력값 제한
- SQL 쿼리 실행 시 `Invoke-Sqlcmd`에 문자열 연결 금지
  → `-Variable` 파라미터 또는 parameterized query 사용

## 자격 증명(Credential) 관리
- 스크립트에 비밀번호, API 키, 토큰 평문 하드코딩 절대 금지
- `ConvertTo-SecureString "password" -AsPlainText` 패턴을 스크립트에 직접 사용 금지
- 자격 증명 저장: Windows Credential Manager, Azure Key Vault,
  또는 `Export-Clixml`(DPAPI 암호화) 사용
  ```powershell
  # 자격 증명 저장 (현재 사용자만 복호화 가능)
  Get-Credential | Export-Clixml -Path "$env:USERPROFILE\cred.xml"
  # 자격 증명 로드
  $cred = Import-Clixml -Path "$env:USERPROFILE\cred.xml"
  ```
- `Get-Credential` cmdlet으로 대화형 입력 유도 권장

## 실행 정책 및 서명
- 프로덕션 환경: `AllSigned` 또는 `RemoteSigned` 실행 정책 사용
- `-ExecutionPolicy Bypass` 플래그를 스크립트 내에서 호출하지 마라
- 배포용 스크립트는 코드 서명 인증서로 서명 권장

## 원격 실행
- `Invoke-Command -ComputerName`에 사용자 입력을 직접 전달 금지
  → 화이트리스트로 대상 서버 검증
- 원격 세션 시 `-UseSSL` 옵션 사용 권장
- WinRM 설정: HTTPS 리스너 사용, HTTP 리스너 비활성화

## 파일 및 경로
- 사용자 입력을 파일 경로에 직접 사용 금지
  → `Resolve-Path`, `Join-Path`로 정규화, `..` 경로 탈출 검증
- 임시 파일: `[System.IO.Path]::GetTempFileName()` 또는 `New-TemporaryFile` 사용
  예측 가능한 파일명 금지
- 다운로드한 파일은 실행 전 `Get-AuthenticodeSignature`로 서명 검증

## 로깅 및 감사
- 보안 이벤트(인증 실패, 권한 변경, 설정 변경)는 반드시 로깅
- 로그에 비밀번호, 토큰 등 민감정보 출력 금지
- 프로덕션 환경: ScriptBlock Logging, Module Logging, Transcription 활성화 권장

## 기타
- `Net.WebClient`나 `Invoke-WebRequest`로 외부 스크립트 다운로드 후
  `| IEX` 파이프 실행 절대 금지
- `Add-Type`으로 인라인 C# 컴파일 시 외부 입력 포함 금지
- `-Confirm`, `-WhatIf` 지원: 시스템 변경 함수에 `SupportsShouldProcess` 구현

# PowerShell 품질 규칙
- `Set-StrictMode -Version Latest` 사용 권장
- `$ErrorActionPreference = 'Stop'` 설정으로 에러 시 즉시 중단
- `try/catch/finally`로 에러 처리, 빈 catch 블록 금지
- 함수 이름: Verb-Noun 형식 (`Get-Approved Verbs` 준수)
- 파라미터: `[CmdletBinding()]`과 `[Parameter()]` 어트리뷰트 사용
- 변수/문자열: 변수 확장 불필요 시 작은따옴표(`'`) 사용
- 출력: `Write-Host` 대신 `Write-Output` 또는 `Write-Verbose` 사용
  (`Write-Host`는 파이프라인 출력 불가)
- PSScriptAnalyzer 경고 무시 금지