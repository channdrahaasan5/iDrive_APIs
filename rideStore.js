// BackEnd/rideStore.js
// In-memory Map runtime store with simple atomic update function.
// Persists externally via persistence.saveAll(...) from server.js
//
// updateAtomic(id, updater) runs synchronously and returns updated ride or throws codes:
// - { code: 'NOT_FOUND' } if no ride
// - { code: 'CONFLICT' } for state conflicts

const rides = new Map();

function generateId() {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Load rides from persistence into memory (array expected)
function load(arr) {
  rides.clear();
  (arr || []).forEach(r => rides.set(r.id, r));
}

function dump() {
  return Array.from(rides.values());
}

function count() {
  return rides.size;
}

function list(status) {
  const arr = dump();
  if (!status) return arr;
  return arr.filter(r => r.status === status.toUpperCase());
}

function get(id) {
  return rides.get(id);
}

// Create a new ride (used by seeding)
function create(attrs) {
  const r = Object.assign({
    id: generateId(),
    status: 'REQUESTED',
    payload: {},
    createdAt: Date.now()
  }, attrs || {});
  rides.set(r.id, r);
  return r;
}

// Atomic (synchronous) updater: takes id and a function(ride) => ride (mutates ride)
// Everything inside updater should be synchronous to avoid races in single-threaded Node.
// If the ride is missing throw { code: 'NOT_FOUND' }
function updateAtomic(id, updater) {
  const ride = rides.get(id);
  if (!ride) throw { code: 'NOT_FOUND', message: 'Ride not found' };

  // Keep a shallow clone for safety
  const before = Object.assign({}, ride);

  // We call the updater which may validate and mutate the ride object
  const result = updater(ride);

  // Basic sanity: ensure result has id
  if (!ride.id) {
    // Revert
    rides.set(id, before);
    throw { code: 'CONFLICT', message: 'Updater invalid' };
  }

  // store mutated ride (Map already references it)
  rides.set(id, ride);
  return ride;
}

module.exports = {
  load,
  dump,
  count,
  list,
  get,
  create,
  updateAtomic
};

