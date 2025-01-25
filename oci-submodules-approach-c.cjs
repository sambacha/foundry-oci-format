#!/usr/bin/env node

/**
 * oci-submodules-approach-c.js
 *
 * This script:
 * 1. Discovers Git submodules from .gitmodules & "git submodule status".
 * 2. Generates a JSON file for each submodule in ./submodule-layers.
 * 3. Calculates the digest & size for each submodule JSON blob.
 * 4. Produces a final "manifest.json" representing an OCI artifact that references each submodule as a separate layer.
 * 
 * Usage:
 *   chmod +x oci-submodules-approach-c.js
 *   ./oci-submodules-approach-c.js
 */

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { execSync } = require("child_process");

// Directory to store submodule JSON files
const SUBMODULE_LAYER_DIR = path.join(process.cwd(), "submodule-layers");

// An empty descriptor for "config" as recommended in OCI spec (2 bytes -> "{}")
const EMPTY_DESCRIPTOR = {
  mediaType: "application/vnd.oci.empty.v1+json",
  digest: "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
  size: 2
};

/**
 * Parse the .gitmodules file to find submodule data (name, path, url, branch).
 */
function parseGitmodules(gitmodulesPath) {
  if (!fs.existsSync(gitmodulesPath)) {
    return {};
  }
  const content = fs.readFileSync(gitmodulesPath, "utf8");
  const lines = content.split("\n");

  let currentSubmodule = null;
  const submodules = {};

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith("[submodule")) {
      const match = line.match(/"(.*)"/);
      if (match) {
        currentSubmodule = match[1]; // e.g. "deps/foo"
        submodules[currentSubmodule] = { name: currentSubmodule };
      }
    } else if (currentSubmodule && line.startsWith("path")) {
      const m = line.match(/path\s*=\s*(.*)/);
      if (m) {
        submodules[currentSubmodule].path = m[1].trim();
      }
    } else if (currentSubmodule && line.startsWith("url")) {
      const m = line.match(/url\s*=\s*(.*)/);
      if (m) {
        submodules[currentSubmodule].url = m[1].trim();
      }
    } else if (currentSubmodule && line.startsWith("branch")) {
      const m = line.match(/branch\s*=\s*(.*)/);
      if (m) {
        submodules[currentSubmodule].branch = m[1].trim();
      }
    }
  }
  return submodules;
}

/**
 * Obtain pinned commit for each submodule path by running `git submodule status`.
 */
function getSubmoduleCommits() {
  const result = {};
  try {
    const stdout = execSync("git submodule status").toString();
    const lines = stdout.split("\n").map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // e.g. "-b10709c deps/foo (heads/main)"
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        let sha = parts[0].replace(/^[-+]/, ""); // remove any prefix
        let subPath = parts[1]; // e.g. "deps/foo"
        result[subPath] = sha;
      }
    }
  } catch (error) {
    console.error("Error running git submodule status:", error);
  }
  return result;
}

/**
 * Helper to compute the sha256 digest & size of a file.
 */
function computeDigestAndSize(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const size = fileBuffer.length;

  const hash = crypto.createHash("sha256");
  hash.update(fileBuffer);
  const digest = "sha256:" + hash.digest("hex");

  return { digest, size };
}

function main() {
  // Step 1: Parse .gitmodules
  const repoRoot = process.cwd();
  const gitmodulesPath = path.join(repoRoot, ".gitmodules");
  const submodules = parseGitmodules(gitmodulesPath);

  // Step 2: Get pinned commits
  const submoduleCommits = getSubmoduleCommits();

  // Step 3: Create a directory for submodule JSON blobs
  if (!fs.existsSync(SUBMODULE_LAYER_DIR)) {
    fs.mkdirSync(SUBMODULE_LAYER_DIR);
  }

  // Collect "layers" array
  const layers = [];

  // Step 4: For each submodule, create a small JSON file
  Object.keys(submodules).forEach((subName) => {
    const info = submodules[subName];
    const commitSha = submoduleCommits[info.path] || "UNKNOWN";

    // Build submodule data object
    const submoduleData = {
      name: info.name,
      path: info.path,
      url: info.url,
      commit: commitSha,
      branch: info.branch || ""
    };

    // Write a JSON file for this submodule
    const layerFileName = subName.replace(/\//g, "_") + ".json"; // e.g. "deps_foo.json"
    const layerFilePath = path.join(SUBMODULE_LAYER_DIR, layerFileName);
    fs.writeFileSync(layerFilePath, JSON.stringify(submoduleData, null, 2), "utf8");

    // Compute digest & size
    const { digest, size } = computeDigestAndSize(layerFilePath);

    // Add to layers array
    layers.push({
      mediaType: "application/vnd.example.git-submodule.layer.v1+json",
      digest,
      size,
      annotations: {
        // We can store a "title" or any metadata as allowed by the spec
        "org.opencontainers.image.title": subName
      }
    });
  });

  // Step 5: Construct the final OCI manifest JSON
  // Using the empty descriptor for config, plus an "artifactType"
  const manifest = {
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    artifactType: "application/vnd.example.git-submodules",
    config: EMPTY_DESCRIPTOR,
    layers
    // Optionally, "annotations": { ... }
  };

  // Step 6: Write out "manifest.json"
  const manifestPath = path.join(repoRoot, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Wrote manifest to ${manifestPath}.`);
  console.log(`Created submodule layer files in ${SUBMODULE_LAYER_DIR}.`);

  console.log("\nManifest layers:");
  layers.forEach((l) => {
    console.log(`  - ${l.annotations["org.opencontainers.image.title"]} => ${l.digest} (size: ${l.size})`);
  });

  console.log("\nNext steps to push to GitHub’s OCI registry:");
  console.log("1) Upload each layer blob (the .json files) to the registry, for example using ORAS:");
  console.log("   oras push ghcr.io/<OWNER>/<REPO>:<TAG> \\");
  console.log("       --artifact-type application/vnd.example.git-submodules \\");
  console.log("       --config /dev/null:application/vnd.oci.empty.v1+json \\");
  console.log("       ./submodule-layers/deps_foo.json:application/vnd.example.git-submodule.layer.v1+json \\");
  console.log("       ./submodule-layers/deps_bar.json:application/vnd.example.git-submodule.layer.v1+json ...");
  console.log("   (ORAS will automatically create a manifest with references to these blobs, although you may need to pass some flags.)");
  console.log("   Alternatively, you can separately upload blobs and then link them in a custom step if you prefer a more manual approach.");
  console.log("\n2) Or manually push using 'manifest.json' if your tooling supports passing a pre-built manifest.");
  console.log("\nDone!");
}

main();
