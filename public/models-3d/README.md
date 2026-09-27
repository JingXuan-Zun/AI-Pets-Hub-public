Default 3D model drop folder.

Put each built-in 3D pet in its own subfolder, for example:

- `public/models-3d/pet-1/`
- `public/models-3d/pet-2/`

Recommended layout:

- keep the main model file and all textures/sidecar files in the same subfolder
- do not move textures away from the model unless the model was authored for that path

Supported formats in this project:

- `.glb`
- `.gltf`
- `.vrm`
- `.fbx`
- `.obj`
- `.stl`
- `.pmx`

After you place the models here, we can wire them into the default preset list.

External 3D motion formats:

- `.glb`
- `.gltf`
- `.fbx`
- `.vrma`

Recommended motion layout:

- `public/models-3d/<pet>/model.vrm`
- `public/models-3d/<pet>/pet-content.manifest.json`
- `public/models-3d/<pet>/motions/idle/idle.vrma`
- `public/models-3d/<pet>/motions/walking/walk.fbx`

Manifest load order near the model file:

- `<model-file-name>.manifest.json`
- `pet-content.manifest.json`
- `manifest.json`

Example:

```json
{
  "id": "pet-3d-example-pack",
  "name": "Pet 3D Example Pack",
  "model": {
    "type": "3d",
    "url": "./model.vrm",
    "defaultScale": 1
  },
  "motions": {
    "idle": {
      "clips": ["idle"],
      "sources": [
        {
          "url": "./motions/idle/idle.vrma",
          "format": "vrma",
          "clipNames": ["idle"]
        }
      ],
      "loopMode": "repeat"
    },
    "walking": {
      "clips": ["walk"],
      "sources": [
        {
          "url": "./motions/walking/walk.fbx",
          "format": "fbx",
          "clipNames": ["walk"]
        }
      ],
      "loopMode": "repeat"
    }
  }
}
```

Notes:

- `vrma` is a motion resource, not a model format.
- `vrma` should be attached through `motions.<key>.sources`, not imported as the main 3D model file.
- When `clipNames` is omitted, the runtime will use all clips found in the motion asset.
