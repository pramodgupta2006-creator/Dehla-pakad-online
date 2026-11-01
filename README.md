# Dehla Pakad Online

A private-room, four-player online card game starter built with Node.js, Express and Socket.IO.

## Run locally
1. Install Node.js 18 or newer.
2. In this folder run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in your browser.

## Put it online
Deploy this folder to a Node.js hosting service that supports persistent WebSocket connections (for example, Render or Railway). Set the start command to `npm start`. Share the deployed URL with friends.

## Game rules in this starter
- Four players, 13 cards each, standard 52-card deck.
- Seats 1 & 3 form Team A; seats 2 & 4 form Team B.
- Trump suit is selected randomly.
- Players must follow the suit led if they can.
- Highest trump wins; otherwise highest card of the led suit wins.
- Each captured ten scores one point. Highest number of tens wins.
- This is a basic playable version; local Dehla Pakad house rules may differ.

## Notes
- Room state is held in server memory. Restarting the server ends active games.
- This starter does not include accounts, persistent match history, voice chat, or anti-cheat auditing.
- For a public production release, add HTTPS, persistent storage, reconnect handling and rate limiting.
