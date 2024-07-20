## Mesh Simplification

This repository provides different variations of Sven Forstmann's mesh simplification method. The [live demo web page](https://neurolabusc.github.io/simplifyjs/) allows users to interactively adjust parameters. Several ports are provided: the pure JavaScript NiiVue method is fast but does not support [UV Mapping](https://en.wikipedia.org/wiki/UV_mapping). The pure JavaScript Koo and WebAssembly (WASM) methods support UV mapping, with the latter being faster.

![simplify live demo](simplify.jpg)

## Serve locally

```
git clone https://github.com/neurolabusc/simplifyjs
cd simplifyjs
python -m http.server 8080
```

## Simplification Versions

This repository includes different ports of Sven Forstmann's C++ [Fast Quadric Mesh Simplification](https://github.com/sp4cerat/Fast-Quadric-Mesh-Simplification). The table below shows the time to simplify the `brain` mesh to 14% of its input size (from 163841 to 22939 vertices and 327678 to 45874 triangles). 

| Method  | Notes               | Size (kb) | UVs | Speed (ms) |
|---------|---------------------|-----------|-----|------------|
| WASMmz3 | a.out.js/a.out.wasm |      200  | No  |       337  |
| WASM    | a.out.js/a.out.wasm |      200  | Yes |      1350  |
| NiiVue  | simplify.js         |       15  | No  |      1362  |
| Koo     | decimate.js         |      188  | Yes |      4065  |

Note that the WebAssembly (WASM) port requires data to be transferred between JavaScript and WASM. This causes a lot overhead if the text based [OBJ](https://en.wikipedia.org/wiki/Wavefront_.obj_file) format is used. However, the same method is much faster if the binary [mz3](https://github.com/neurolabusc/surf-ice/tree/master/mz3) format is used. Note that neither the NiiVue or WASMmz3 methods support [UV mapping](https://en.wikipedia.org/wiki/UV_mapping). Therefore, in [this live demo](https://neurolabusc.github.io/simplifyjs/) these methods will not be used with the sphere objects (which use the earth surface UV texture). A final consideration of the table is the size of the code, which can influence load speeds.

The live demo uses web workers to compute simplification in the background. The exception is the `MainThread` method, which runs the NiiVue method on the main thread. While this blocks the animation for a little bit, it does illustrate the simplest way to implement mesh simplificaiton in JavaScript, without the complications of web worker messaging.

## Links

 - This project extends Tim Knip's [mesh-decimate](https://github.com/timknip/mesh-decimate) demo. 
 - All ports based on Sven Forstmann's C++ [Fast Quadric Mesh Simplification](https://github.com/sp4cerat/Fast-Quadric-Mesh-Simplification).
 - Pure JavaScript port by [Joshua Koo](https://gist.github.com/zz85/a317597912d68cf046558006d7647381).
 - Pure JavaScript port by [mXrap](https://mxrap.com/js_docs/lib_QuadricMeshSimplification.html)
 - Pure JavaScript port by [NiiVue](https://github.com/niivue/niivue-mesh). Their [live demo](https://niivue.github.io/niivue-mesh/) also provides voxel-to-mesh functions.
 - WebAssembly (WASM) simplification compilation by [MyMiniFactory](https://github.com/MyMiniFactory/Fast-Quadric-Mesh-Simplification).
 