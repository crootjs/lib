# Test fixtures

- `Box.gltf`, `Box.bin` - "Box" from the [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Box), Draco-compressed variant, © 2017 Cesium, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Used to test `KHR_draco_mesh_compression` in `model3d.js`.

Everything else the tests need (GLB models, PMTiles archives) is generated in code - see `glb.js` and `mapoffline.test.js`.
- `pwa-sw.js` - service worker for `pwa.test.js`; it loads `serviceworker.js` from this folder instead of jsDelivr and precaches this README.
- `openapi.yaml` - copy of the Notes API spec from `examples/api/swagger/`, parsed by `yaml.test.js` and rendered by `openapi.test.js`.
- `openapi.json` - sample OpenAPI 3.1 spec for `openapi.test.js` (tags, `$ref` with JSON-pointer escapes and cycles, security schemes, multipart, PATCH).
