# Doc Q&A: frontend

Next.js 16 (App Router) + TypeScript. Two pages:

- `/` ask a question and read the answer and its sources
- `/docs` add one or more documents and send them to the backend

```powershell
npm install
copy .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:3001 (no trailing slash)
npm run dev                      # http://localhost:3000
```

`npm run lint` and `npm run build` check the code. The backend, the architecture and the deployment are explained
in the [main README](../README.md).
