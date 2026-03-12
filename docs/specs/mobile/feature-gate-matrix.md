# Feature Gate Matrix

## 1. 목적
이 문서는 모바일 MVP에서 feature gate 대상이 될 수 있는 기능과 gate off 시 fallback 동작을 정의한다.

## 2. 원칙
- gate는 구조를 숨기기 위한 수단이지, 깨진 화면을 방치하는 수단이 아니다.
- gate off 상태에서도 화면 레이아웃과 핵심 CTA는 유지되어야 한다.
- gate는 문서와 동일한 이름으로 관리되어야 한다.

## 3. 후보 기능
### 3.1 Radar
- gate name: `radar_enabled`
- off fallback: 탭 숨김 또는 read-only placeholder

### 3.2 MV embed
- gate name: `mv_embed_enabled`
- off fallback: `YouTube에서 보기` external CTA만 유지

### 3.3 Analytics
- gate name: `analytics_enabled`
- off fallback: 이벤트 미발행, UI 변화 없음

### 3.4 Remote dataset refresh
- gate name: `remote_dataset_enabled`
- off fallback: cached backend snapshot 유지, 없으면 explicit error

### 3.5 Share actions
- gate name: `share_actions_enabled`
- off fallback: 공유 버튼 비노출

## 4. Gate 적용 규칙
- gate는 component 내부 분기보다 screen/container 레벨에서 적용하는 것이 우선이다.
- 하나의 화면에서 gate 때문에 primary CTA가 사라지면 안 된다.
- gate 이름은 analytics/logging에서 동일하게 추적 가능해야 한다.

## 5. QA 체크포인트
- gate on/off 모두에서 layout 깨짐이 없어야 한다.
- MV embed off여도 Release Detail의 소비 흐름이 유지되어야 한다.
- remote_dataset_enabled off 상태에서도 cache가 있으면 화면 구조를 유지하고, 없으면 explicit error로 끝나야 한다.
