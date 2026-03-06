# Screen Delivery Checklists

## 1. 목적
이 문서는 각 화면이 구현 완료로 인정되기 위해 체크해야 할 항목을 정리한다.
개발자는 PR 전 self-check 용도로 사용하고, PM/QA는 handoff 기준으로 사용한다.

## 2. Calendar Screen Checklist
- [ ] Month navigation 동작
- [ ] Monthly Summary Strip 렌더링
- [ ] Calendar/List segment 전환
- [ ] Day Cell selected 상태 시각 강조
- [ ] Date Detail Sheet open/close
- [ ] Verified / Scheduled 섹션 분리
- [ ] Team Detail push
- [ ] Release Detail push
- [ ] Service handoff 동작
- [ ] empty day 대응
- [ ] partial data 대응
- [ ] filter 적용 후 상태 유지

## 3. Radar Screen Checklist
- [ ] Featured card 노출
- [ ] Weekly section 정렬
- [ ] Change section 렌더링/empty 처리
- [ ] Long-gap section 렌더링/empty 처리
- [ ] Rookie section 렌더링/empty 처리
- [ ] Team Detail push
- [ ] source external open
- [ ] filter 적용 후 featured 재계산

## 4. Search Screen Checklist
- [ ] Search input 입력/clear
- [ ] Team / Release / Upcoming segment 전환
- [ ] alias 검색 동작
- [ ] no-result 상태
- [ ] recent search 재실행
- [ ] recent search clear
- [ ] Release Detail push
- [ ] Team Detail push
- [ ] secondary service action 충돌 없음

## 5. Team Detail Checklist
- [ ] Hero 렌더링
- [ ] Official links fallback
- [ ] Next comeback section
- [ ] Latest release card CTA 순서
- [ ] Recent album carousel or single-card fallback
- [ ] Release Detail push
- [ ] service handoff 동작

## 6. Release Detail Checklist
- [ ] Cover / meta 렌더링
- [ ] Album-level service buttons
- [ ] Track list 렌더링
- [ ] Title / double-title 표시
- [ ] Track-level service handoff
- [ ] MV block 있음/없음 처리
- [ ] notes/credits/source fallback

## 7. 공통 Checklist
- [ ] Primary / Service / Meta 위계 유지
- [ ] empty / error / partial 상태 처리
- [ ] accessibility label 점검
- [ ] Dynamic Type 레이아웃 점검
- [ ] back navigation state 복원
