# Foundry OCI Format

Use OCI Format for Package Manifest encoding

## Approach A

```console
Found 3 ABI files:
  /usr/local/foundry-manifest/contracts/StdInvariant.sol.abi,
  /usr/local/foundry-manifest/contracts/Test.sol.abi,
  /usr/local/foundry-manifest/contracts/Vm.sol.abi
Approach A: minimal config + single layer with all ABI files.

Wrote manifest to: /usr/local/foundry-manifest/output/manifest.json

Manifest contents:
```
### Manifest A
```jsonc
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "artifactType": "application/vnd.solidity.abi",
  "config": {
    "mediaType": "application/vnd.oci.empty.v1+json",
    "digest": "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
    "size": 2
  },
  "layers": [
    {
      "mediaType": "application/vnd.solidity.abi.layer.v1+tar+gzip",
      "digest": "sha256:02952edcaa6edf9efc442f8ddee3fe6365dcd83c422e65d3e97af6526238308c",
      "size": 5245
    }
  ]
}
```


## Approach B

```console
Approach B: everything in config, no layers.

Wrote manifest to: /usr/local/foundry-manifest/output/manifest.json

Manifest contents:
```
### Manifest A
```jsonc
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "artifactType": "application/vnd.solidity.abi",
  "config": {
    "mediaType": "application/vnd.solidity.abi.config.v1+tar+gzip",
    "digest": "sha256:09e226c9136e16a559a5f647edd8f516454a24b031e13ee74886461e93ad3bd5",
    "size": 5245
  },
  "layers": []
}
```

```console
Approach C: minimal config, each ABI as a separate layer.

Wrote manifest to: /usr/local/foundry-manifest/output/manifest.json

Manifest contents:
```

### Manifest C
```jsonc
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "artifactType": "application/vnd.solidity.abi",
  "config": {
    "mediaType": "application/vnd.oci.empty.v1+json",
    "digest": "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
    "size": 2
  },
  "layers": [
    {
      "mediaType": "application/vnd.solidity.abi.file",
      "digest": "sha256:4b38714f99889fd05a224c56af9c2751b106f566606e312587d0ff16f75f91fe",
      "size": 3232,
      "annotations": {
        "org.opencontainers.image.title": "StdInvariant.sol.abi"
      }
    },
    {
      "mediaType": "application/vnd.solidity.abi.file",
      "digest": "sha256:205546fd52b9c25dbda361c02ac7958d6a67c4609f7fc3ae326866ae33292c21",
      "size": 10346,
      "annotations": {
        "org.opencontainers.image.title": "Test.sol.abi"
      }
    },
    {
      "mediaType": "application/vnd.solidity.abi.file",
      "digest": "sha256:0d5a56f57c384984780d447aed4cdaa9fc9d100e79b5eb11cf90d704f09d6dc5",
      "size": 132412,
      "annotations": {
        "org.opencontainers.image.title": "Vm.sol.abi"
      }
    }
  ]
}
```

### Manifest D

```
Found 3 ABI files:
  /usr/local/foundry-manifest/contracts/StdInvariant.sol.abi,
  /usr/local/foundry-manifest/contracts/Test.sol.abi,
  /usr/local/foundry-manifest/contracts/Vm.sol.abi
Approach D: referencing another manifest with 'subject'. Example uses Approach A + 'subject'.
Approach A: minimal config + single layer with all ABI files.

Wrote manifest to: /usr/local/foundry-manifest/output/manifest.json

Manifest contents:
```

### Manifest D

```jsonc
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "artifactType": "application/vnd.solidity.abi",
  "config": {
    "mediaType": "application/vnd.oci.empty.v1+json",
    "digest": "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
    "size": 2
  },
  "layers": [
    {
      "mediaType": "application/vnd.solidity.abi.layer.v1+tar+gzip",
      "digest": "sha256:61d5c159e997cc108d97340bd36d1151d701168bad0dc612c37a9718a0e2907d",
      "size": 5245
    }
  ],
  "subject": {
    "mediaType": "application/vnd.oci.image.manifest.v1+json",
    "digest": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    "size": 9999
  }
}
```
