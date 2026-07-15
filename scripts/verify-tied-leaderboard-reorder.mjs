/**
 * Verifies tied-score leaderboard reorder logic (matches leaderboard-do.ts sort)
 * and simulates row-key stability for motion layout animations.
 */
function sortEntries(entries) {
  return [...entries].sort((a, b) => b.score - a.score || a.submittedAt - b.submittedAt);
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("PASS:", message);
}

// Baseline: two tied candidates
let entries = [
  { id: "a", name: "Alice", score: 80, submittedAt: 1000 },
  { id: "b", name: "Bob", score: 80, submittedAt: 2000 },
];
entries = sortEntries(entries);
assert(entries[0].id === "a", "Alice ranks above Bob (earlier submission)");
assert(entries[1].id === "b", "Bob is second among ties");

// Insert tied candidate between Alice and Bob
entries.push({ id: "c", name: "Carol", score: 80, submittedAt: 1500 });
entries = sortEntries(entries);
assert(entries.map((e) => e.id).join(",") === "a,c,b", "Carol inserts between tied Alice and Bob");

// Score boost reorders without jitter-prone key churn (stable ids)
const beforeIds = entries.map((e) => e.id);
entries = entries.map((e) => (e.id === "c" ? { ...e, score: 85 } : e));
entries = sortEntries(entries);
assert(entries[0].id === "c", "Carol moves to top after score boost");
assert(entries[1].id === "a", "Alice is second after Carol boost");
assert(
  new Set(entries.map((e) => e.id)).size === entries.length,
  "All row keys remain unique after tied reorder"
);
assert(
  beforeIds.every((id) => entries.some((e) => e.id === id)),
  "No row ids lost during tied-score reorder"
);

console.log("\nAll tied-score reorder checks passed.");
