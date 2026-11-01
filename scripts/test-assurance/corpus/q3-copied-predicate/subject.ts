// Q3 mutation subject (A06 analogue — spec §7): the production predicate under
// counterfactual test. The Batch-D frozen oracle pins reached, non-equivalent
// faults here and in a real kernel carrier, then requires the pinned-expectation
// companion (good) to kill them while the copied-predicate companions (bad)
// survive — that survival is the demonstrated gap justifying Q3's rejection.
export const MIN_AGE = 18;

export function isAdult(age: number): boolean {
  return age >= MIN_AGE;
}
