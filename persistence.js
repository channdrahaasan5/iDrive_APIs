// BackEnd/persistence.js
// Wrapper around lowdb for simple JSON persistence.
// Uses lowdb v1 FileSync adapter for synchronous writes (simple and deterministic).

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, '..', 'db.json'));
const db = low(adapter);

// init defaults if not present
function init() {
  db.defaults({ rides: [] }).write();
}

// load all rides (returns array)
function loadAll() {
  init();
  return db.get('rides').value() || [];
}

// save entire rides array (overwrite)
function saveAll(ridesArray) {
  init();
  db.set('rides', ridesArray).write();
}

module.exports = { init, loadAll, saveAll };

