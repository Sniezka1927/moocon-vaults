// ---------------------------------------------------------------------------
// KISS PRNG — must match reveal.rs exactly
// ---------------------------------------------------------------------------

export class KissRng {
  private x: number
  private y: number
  private z: number
  private w: number

  private constructor(x: number, y: number, z: number, w: number) {
    this.x = x
    this.y = y
    this.z = z
    this.w = w
  }

  static fromSeed(seed: Uint8Array): KissRng {
    const view = new DataView(seed.buffer, seed.byteOffset, seed.byteLength)
    return new KissRng(
      (view.getUint32(0, true) | 1) >>> 0,
      (view.getUint32(4, true) | 1) >>> 0,
      view.getUint32(8, true) >>> 0,
      view.getUint32(12, true) >>> 0
    )
  }

  next(): number {
    // Linear congruential
    this.x = (Math.imul(this.x, 69069) + 12345) >>> 0

    // Xorshift
    this.y = (this.y ^ (this.y << 13)) >>> 0
    this.y = (this.y ^ (this.y >>> 17)) >>> 0
    this.y = (this.y ^ (this.y << 5)) >>> 0

    // Carry-add
    const t = this.z + this.w + 1
    this.z = this.w >>> 0
    this.w = (t & 0xffffffff) >>> 0

    return (this.x + this.y + this.w) >>> 0
  }

  nextU64(): bigint {
    const hi = BigInt(this.next() >>> 0)
    const lo = BigInt(this.next() >>> 0)
    return (hi << 32n) | lo
  }
}
