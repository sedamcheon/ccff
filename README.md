# 부경 카페랭크

부경대학교 주변 카페 6곳의 음료 가격을 비교하는 정적 웹 앱입니다.

## 파일 구조

```text
cafe1
  .gitignore
  app.js
  database.rules.json
  firebase-config.example.js
  firebase-config.js
  index.html
  README.md
  seed-cafes.json
  styles.css
  vercel.json
  assets
    cafe-bg.webp
    cup-mascot.webp
    treat-sticker.webp
```

이 버전은 `package.json`을 사용하지 않습니다. 그래서 Vercel에서 `npm run build`를 실행할 필요가 없습니다.

## Vercel 설정

GitHub 저장소에 `cafe1` 폴더 내용을 올린 뒤 Vercel에서 아래처럼 설정하세요.

```text
Framework Preset: Other
Root Directory: cafe1
Build Command: 비워두기
Output Directory: .
```

GitHub 저장소 루트가 곧 `cafe1` 파일들이라면 Root Directory는 비워둬도 됩니다.

## Firebase 설정

1. `firebase-config.example.js`를 참고합니다.
2. `firebase-config.js`의 `apiKey`, `appId` 값을 Firebase 웹 앱 설정값으로 바꿉니다.
3. Realtime Database Rules에는 `database.rules.json` 내용을 붙여넣고 게시합니다.

현재 Firebase 프로젝트 기준값은 아래처럼 들어가 있습니다.

```js
authDomain: "ccff-58ba5.firebaseapp.com"
databaseURL: "https://ccff-58ba5-default-rtdb.firebaseio.com"
projectId: "ccff-58ba5"
```

Firebase 설정 전에도 앱은 `seed-cafes.json` 기본 데이터로 화면을 보여줍니다. 이 상태에서는 가격 비교 화면은 보이지만, 가격 제보 저장과 관리자 기능은 작동하지 않습니다. Firebase 설정 후에는 `/cafes`가 비어 있을 때 기본 데이터를 한 번 저장합니다.

`apiKey`와 `appId`는 Firebase Console > 프로젝트 설정 > 일반 > 내 앱 > 웹 앱 설정에서 복사해야 합니다.

## 관리자 설정

Firebase Authentication에서 이메일/비밀번호 로그인을 켜고 관리자 계정을 만든 뒤, Realtime Database Data 탭에 아래처럼 UID를 추가합니다.

```json
{
  "admins": {
    "관리자_UID": true
  }
}
```

관리자는 앱의 관리자 화면에서 로그인한 뒤 카페와 메뉴를 수정할 수 있습니다.

## 카페 분위기 배경

`assets/cafe-bg.webp`, `assets/cup-mascot.webp`, `assets/treat-sticker.webp`는 앱 분위기용 이미지입니다. GitHub에 함께 올려야 Vercel 배포 화면에서도 밝은 카페 배경과 귀여운 장식이 보입니다.
