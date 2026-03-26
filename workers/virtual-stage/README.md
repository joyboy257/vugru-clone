# Virtual Stage Worker

AI-powered virtual staging worker using Flux Fill Dev for inpainting room photos with different style presets.

## Style Presets

- **modern**: Contemporary furniture, neutral tones, minimalist design
- **scandinavian**: Light wood furniture, cozy textiles, bright and airy
- **industrial**: Exposed brick, metal fixtures, reclaimed wood
- **warm**: Rich colors, comfortable furniture, ambient lighting

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
```

## Run

```bash
npm run dev    # Development with tsx
npm run build  # Build for production
npm start      # Production
```

## Queue

- Queue name: `propframe:virtual-stage`
- Concurrency: 3 jobs
- Automatic retry: 3 attempts with exponential backoff

## API

Use the API route at `app/api/photos/[id]/virtual-stage/route.ts` to enqueue staging jobs.
