import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const load = (filePath) =>
  JSON.parse(readFileSync(new URL(`../${filePath}`, import.meta.url), "utf8"))

const assertMetaConsistency = (filePath) => {
  const data = load(filePath)
  const expectedTotal = data.features.length
  const expectedCompleted = data.features.filter((feature) => feature.passes === true).length

  assert.equal(data.meta.total_features, expectedTotal, `${filePath} total_features drifted`)
  assert.equal(
    data.meta.completed_features,
    expectedCompleted,
    `${filePath} completed_features drifted`
  )
}

test("feature_list_phase1 metadata tracks feature completion counts", () => {
  assertMetaConsistency("feature_list_phase1.json")
})

test("feature_list_phase2 metadata tracks feature completion counts", () => {
  assertMetaConsistency("feature_list_phase2.json")
})
