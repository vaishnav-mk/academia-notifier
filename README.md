```
npm install
npm run dev
```

```
npm run deploy
```

A service I made for myself that rides on top of [Academia Pro](academia-pro.vercel.app) to send push notifications to my phone when my grades/attendance are updated.

## How it works

1. The service logs into Academia Pro using your credentials.
2. It checks your grades/attendance every 5 minutes.
3. If there are any changes, it sends a push notification to your phone via Discord. (until I implement a better solution because Discord is horrible for this)

## How to use

1. Clone the repository.
2. Update `.dev.vars` with your credentials.

```json
ACCOUNT=""
PASSWORD=""
CHANNEL_ID=""
BOT_TOKEN=""
SCRAPE_URL=""
```

3. Run `npm install` and `npm run dev`.
4. Go to `localhost:3000` and you should receive a ping in your Discord channel.