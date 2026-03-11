# iOS Preview Signing For A Personal Apple Team

## 목적
- preview dev-client를 특정 하드코딩 team에 묶지 않고, 개인 Apple ID team에서도 반복 가능하게 설치한다.
- Xcode-first와 CLI-first 경로를 둘 다 문서화한다.

## 현재 기준
- checked-in iOS project는 `IdolSongAppPreview.signing.local.xcconfig`가 있으면 그 값을 우선 사용한다.
- Expo config는 `EXPO_IOS_APPLE_TEAM_ID`, `EXPO_IOS_BUNDLE_IDENTIFIER`가 있으면 prebuild/run 시 같은 값을 쓴다.
- versioned 기본값은 simulator-safe preview identifier만 유지하고, team id는 비워 둔다.

## 로컬 준비
1. 개인 Apple team id를 확인한다.
   - Xcode `Settings > Accounts > <Apple ID> > Team Details`
   - 또는 `Membership Details`에 보이는 10자리 team id
2. 개인 team 아래에서 쓸 preview bundle identifier를 정한다.
   - 예시: `com.<your-name>.idolsongapp.preview`
   - 규칙: reverse-DNS 형식, 현재 team 안에서 유일해야 한다.

## 빠른 준비 스크립트
```bash
cd mobile
npm run qa:preview:ios:signing:prepare -- \
  --team-id ABCDE12345 \
  --bundle-id com.example.idolsongapp.preview
```

위 명령은 아래 파일을 만든다.
- `mobile/ios/IdolSongAppPreview/Supporting/IdolSongAppPreview.signing.local.xcconfig`

파일 내용은 최소 두 줄이다.
```xcconfig
DEVELOPMENT_TEAM = ABCDE12345
PRODUCT_BUNDLE_IDENTIFIER = com.example.idolsongapp.preview
```

이 파일은 `.gitignore`에 포함되며 로컬 machine 전용이다.

## Xcode-first install path
1. `mobile/ios/IdolSongAppPreview.xcworkspace`를 연다.
2. target `IdolSongAppPreview`의 `Signing & Capabilities`를 확인한다.
3. `Automatically manage signing`을 유지한다.
4. `Team`이 개인 Apple team으로 잡히는지 확인한다.
5. `Bundle Identifier`가 로컬 override 값과 같은지 확인한다.
6. 실제 iPhone을 연결한 뒤 target device로 선택한다.
7. 첫 install이면 iPhone에서 `Settings > General > VPN & Device Management`에서 신뢰를 허용한다.
8. 이후 `Run`으로 preview dev-client를 설치한다.

## CLI-first install path
```bash
cd mobile
export EXPO_IOS_APPLE_TEAM_ID=ABCDE12345
export EXPO_IOS_BUNDLE_IDENTIFIER=com.example.idolsongapp.preview
export EXPO_PUBLIC_API_BASE_URL="$(gh variable get BACKEND_PUBLIC_URL --env preview --repo iAmSomething/idol-song-app)"
npm run config:preview
npm run qa:preview:ios:sim
```

실제 iPhone으로 설치할 때는 `expo run:ios --device <device name>` 또는 Xcode Run을 사용한다.
핵심은 prebuild/run 시점에 `EXPO_IOS_APPLE_TEAM_ID`, `EXPO_IOS_BUNDLE_IDENTIFIER`가 같이 들어가야 native project regeneration과 checked-in project가 같은 식별자를 본다는 점이다.

## troubleshooting

### `No profiles for "...preview" were found`
- 하드코딩 bundle id가 team과 안 맞거나, team override가 비어 있는 상태다.
- `IdolSongAppPreview.signing.local.xcconfig`와 `EXPO_IOS_BUNDLE_IDENTIFIER` 값을 같이 확인한다.

### 다른 machine에서 team id가 다시 원래 값으로 돌아감
- versioned project는 team id를 고정하지 않는다.
- 각 machine에서 로컬 xcconfig를 다시 만들거나, 스크립트를 다시 실행해야 한다.

### `expo prebuild --clean` 뒤에 Xcode 값이 다시 바뀜
- `EXPO_IOS_APPLE_TEAM_ID`, `EXPO_IOS_BUNDLE_IDENTIFIER`를 export하지 않고 prebuild를 돌린 경우다.
- prebuild 전에 두 env를 먼저 넣는다.

### `Unable to open base configuration reference file .../Supporting/IdolSongAppPreview/Supporting/...`
- `mobile/ios/IdolSongAppPreview.xcodeproj/project.pbxproj`에서 `Supporting` group path와 xcconfig file reference path가 둘 다 `IdolSongAppPreview/Supporting`를 포함할 때 나는 증상이다.
- canonical 상태는 `Supporting` group path만 `IdolSongAppPreview/Supporting`를 가지는 것이고, child xcconfig file reference는 파일명만 가진다.
- `project.pbxproj`에서 duplicated `.../Supporting/IdolSongAppPreview/Supporting/...` 문자열이 없어야 한다.

### simulator는 되는데 실제 iPhone install이 안 됨
- team/provisioning 문제일 가능성이 가장 높다.
- Xcode `Signing & Capabilities`에서 `Team`, `Bundle Identifier`, `Automatically manage signing` 세 값을 먼저 본다.
- 첫 personal team install은 device trust 허용까지 끝나야 한다.

## 검증 기준
- `expo config --json`에서 preview `ios.bundleIdentifier`가 local override와 일치한다.
- `xcodebuild -showBuildSettings`에서 `DEVELOPMENT_TEAM`, `PRODUCT_BUNDLE_IDENTIFIER`가 local override를 반영한다.
- 가능하면 실제 personal-team iPhone install까지 확인한다.
