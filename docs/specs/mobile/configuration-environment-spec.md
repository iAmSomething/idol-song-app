# Configuration and Environment Spec

## 1. 목적
이 문서는 모바일 앱 구현 시 필요한 환경 구성, 데이터 소스 선택, 빌드 설정 원칙을 정의한다.
문서 없이 시작하면 dev/test/prod가 섞이거나, bundled data와 remote data가 혼재될 가능성이 높다.

## 2. 환경 분리 원칙
- 최소 `development`, `preview`, `production` 3단계를 상정한다.
- 환경 차이는 라우팅 구조가 아니라 데이터 소스, 로깅 강도, feature gate 범위에만 영향을 준다.

## 3. 데이터 소스 전략
### 3.1 v1 권장
- 앱 번들 또는 versioned static JSON을 읽는다.
- 동일 빌드에서 dataset source를 혼합하지 않는다.

### 3.2 preview 환경
- 실험용 dataset version 지정이 가능해야 한다.
- 단, preview에서도 field contract는 production과 동일해야 한다.

### 3.3 production 환경
- known-good dataset만 소비한다.
- incomplete experimental field를 production build에 섞지 않는다.

## 4. 환경 변수 원칙
- URL, analytics key, remote dataset location은 env 기반 분리 가능해야 한다.
- 서비스 handoff URL builder는 env와 무관한 deterministic 로직으로 유지한다.
- secret은 앱 코드에 하드코딩하지 않는다.

## 5. Feature gate 원칙
- Radar, analytics, remote refresh, MV embed 등은 feature gate 후보가 될 수 있다.
- gate는 화면 구조를 깨지 않는 수준에서만 사용한다.
- gate off 시 fallback UI가 문서화되어야 한다.

## 6. Asset 원칙
- placeholder asset, service icon, badge fallback asset은 앱 번들에 포함한다.
- runtime에서 반드시 필요한 핵심 UI asset은 네트워크 의존을 두지 않는다.

## 7. Build metadata
- build version, dataset version, commit hash를 debug surface에서 확인할 수 있으면 좋다.
- 일반 사용자 메인 화면에는 운영 지표를 노출하지 않는다.

## 8. Failure policy
- remote dataset unavailable이면 last-known-good 또는 bundled dataset fallback이 필요하다.
- env misconfiguration은 app crash보다 safe degraded mode로 처리해야 한다.

## 9. QA 체크포인트
- preview/production의 data contract 차이로 crash가 없어야 한다.
- feature gate on/off에서 primary CTA와 layout이 무너지지 않아야 한다.
- placeholder asset만으로도 화면이 최소 렌더링 가능해야 한다.
