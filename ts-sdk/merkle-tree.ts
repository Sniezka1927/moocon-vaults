import { keccak256 } from 'js-sha3'
import { HASH_SIZE } from './consts'
import { PublicKey } from '@solana/web3.js'
import { Buffer } from 'node:buffer'

const LEAF_PREFIX = new Uint8Array([0x00])
const NODE_PREFIX = new Uint8Array([0x01])
const NULL_PREFIX = new Uint8Array([0x02])

type HashResult = Uint8Array

function concatenateUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export class MerkleTree {
  public nodes: Uint8Array[]
  public indices = new Map<string, number>()

  static hash(buffer: Uint8Array): HashResult {
    const bytes = new Uint8Array(keccak256.arrayBuffer(buffer))
    return bytes.subarray(0, HASH_SIZE)
  }

  static hashNode(l: Uint8Array, r: Uint8Array): HashResult {
    const compare = (a: Uint8Array, b: Uint8Array): number => {
      for (let i = 0; i < a.length && i < b.length; i++) {
        if (a[i] !== b[i]) return a[i] - b[i]
      }
      return a.length - b.length
    }

    if (compare(l, r) < 0) {
      return MerkleTree.hash(concatenateUint8Arrays(NODE_PREFIX, l, r))
    } else {
      return MerkleTree.hash(concatenateUint8Arrays(NODE_PREFIX, r, l))
    }
  }

  static hashLeaf(leaf: Uint8Array): HashResult {
    return MerkleTree.hash(concatenateUint8Arrays(LEAF_PREFIX, leaf))
  }

  constructor(leaves: Uint8Array[]) {
    if (leaves.length === 0) {
      throw new Error('cannot build tree from empty leaves')
    }

    const depth = Math.ceil(Math.log2(leaves.length))
    const nullHash = MerkleTree.hash(NULL_PREFIX)
    this.nodes = new Array(1 << (depth + 1)).fill(null).map(() => NULL_PREFIX)

    for (let i = 0; i < 1 << depth; i++) {
      if (i < leaves.length) {
        this.nodes[(1 << depth) + i] = MerkleTree.hashLeaf(leaves[i])
        this.indices.set(toHex(leaves[i]), (1 << depth) + i)
      } else {
        this.nodes[(1 << depth) + i] = nullHash
      }
    }

    for (let k = depth - 1; k >= 0; k--) {
      for (let i = 0; i < 1 << k; i++) {
        this.nodes[(1 << k) + i] = MerkleTree.hashNode(
          this.nodes[(1 << (k + 1)) + 2 * i],
          this.nodes[(1 << (k + 1)) + 2 * i + 1]
        )
      }
    }
  }

  prove(leaf: Uint8Array): Uint8Array | undefined {
    const index = this.indices.get(toHex(leaf))

    if (index === undefined) {
      return undefined
    }

    let current = index
    const path: Uint8Array[] = []
    while (current > 1) {
      path.push(this.nodes[current ^ 1])
      current = Math.floor(current / 2)
    }

    return concatenateUint8Arrays(...path)
  }

  get root(): Uint8Array {
    return this.nodes[1]
  }
}

export class Leaf {
  constructor(
    public address: PublicKey | string,
    public tickets: bigint
  ) {}

  public static toBufferArray(arr: Leaf[]): Buffer[] {
    return arr.map((item) => item.toBuffer())
  }
  public toBuffer(): Buffer {
    const addressBytes =
      typeof this.address === 'string'
        ? new PublicKey(this.address).toBuffer()
        : this.address.toBuffer()
    const ticketsBuf = Buffer.alloc(8)
    ticketsBuf.writeBigUInt64LE(this.tickets)
    return Buffer.concat([addressBytes, ticketsBuf])
  }
}
