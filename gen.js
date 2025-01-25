#!/usr/bin/env node

/**
 * store-solidity-abis.js
 *
 * Demonstrates four approaches to storing Solidity ABI files as an OCI artifact.
 * 
 * Usage:
 *   node store-solidity-abis.js [A|B|C|D]
 *
 * Approaches:
 *   A - Minimal artifact (empty config + single layer)
 *   B - Everything in config (no layers)
 *   C - Multiple layers (one per ABI)
 *   D - Same as A|B|C, but with a 'subject' referencing another manifest
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

///////////////////////////////
// CONFIGURATION CONSTANTS   //
///////////////////////////////

const ABI_DIR = path.join(process.cwd(), "contracts");   // Where .abi files live
const OUTPUT_DIR = path.join(process.cwd(), "output");   // Where we place results
const SINGLE_LAYER_TGZ = path.join(OUTPUT_DIR, "abis-single-layer.tgz");
const SINGLE_CONFIG_TGZ = path.join(OUTPUT_DIR, "abis-config.tgz");
const MANIFEST_JSON = path.join(OUTPUT_DIR, "manifest.json");

// Empty descriptor per OCI guidelines
// (Used for minimal config in Approaches A & C)
const EMPTY_DESCRIPTOR = {
  mediaType: "application/vnd.oci.empty.v1+json",
  digest: "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
  size: 2
};

// For Approach D, a fake "subject" referencing another manifest
// e.g. we might attach these ABI files to some existing container image or artifact
const SUBJECT_DESCRIPTOR = {
  mediaType: "application/vnd.oci.image.manifest.v1+json",
  digest: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
  size: 9999
  // In a real scenario, use the real digest/size of the referenced manifest
};

///////////////////////////////
// HELPER FUNCTIONS          //
///////////////////////////////

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function listAbiFiles() {
  // Gather .abi files in "contracts/" (non-recursive or recursive as you prefer)
  if (!fs.existsSync(ABI_DIR)) {
    console.error(`No 'contracts' directory found at: ${ABI_DIR}`);
    process.exit(1);
  }
  const all = fs.readdirSync(ABI_DIR)
    .filter(f => f.endsWith(".abi"))
    .map(f => path.join(ABI_DIR, f));
  return all;
}

function tarFiles(fileList, outTgzPath) {
  // We'll just assume 'tar' is available
  // We'll create a temp directory with symlinks or copies. For simplicity, create it directly:
  // Or we can just run: tar -czf outTgzPath -C contracts MyContract.abi AnotherContract.abi ...
  const parent = path.dirname(fileList[0]);
  const baseNames = fileList.map(f => path.basename(f)).join('" "');
  execSync(`tar -czf "${outTgzPath}" -C "${parent}" "${baseNames}"`);
}

function computeDigestAndSize(filePath) {
  const data = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  return {
    digest: `sha256:${hash}`,
    size: data.length
  };
}

///////////////////////////////
// APPROACH IMPLEMENTATIONS //
///////////////////////////////

/**
 * Approach A:
 * - Minimal config (EMPTY_DESCRIPTOR).
 * - Single layer => .tgz containing all .abi files.
 */
function approachA(abiFiles) {
  console.log("Approach A: minimal config + single layer with all ABI files.");

  // Step 1: Tar up all .abi into one file
  if (fs.existsSync(SINGLE_LAYER_TGZ)) fs.unlinkSync(SINGLE_LAYER_TGZ);
  tarFiles(abiFiles, SINGLE_LAYER_TGZ);

  const { digest, size } = computeDigestAndSize(SINGLE_LAYER_TGZ);

  // Step 2: Build manifest
  const manifest = {
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    artifactType: "application/vnd.solidity.abi",  // custom type
    config: EMPTY_DESCRIPTOR,                      // minimal
    layers: [
      {
        mediaType: "application/vnd.solidity.abi.layer.v1+tar+gzip",
        digest,
        size
      }
    ]
  };
  return manifest;
}

/**
 * Approach B:
 * - Everything in config => single .tgz with all .abi
 * - No layers (empty array).
 */
function approachB(abiFiles) {
  console.log("Approach B: everything in config, no layers.");

  // Create a single .tgz containing all .abi
  if (fs.existsSync(SINGLE_CONFIG_TGZ)) fs.unlinkSync(SINGLE_CONFIG_TGZ);
  tarFiles(abiFiles, SINGLE_CONFIG_TGZ);
  const { digest, size } = computeDigestAndSize(SINGLE_CONFIG_TGZ);

  // Minimal manifest
  const manifest = {
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    artifactType: "application/vnd.solidity.abi",
    config: {
      mediaType: "application/vnd.solidity.abi.config.v1+tar+gzip",
      digest,
      size
    },
    layers: []
  };
  return manifest;
}

/**
 * Approach C:
 * - Minimal config => each ABI is a separate layer.
 */
function approachC(abiFiles) {
  console.log("Approach C: minimal config, each ABI as a separate layer.");

  // For each file, we might choose to compress individually or not. For demonstration, let's keep them uncompressed, or do mini .tgz. We'll just store them as-is.
  // We'll store them as is: "application/vnd.solidity.abi.layer.v1+json" or "application/vnd.solidity.abi.file"
  // If you want them compressed individually, you can tar them up one by one.

  const layers = [];
  abiFiles.forEach((filePath) => {
    const { digest, size } = computeDigestAndSize(filePath);
    layers.push({
      mediaType: "application/vnd.solidity.abi.file",
      digest,
      size,
      annotations: {
        "org.opencontainers.image.title": path.basename(filePath)
      }
    });
  });

  // Manifest
  const manifest = {
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    artifactType: "application/vnd.solidity.abi",
    config: EMPTY_DESCRIPTOR,
    layers
  };
  return manifest;
}

/**
 * Approach D:
 * - We add a 'subject' property to one of the above approaches.
 * - This 'subject' references another manifest (like a container image or some base artifact).
 * - We'll default to Approach A as example, but you can adapt to B or C.
 */
function approachD(abiFiles) {
  console.log("Approach D: referencing another manifest with 'subject'. Example uses Approach A + 'subject'.");

  // We'll build a manifest like approachA, then add 'subject'
  const baseManifest = approachA(abiFiles);

  // Insert a subject referencing some other artifact
  baseManifest.subject = SUBJECT_DESCRIPTOR; // e.g. attach ABIs to that subject
  return baseManifest;
}

///////////////////////////////
// MAIN SCRIPT ENTRY POINT   //
///////////////////////////////

function main() {
  const approach = process.argv[2];
  if (!["A", "B", "C", "D"].includes(approach)) {
    console.error("Usage: node store-solidity-abis.js [A|B|C|D]");
    process.exit(1);
  }

  ensureOutputDir();
  const abiFiles = listAbiFiles();
  if (!abiFiles.length) {
    console.error("No .abi files found in 'contracts' directory.");
    process.exit(1);
  }
  console.log(`Found ${abiFiles.length} ABI files:` + abiFiles.map(f => "\n  " + f));

  let manifest;
  switch (approach) {
    case "A":
      manifest = approachA(abiFiles);
      break;
    case "B":
      manifest = approachB(abiFiles);
      break;
    case "C":
      manifest = approachC(abiFiles);
      break;
    case "D":
      manifest = approachD(abiFiles);
      break;
  }

  // Write out the manifest
  fs.writeFileSync(MANIFEST_JSON, JSON.stringify(manifest, null, 2));
  console.log(`\nWrote manifest to: ${MANIFEST_JSON}\n`);
  console.log("Manifest contents:");
  console.log(JSON.stringify(manifest, null, 2));
}

main();
