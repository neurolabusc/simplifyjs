import { simplifyJS } from './simplify.js'
self.addEventListener('message', function(e) {
    let aggressiveness = e.data.agressiveness
    let frac = e.data.fraction
    let verts = e.data.vertices
    let tris = e.data.indices
    let target = e.data.target,
    t = Date.now()
    let g = simplifyJS(verts, tris, frac, aggressiveness)
    let took = Date.now() - t
    self.postMessage({
        took: took,
        vertices: g.vertices,
        triangles: g.triangles},
        [ g.vertices.buffer, g.triangles.buffer ])
}, false)
