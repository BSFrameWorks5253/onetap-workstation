import fs from 'fs'
import { pipeline } from 'stream/promises'
import { Writable } from 'stream'

const PRIME64_1 = 11400714785074694791n // 0x9E3779B185EBCA87n
const PRIME64_2 = 14029467366897019727n // 0xC2B2AE3D27D4EB4Fn
const PRIME64_3 = 1609587929392839161n  // 0x165667B19E3779F9n
const PRIME64_4 = 9650029242287828579n  // 0x85EBCA77C2B2AE63n
const PRIME64_5 = 2870177450012600261n  // 0x27D4EB2F165667C5n
const MASK64    = 0xFFFFFFFFFFFFFFFFn

function rotl64(x: bigint, r: bigint): bigint {
  return ((x << r) | (x >> (64n - r))) & MASK64
}

/**
 * Pure TypeScript Streaming xxHash64 Implementation
 * Ultra-fast non-cryptographic 64-bit checksum engine for media files.
 */
export class XXHash64 {
  private seed: bigint
  private v1: bigint = 0n
  private v2: bigint = 0n
  private v3: bigint = 0n
  private v4: bigint = 0n
  private totalLen: bigint = 0n
  private mem: Buffer = Buffer.alloc(32)
  private memSize: number = 0

  constructor(seed: bigint = 0n) {
    this.seed = BigInt(seed) & MASK64
    this.reset()
  }

  public reset(): void {
    this.v1 = (this.seed + PRIME64_1 + PRIME64_2) & MASK64
    this.v2 = (this.seed + PRIME64_2) & MASK64
    this.v3 = this.seed
    this.v4 = (this.seed - PRIME64_1) & MASK64
    this.totalLen = 0n
    this.memSize = 0
  }

  public update(buffer: Buffer): this {
    this.totalLen += BigInt(buffer.length)
    let offset = 0
    let len = buffer.length

    if (this.memSize > 0) {
      const fill = 32 - this.memSize
      if (len < fill) {
        buffer.copy(this.mem, this.memSize, 0, len)
        this.memSize += len
        return this
      }
      buffer.copy(this.mem, this.memSize, 0, fill)
      this._processStripe(this.mem, 0)
      offset += fill
      len -= fill
      this.memSize = 0
    }

    while (len >= 32) {
      this._processStripe(buffer, offset)
      offset += 32
      len -= 32
    }

    if (len > 0) {
      buffer.copy(this.mem, 0, offset, offset + len)
      this.memSize = len
    }

    return this
  }

  private _processStripe(buf: Buffer, offset: number): void {
    this.v1 = this._round(this.v1, buf.readBigUInt64LE(offset))
    this.v2 = this._round(this.v2, buf.readBigUInt64LE(offset + 8))
    this.v3 = this._round(this.v3, buf.readBigUInt64LE(offset + 16))
    this.v4 = this._round(this.v4, buf.readBigUInt64LE(offset + 24))
  }

  private _round(acc: bigint, input: bigint): bigint {
    acc = (acc + input * PRIME64_2) & MASK64
    acc = rotl64(acc, 31n)
    return (acc * PRIME64_1) & MASK64
  }

  private _mergeRound(acc: bigint, val: bigint): bigint {
    val = this._round(0n, val)
    acc = (acc ^ val) & MASK64
    return (acc * PRIME64_1 + PRIME64_4) & MASK64
  }

  public digest(): string {
    let h64: bigint
    if (this.totalLen >= 32n) {
      h64 = (rotl64(this.v1, 1n) + rotl64(this.v2, 7n) + rotl64(this.v3, 12n) + rotl64(this.v4, 18n)) & MASK64
      h64 = this._mergeRound(h64, this.v1)
      h64 = this._mergeRound(h64, this.v2)
      h64 = this._mergeRound(h64, this.v3)
      h64 = this._mergeRound(h64, this.v4)
    } else {
      h64 = (this.seed + PRIME64_5) & MASK64
    }
    h64 = (h64 + this.totalLen) & MASK64

    let offset = 0
    let remaining = this.memSize
    while (remaining >= 8) {
      const k1 = this._round(0n, this.mem.readBigUInt64LE(offset))
      h64 = (h64 ^ k1) & MASK64
      h64 = (rotl64(h64, 27n) * PRIME64_1 + PRIME64_4) & MASK64
      offset += 8
      remaining -= 8
    }

    if (remaining >= 4) {
      const k1 = BigInt(this.mem.readUInt32LE(offset)) * PRIME64_1
      h64 = (h64 ^ k1) & MASK64
      h64 = (rotl64(h64, 23n) * PRIME64_2 + PRIME64_3) & MASK64
      offset += 4
      remaining -= 4
    }

    while (remaining > 0) {
      const k1 = BigInt(this.mem[offset]) * PRIME64_5
      h64 = (h64 ^ k1) & MASK64
      h64 = (rotl64(h64, 11n) * PRIME64_1) & MASK64
      offset++
      remaining--
    }

    h64 = (h64 ^ (h64 >> 33n)) & MASK64
    h64 = (h64 * PRIME64_2) & MASK64
    h64 = (h64 ^ (h64 >> 29n)) & MASK64
    h64 = (h64 * PRIME64_3) & MASK64
    h64 = (h64 ^ (h64 >> 32n)) & MASK64

    return h64.toString(16).padStart(16, '0')
  }
}

/**
 * Computes the 64-bit xxHash of a file using high-performance stream chunks
 */
export async function computeFileXxHash64(
  filePath: string,
  onChunk?: (bytes: number) => void
): Promise<string> {
  const hasher = new XXHash64()
  const stream = fs.createReadStream(filePath, { highWaterMark: 4 * 1024 * 1024 })

  const consumer = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      hasher.update(chunk)
      if (onChunk) onChunk(chunk.length)
      callback()
    }
  })

  await pipeline(stream, consumer)
  return hasher.digest()
}

/**
 * Computes hash of a buffer in memory
 */
export function computeBufferXxHash64(buffer: Buffer): string {
  const hasher = new XXHash64()
  hasher.update(buffer)
  return hasher.digest()
}

/**
 * Verifies if two files on disk match exactly in size and xxHash64 checksum
 */
export async function verifyFilesMatch(
  srcPath: string,
  dstPath: string
): Promise<{
  match: boolean
  srcHash: string
  dstHash: string
  srcSize: number
  dstSize: number
}> {
  const srcStat = await fs.promises.stat(srcPath)
  const dstStat = await fs.promises.stat(dstPath)

  if (srcStat.size !== dstStat.size) {
    return {
      match: false,
      srcHash: '',
      dstHash: '',
      srcSize: srcStat.size,
      dstSize: dstStat.size
    }
  }

  const [srcHash, dstHash] = await Promise.all([
    computeFileXxHash64(srcPath),
    computeFileXxHash64(dstPath)
  ])

  return {
    match: srcHash === dstHash,
    srcHash,
    dstHash,
    srcSize: srcStat.size,
    dstSize: dstStat.size
  }
}
