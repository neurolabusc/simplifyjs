// Mesh Simplification Tutorial
//
// (C) by Sven Forstmann in 2014
//
// License : MIT
// http://opensource.org/licenses/MIT
//
// https://github.com/sp4cerat/Fast-Quadric-Mesh-Simplification
//
// Ported to JavaScript by Chris Rorden 2024 (with a little help from ChatGPT)

class QuadricSimplifyMesh {
  constructor(vs, ts, targetCount, aggressiveness = 7, finishLossless = false, verbose = true) {
    this.vertices = []
    this.triangles = []
    this.refs = new Array(ts.length) // Pre-allocate memory
    this.targetCount = targetCount
    this.aggressiveness = aggressiveness
    this.finishLossless = finishLossless
    this.verbose = verbose
    this.init(vs, ts)
  }

  init(vs, ts) {
    for (let i = 0; i < vs.length; i += 3) {
      this.vertices.push({
        p: { x: vs[i], y: vs[i + 1], z: vs[i + 2] },
        tstart: 0,
        tcount: 0,
        q: new Float32Array(10).fill(0),
        border: 0
      })
    }

    for (let i = 0; i < ts.length; i += 3) {
      this.triangles.push({
        v: [ts[i], ts[i + 1], ts[i + 2]],
        err: new Float32Array(4).fill(0),
        dirty: false,
        deleted: false,
        n: { x: 0, y: 0, z: 0 }
      })
    }
  }

  symMat1(ret, c) {
    ret.fill(c)
  }

  symMat4(ret, a, b, c, d) {
    ret[0] = a * a
    ret[1] = a * b
    ret[2] = a * c
    ret[3] = a * d
    ret[4] = b * b
    ret[5] = b * c
    ret[6] = b * d
    ret[7] = c * c
    ret[8] = c * d
    ret[9] = d * d
  }

  symMat10(ret, m11, m12, m13, m14, m22, m23, m24, m33, m34, m44) {
    ret[0] = m11
    ret[1] = m12
    ret[2] = m13
    ret[3] = m14
    ret[4] = m22
    ret[5] = m23
    ret[6] = m24
    ret[7] = m33
    ret[8] = m34
    ret[9] = m44
  }

  symMatAdd(ret, n, m) {
    for (let i = 0; i < 10; i++) {
      ret[i] = n[i] + m[i]
    }
  }

  symMatDet(m, a11, a12, a13, a21, a22, a23, a31, a32, a33) {
    return (
      m[a11] * m[a22] * m[a33] +
      m[a13] * m[a21] * m[a32] +
      m[a12] * m[a23] * m[a31] -
      m[a13] * m[a22] * m[a31] -
      m[a11] * m[a23] * m[a32] -
      m[a12] * m[a21] * m[a33]
    )
  }

  vCross(v1, v2) {
    return { x: v1.y * v2.z - v1.z * v2.y, y: v1.z * v2.x - v1.x * v2.z, z: v1.x * v2.y - v1.y * v2.x }
  }

  vSum(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
  }

  vSubtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  }

  vNormalize(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
    if (len <= 0) {
      return
    }
    v.x /= len
    v.y /= len
    v.z /= len
  }

  vDot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z
  }

  vMult(a, v) {
    return { x: a.x * v, y: a.y * v, z: a.z * v }
  }

  vertexError(q, x, y, z) {
    return (
      q[0] * x * x +
      2 * q[1] * x * y +
      2 * q[2] * x * z +
      2 * q[3] * x +
      q[4] * y * y +
      2 * q[5] * y * z +
      2 * q[6] * y +
      q[7] * z * z +
      2 * q[8] * z +
      q[9]
    )
  }

  calculateErrorFast(id_v1, id_v2) {
    const q = new Float32Array(10)
    this.symMatAdd(q, this.vertices[id_v1].q, this.vertices[id_v2].q)
    const border = this.vertices[id_v1].border + this.vertices[id_v2].border
    const det = this.symMatDet(q, 0, 1, 2, 1, 4, 5, 2, 5, 7)

    if (det !== 0.0 && border === 0) {
      const x = (-1.0 / det) * this.symMatDet(q, 1, 2, 3, 4, 5, 6, 5, 7, 8)
      const y = (1.0 / det) * this.symMatDet(q, 0, 2, 3, 1, 5, 6, 2, 7, 8)
      const z = (-1.0 / det) * this.symMatDet(q, 0, 1, 3, 1, 4, 6, 2, 5, 8)
      return this.vertexError(q, x, y, z)
    }

    const p1 = this.vertices[id_v1].p
    const p2 = this.vertices[id_v2].p
    const p3 = this.vMult(this.vSum(p1, p2), 0.5)
    const error1 = this.vertexError(q, p1.x, p1.y, p1.z)
    const error2 = this.vertexError(q, p2.x, p2.y, p2.z)
    const error3 = this.vertexError(q, p3.x, p3.y, p3.z)
    const error = Math.min(error1, Math.min(error2, error3))
    return error
  }

  calculateError(id_v1, id_v2, p_result) {
    const q = new Float32Array(10)
    this.symMatAdd(q, this.vertices[id_v1].q, this.vertices[id_v2].q)
    const border = this.vertices[id_v1].border + this.vertices[id_v2].border
    const det = this.symMatDet(q, 0, 1, 2, 1, 4, 5, 2, 5, 7)

    if (det !== 0.0 && border === 0) {
      p_result.x = (-1.0 / det) * this.symMatDet(q, 1, 2, 3, 4, 5, 6, 5, 7, 8)
      p_result.y = (1.0 / det) * this.symMatDet(q, 0, 2, 3, 1, 5, 6, 2, 7, 8)
      p_result.z = (-1.0 / det) * this.symMatDet(q, 0, 1, 3, 1, 4, 6, 2, 5, 8)
      return this.vertexError(q, p_result.x, p_result.y, p_result.z)
    }

    const p1 = this.vertices[id_v1].p
    const p2 = this.vertices[id_v2].p
    const p3 = this.vMult(this.vSum(p1, p2), 0.5)
    const error1 = this.vertexError(q, p1.x, p1.y, p1.z)
    const error2 = this.vertexError(q, p2.x, p2.y, p2.z)
    const error3 = this.vertexError(q, p3.x, p3.y, p3.z)
    const error = Math.min(error1, Math.min(error2, error3))
    if (error1 === error) {
      p_result = p1
    }
    if (error2 === error) {
      p_result = p2
    }
    if (error3 === error) {
      p_result = p3
    }
    return error
  }

  updateMesh(iteration) {
    if (iteration > 0) {
      let dst = 0
      for (let i = 0; i < this.triangles.length; i++) {
        if (!this.triangles[i].deleted) {
          this.triangles[dst++] = this.triangles[i]
        }
      }
      this.triangles.length = dst
    }

    for (const vertex of this.vertices) {
      vertex.tstart = 0
      vertex.tcount = 0
    }

    for (let i = 0; i < this.triangles.length; i++) {
      for (let j = 0; j < 3; j++) {
        this.vertices[this.triangles[i].v[j]].tcount++
      }
    }

    let tstart = 0
    for (const vertex of this.vertices) {
      vertex.tstart = tstart
      tstart += vertex.tcount
      vertex.tcount = 0
    }

    this.refs.length = this.triangles.length * 3
    for (let i = 0; i < this.triangles.length; i++) {
      const t = this.triangles[i]
      for (let j = 0; j < 3; j++) {
        const v = this.vertices[t.v[j]]
        this.refs[v.tstart + v.tcount] = { tid: i, tvertex: j }
        v.tcount++
      }
    }

    if (iteration !== 0) {
      return
    }

    for (const vertex of this.vertices) {
      vertex.border = 0
    }

    const vids = new Uint32Array(this.vertices.length)
    const vcount = new Uint32Array(this.vertices.length)

    for (let i = 0; i < this.vertices.length; i++) {
      let nvcount = 0
      const v = this.vertices[i]
      for (let j = 0; j < v.tcount; j++) {
        const k = this.refs[v.tstart + j].tid
        const t = this.triangles[k]
        for (let l = 0; l < 3; l++) {
          const id = t.v[l]
          let ofs = 0
          while (ofs < nvcount) {
            if (vids[ofs] === id) {
              break
            }
            ofs++
          }
          if (ofs === nvcount) {
            vcount[nvcount] = 1
            vids[nvcount] = id
            nvcount++
          } else {
            vcount[ofs]++
          }
        }
      }
      for (let j = 0; j < nvcount; j++) {
        if (vcount[j] === 1) {
          this.vertices[vids[j]].border = 1
        }
      }
    }

    for (const vertex of this.vertices) {
      this.symMat1(vertex.q, 0.0)
    }

    for (let i = 0; i < this.triangles.length; i++) {
      const t = this.triangles[i]
      const p = []
      for (let j = 0; j < 3; j++) {
        p[j] = this.vertices[t.v[j]].p
      }
      const n = this.vCross(this.vSubtract(p[1], p[0]), this.vSubtract(p[2], p[0]))
      this.vNormalize(n)
      t.n = n
      for (let j = 0; j < 3; j++) {
        const q = new Float32Array(10)
        this.symMat4(q, n.x, n.y, n.z, -this.vDot(n, p[0]))
        this.symMatAdd(this.vertices[t.v[j]].q, this.vertices[t.v[j]].q, q)
      }
    }

    for (let i = 0; i < this.triangles.length; i++) {
      const t = this.triangles[i]
      for (let j = 0; j < 3; j++) {
        t.err[j] = this.calculateErrorFast(t.v[j], t.v[(j + 1) % 3])
      }
      t.err[3] = Math.min(t.err[0], Math.min(t.err[1], t.err[2]))
    }
  }

  compactMesh() {
    let dst = 0
    for (const vertex of this.vertices) {
      vertex.tcount = 0
    }

    for (let i = 0; i < this.triangles.length; i++) {
      if (!this.triangles[i].deleted) {
        this.triangles[dst++] = this.triangles[i]
        for (let j = 0; j < 3; j++) {
          this.vertices[this.triangles[i].v[j]].tcount = 1
        }
      }
    }
    this.triangles.length = dst

    dst = 0
    for (let i = 0; i < this.vertices.length; i++) {
      if (this.vertices[i].tcount) {
        this.vertices[i].tstart = dst
        this.vertices[dst].p = this.vertices[i].p
        dst++
      }
    }

    for (let i = 0; i < this.triangles.length; i++) {
      const t = this.triangles[i]
      for (let j = 0; j < 3; j++) {
        t.v[j] = this.vertices[t.v[j]].tstart
      }
    }

    this.vertices.length = dst
  }

  updateTriangles(i0, v, deleted, deletedTriangles) {
    for (let k = 0; k < v.tcount; k++) {
      const r = this.refs[v.tstart + k]
      const t = this.triangles[r.tid]
      if (t.deleted) {
        continue
      }
      if (deleted[k]) {
        t.deleted = true
        deletedTriangles++
        continue
      }
      t.v[r.tvertex] = i0
      t.dirty = true
      t.err[0] = this.calculateErrorFast(t.v[0], t.v[1])
      t.err[1] = this.calculateErrorFast(t.v[1], t.v[2])
      t.err[2] = this.calculateErrorFast(t.v[2], t.v[0])
      t.err[3] = Math.min(t.err[0], Math.min(t.err[1], t.err[2]))
      this.refs.push(r)
    }
    return deletedTriangles
  }

  flipped(p, i0, i1, v0, v1, deleted) {
    for (let k = 0; k < v0.tcount; k++) {
      const t = this.triangles[this.refs[v0.tstart + k].tid]
      if (t.deleted) {
        continue
      }
      const s = this.refs[v0.tstart + k].tvertex
      const id1 = t.v[(s + 1) % 3]
      const id2 = t.v[(s + 2) % 3]
      if (id1 === i1 || id2 === i1) {
        deleted[k] = true
        continue
      }
      const d1 = this.vSubtract(this.vertices[id1].p, p)
      this.vNormalize(d1)
      const d2 = this.vSubtract(this.vertices[id2].p, p)
      this.vNormalize(d2)
      if (Math.abs(this.vDot(d1, d2)) > 0.999) {
        return true
      }
      const n = this.vCross(d1, d2)
      this.vNormalize(n)
      deleted[k] = false
      if (this.vDot(n, t.n) < 0.2) {
        return true
      }
    }
    return false
  }

  simplify(verbose = true) {
    let deletedTriangles = 0
    const triangleCount = this.triangles.length
    const deleted0 = new Array(triangleCount * 3).fill(false) // overprovision
    const deleted1 = new Array(triangleCount * 3).fill(false) // overprovision
    const ntriOK = triangleCount
    let maxIter = 100
    let lossy = true
    let threshold = Number.EPSILON

    if (this.aggressiveness <= 5) {
      maxIter = 500
    }
    if (this.targetCount >= ntriOK) {
      lossy = false
      maxIter = 1000
    }
    let iterationStartCount = 0
    for (let iteration = 0; iteration < maxIter; iteration++) {
      if (lossy && triangleCount - deletedTriangles <= this.targetCount) {
        if (!this.finishLossless) {
          break
        }
        lossy = false
        threshold = Number.EPSILON
        maxIter = 1000
      }

      if (lossy) {
        if (iteration % 5 === 0) {
          this.updateMesh(iteration)
        }
        threshold = 0.000000001 * Math.pow(iteration + 3.0, this.aggressiveness)
      } else {
        if (iterationStartCount === triangleCount - deletedTriangles) {
          break
        }
        this.updateMesh(iteration)
      }

      iterationStartCount = triangleCount - deletedTriangles

      for (let i = 0; i < this.triangles.length; i++) {
        this.triangles[i].dirty = false
      }

      if (verbose && iteration % 5 === 0) {
        console.log(`iteration ${iteration} - triangles ${triangleCount - deletedTriangles} threshold ${threshold}`)
      }

      for (let i = 0; i < this.triangles.length; i++) {
        const t = this.triangles[i]

        if (t.err[3] > threshold) {
          continue
        }
        if (t.deleted) {
          continue
        }
        if (t.dirty) {
          continue
        }
        for (let j = 0; j < 3; j++) {
          if (t.err[j] < threshold) {
            const i0 = t.v[j]
            const v0 = this.vertices[i0]
            const i1 = t.v[(j + 1) % 3]
            const v1 = this.vertices[i1]
            if (v0.border !== v1.border) {
              continue
            }
            const p = { x: 0, y: 0, z: 0 }
            this.calculateError(i0, i1, p)
            if (this.flipped(p, i0, i1, v0, v1, deleted0)) {
              continue
            }
            if (this.flipped(p, i1, i0, v1, v0, deleted1)) {
              continue
            }
            v0.p = p
            this.symMatAdd(v0.q, v1.q, v0.q)
            const tstart = this.refs.length
            deletedTriangles = this.updateTriangles(i0, v0, deleted0, deletedTriangles)
            deletedTriangles = this.updateTriangles(i0, v1, deleted1, deletedTriangles)
            const tcount = this.refs.length - tstart
            if (tcount <= v0.tcount) {
              if (tcount) {
                this.refs.splice(v0.tstart, tcount, ...this.refs.slice(tstart, tstart + tcount))
              }
            } else {
              v0.tstart = tstart
            }
            v0.tcount = tcount
            break
          }
        }
        if (lossy && triangleCount - deletedTriangles <= this.targetCount) {
          break
        }
      }
    }
    this.compactMesh()
    const finalVs = new Float32Array(this.vertices.length * 3)
    let j = 0
    for (const vertex of this.vertices) {
      finalVs[j++] = vertex.p.x
      finalVs[j++] = vertex.p.y
      finalVs[j++] = vertex.p.z
    }
    const finalTs = new Uint32Array(this.triangles.length * 3)
    j = 0
    for (const triangle of this.triangles) {
      finalTs[j++] = triangle.v[0]
      finalTs[j++] = triangle.v[1]
      finalTs[j++] = triangle.v[2]
    }
    if (verbose) {
      const pct = Math.round((100 * (finalTs.length / 3)) / triangleCount)
      console.log(`Vertices ${finalVs.length / 3} Triangles ${finalTs.length / 3} ${pct}%`)
    }
    return { vertices: finalVs, triangles: finalTs }
  }
}

export function simplifyJS(verts, tris, tri_fraction = 0.5, aggressiveness = 7, finishLossless = false, verbose = false) {
  const targetCount = Math.ceil((tris.length / 3) * tri_fraction)
  const simplifier = new QuadricSimplifyMesh(verts, tris, targetCount, aggressiveness, finishLossless, verbose)
  return simplifier.simplify()
}
