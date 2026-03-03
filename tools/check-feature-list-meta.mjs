#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const args = process.argv.slice(2)
const shouldWrite = args.includes("--write")
const files = args.filter((arg) => !arg.startsWith("--"))

const targetFiles =
  files.length > 0 ? files : ["feature_list_phase1.json", "feature_list_phase2.json"]

let hasMismatch = false

for (const file of targetFiles) {
  const filePath = resolve(process.cwd(), file)
  const source = readFileSync(filePath, "utf8")
  const payload = JSON.parse(source)
  const featureList = Array.isArray(payload.features) ? payload.features : []

  const expectedTotal = featureList.length
  const expectedCompleted = featureList.filter((feature) => feature?.passes === true).length
  const currentTotal = Number(payload.meta?.total_features ?? 0)
  const currentCompleted = Number(payload.meta?.completed_features ?? 0)

  const mismatches = []
  if (currentTotal !== expectedTotal) {
    mismatches.push(`total_features: ${currentTotal} -> ${expectedTotal}`)
    payload.meta.total_features = expectedTotal
  }
  if (currentCompleted !== expectedCompleted) {
    mismatches.push(`completed_features: ${currentCompleted} -> ${expectedCompleted}`)
    payload.meta.completed_features = expectedCompleted
  }

  if (mismatches.length === 0) {
    console.log(`[OK] ${file}`)
    continue
  }

  if (shouldWrite) {
    writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
    console.log(`[SYNCED] ${file} (${mismatches.join(", ")})`)
    continue
  }

  hasMismatch = true
  console.log(`[DRIFT] ${file} (${mismatches.join(", ")})`)
}

if (hasMismatch) {
  process.exitCode = 1
}
