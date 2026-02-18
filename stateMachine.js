// BackEnd/stateMachine.js
// Centralized state validation logic. Throws errors with codes for upstream handling.

const ALLOWED_TRANSITIONS = {
  IDLE: ['REQUESTED'],
  REQUESTED: ['ACCEPTED'],            // only accept from requested
  ACCEPTED: ['STARTED', 'REQUESTED'], // allow cancel -> back to REQUESTED
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
};

// Validate transition and rules:
// - Only allowed transitions permitted
// - CANCELLED only allowed before STARTED (enforced via transitions above)
// - Wrong driver attempting to operate -> conflict (caller should check)
function validateTransition(from, to, { ride, driverId }) {
  if (!ride) throw { code: 'NOT_FOUND', message: 'Ride not found' };
  // Idempotent: allow same-state if driver matches where applicable
  if (from === to) {
    // if same state but assigned to another driver, disallow
    if (ride.driverId && driverId && ride.driverId !== driverId) {
      throw { code: 'CONFLICT', message: 'Action permitted only by assigned driver' };
    }
    return true;
  }

  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw { code: 'CONFLICT', message: `Invalid transition ${from} -> ${to}` };
  }

  // Additional checks:
  // Start/Complete: must be same driver
  if ((to === 'STARTED' || to === 'COMPLETED') && ride.driverId) {
    if (ride.driverId !== driverId) {
      throw { code: 'CONFLICT', message: 'Action permitted only by assigned driver' };
    }
  }

  // Cancel (implemented as returning to REQUESTED): if moving from ACCEPTED -> REQUESTED ensure same driver
  if (to === 'REQUESTED' && from === 'ACCEPTED') {
    if (ride.driverId && ride.driverId !== driverId) {
      throw { code: 'CONFLICT', message: 'Cancel permitted only by assigned driver' };
    }
  }

  return true;
}

module.exports = { validateTransition };

