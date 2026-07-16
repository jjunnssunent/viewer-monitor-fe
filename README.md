# StreamPulse Frontend

StreamPulse의 Next.js 프론트엔드입니다. NestJS 백엔드의 로그인 API와 방송 관리 API를 사용합니다.

## 실행

```bash
cp .env.example .env.local
npm install
npm run dev
```

프론트엔드는 `PORT=3001` 환경변수가 적용된 npm 스크립트를 통해 `http://localhost:3001`에서 실행됩니다. `.env.local`의 `NEXT_PUBLIC_API_URL`에는 브라우저에서 접근할 백엔드 주소를 설정합니다.

```env
NEXT_PUBLIC_API_URL=http://localhost:8001
```

다른 포트로 일시 실행하려면 npm 스크립트 대신 `PORT=원하는_포트 npx next dev`를 사용할 수 있습니다.

로그인하지 않은 사용자는 로그인 화면으로 이동하며, 백엔드 API도 전역 인증 가드로 보호됩니다.
