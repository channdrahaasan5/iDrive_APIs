// BackEnd/seed.js
// Small seeding helper for demo rides

const rideStore = require('./rideStore');

// Create n sample REQUESTED rides
function seedSampleRides(n = 3) {
  const created = [];
  for (let i = 0; i < n; i++) {
    const r = rideStore.create({
      status: 'REQUESTED',
      payload: { passenger: `Passenger ${i + 1}` },
      createdAt: Date.now()
    });
    created.push(r);
  }
  return created;
}

module.exports = { seedSampleRides };

