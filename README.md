# Ride State Backend (minimal)

Overview
- Express.js server implementing a driver ride state engine.
- Runtime: in-memory Map for speed; persistence via lowdb (db.json) to survive restarts.
- Fake token auth (no external libs).
- Implements required endpoints and concurrency rules.

Install & run
1. cd BackEnd
2. npm install
3. npm start
   - Server listens on port 3000 by default.
4. On first run the server seeds 3 rides in `REQUESTED` state.

Endpoints
- POST /login
  - body: { "driverId": "driver1" }
  - returns: { token: "driver-driver1-token" }
- GET /rides?status=requested
  - returns rides filtered by status
- POST /rides
  - body: { "passengerName": "...", "pickup": { "lat", "lng" }, "dropoff": { "lat", "lng" }, "notes?" }
  - creates a new ride in `REQUESTED` state and returns 201
- POST /rides/:id/accept
- POST /rides/:id/start
- POST /rides/:id/complete
- POST /rides/:id/cancel
- POST /rides/:id/location
  - body: { lat: number, lng: number, ts?: number }
  - server simulates random 500 errors (~10%) to test client retry/backoff
- GET /__all_rides (debug)
- GET /health

Auth
- Include header: Authorization: Bearer driver-{id}-token
- Use `/login` to receive that token

Behavior & rules
- State machine: IDLE → REQUESTED → ACCEPTED → STARTED → COMPLETED
- CANCELLED allowed only before STARTED.
- Invalid transitions return 409 Conflict.
- Only the assigned driver may start/complete/cancel (when required).
- Accept is atomic: only the first accept will succeed; others receive 409.

Persistence
- All rides saved to `db.json` after each change.
- Data persists between restarts.

Notes & tradeoffs
- lowdb + in-memory is simple for a demo; not intended for production multi-instance deployments.
- For production replace persistence with Postgres/SQLite and use DB transactions or distributed locking.

Example curl flow
1) Login:
curl -s -X POST http://localhost:3000/login -H "Content-Type: application/json" -d '{"driverId":"d1"}'
2) List requested rides (use token from login):
curl -s -H "Authorization: Bearer driver-d1-token" "http://localhost:3000/rides?status=requested"
3) Accept:
curl -s -X POST http://localhost:3000/rides/{rideId}/accept -H "Authorization: Bearer driver-d1-token"
4) Start:
curl -s -X POST http://localhost:3000/rides/{rideId}/start -H "Authorization: Bearer driver-d1-token"
5) Location (simulate):
curl -s -X POST http://localhost:3000/rides/{rideId}/location -H "Authorization: Bearer driver-d1-token" -H "Content-Type: application/json" -d '{"lat":12.34,"lng":56.78}'

