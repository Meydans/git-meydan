# git-medydan

## Vercel Gemini Proxy

This project now expects Gemini to be called through a Vercel serverless route:

- Endpoint: `/api/gemini`
- File: `/api/gemini.js`

Set this environment variable in Vercel project settings:

- `GEMINI_API_KEY=<your_gemini_api_key>`

Do not commit API keys to this repository.
