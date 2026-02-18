// BackEnd/server.js
// Entry point - wires routes, auth, and persistence.
const express = require('express');
const bodyParser = require('body-parser');

const auth = require('./auth');
const rideStore = require('./rideStore');
const stateMachine = require('./stateMachine');
const persistence = require('./persistence');
const seed = require('./seed');

const app = express();
app.use(bodyParser.json());

// Simple health
app.get('/health', (req, res) => res.json({ status: 'ok', now: Date.now() }));

// Login - returns fake token and stores it in-memory
app.post('/login', (req, res) => {
  const { driverId } = req.body || {};
  if (!driverId) return res.status(400).json({ error: 'driverId required' });
  const token = auth.createToken(driverId);
  return res.json({ token });
});

// Middleware: validate token for following endpoints
app.use((req, res, next) => {
  // Exclude /health and /login
  if (req.path === '/health' || (req.path === '/login' && req.method === 'POST')) return next();
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: 'Missing token' });
  const token = match[1];
  const driverId = auth.verifyToken(token);
  if (!driverId) return res.status(401).json({ error: 'Invalid token' });
  req.driverId = driverId;
  next();
});

// Get rides; query ?status=requested to filter
app.get('/rides', (req, res) => {
  const { status } = req.query;
  const rides = rideStore.list(status);
  res.json(rides);
});

// Create a new ride request (REQUESTED)
// Body example:
// { "passengerName": "Alice", "pickup": { "lat": 12.3, "lng": 45.6 }, "dropoff": { "lat": 98.7, "lng": 65.4 }, "notes": "fragile" }
app.post('/rides', (req, res) => {
  const { passengerName, pickup, dropoff, notes } = req.body || {};
  if (!pickup || !dropoff) return res.status(400).json({ error: 'pickup and dropoff required' });
  const ride = rideStore.create({
    status: 'REQUESTED',
    payload: { passengerName, pickup, dropoff, notes },
    createdAt: Date.now()
  });
  persistence.saveAll(rideStore.dump());
  return res.status(201).json(ride);
});

// Debug: get one ride
app.get('/rides/:id', (req, res) => {
  const ride = rideStore.get(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  res.json(ride);
});

// Core transition endpoints: accept, start, complete, cancel
function handleTransition(req, res, toState) {
  const rideId = req.params.id;
  const driverId = req.driverId;
  try {
    const result = rideStore.updateAtomic(rideId, (ride) => {
      stateMachine.validateTransition(ride.status, toState, { ride, driverId });
      // apply change
      if (toState === 'ACCEPTED') {
        ride.status = 'ACCEPTED';
        ride.driverId = driverId;
      } else if (toState === 'STARTED') {
        ride.status = 'STARTED';
        ride.locations = ride.locations || [];
      } else if (toState === 'COMPLETED') {
        ride.status = 'COMPLETED';
      } else if (toState === 'CANCELLED') {
        ride.status = 'CANCELLED';
      }
      return ride;
    });
    persistence.saveAll(rideStore.dump());
    return res.json(result);
  } catch (err) {
    if (err && err.code === 'CONFLICT') return res.status(409).json({ error: err.message });
    if (err && err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'unknown' });
  }
}

app.post('/rides/:id/accept', (req, res) => handleTransition(req, res, 'ACCEPTED'));
app.post('/rides/:id/start', (req, res) => handleTransition(req, res, 'STARTED'));
app.post('/rides/:id/complete', (req, res) => handleTransition(req, res, 'COMPLETED'));
app.post('/rides/:id/cancel', (req, res) => handleTransition(req, res, 'CANCELLED'));

// Location endpoint: appends location, simulates occasional failure
app.post('/rides/:id/location', (req, res) => {
  const rideId = req.params.id;
  const driverId = req.driverId;
  const { lat, lng, ts } = req.body || {};

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng required as numbers' });
  }

  // Simulate intermittent 500 error (10% chance)
  if (Math.random() < 0.1) {
    return res.status(500).json({ error: 'Simulated server error' });
  }

  try {
    const result = rideStore.updateAtomic(rideId, (ride) => {
      if (!ride) throw { code: 'NOT_FOUND', message: 'Ride not found' };
      if (ride.driverId !== driverId) throw { code: 'CONFLICT', message: 'Wrong driver' };
      if (ride.status !== 'STARTED') throw { code: 'CONFLICT', message: 'Ride not started' };
      ride.locations = ride.locations || [];
      // Prepend new location so the most recent location is first in the array
      ride.locations.unshift({ lat, lng, ts: ts || Date.now() });
      return ride;
    });
    persistence.saveAll(rideStore.dump());
    return res.json({ ok: true, ride: result });
  } catch (err) {
    if (err && err.code === 'CONFLICT') return res.status(409).json({ error: err.message });
    if (err && err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'unknown' });
  }
});

// Debug endpoint: list all rides (for demo)
app.get('/__all_rides', (req, res) => res.json(rideStore.dump()));

// Seed on start if DB empty
(() => {
  persistence.init(); // load lowdb
  rideStore.load(persistence.loadAll());
  if (rideStore.count() === 0) {
    console.log('No rides present - seeding sample rides...');
    const seeded = seed.seedSampleRides(3);
    persistence.saveAll(rideStore.dump());
    console.log('Seeded rides:', seeded.map(r => r.id));
  }
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Ride backend listening on ${PORT}`));
})();

