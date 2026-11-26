import fs from 'node:fs/promises'

export interface Mp4ValidationResult {
  valid: boolean
  reason?: string
  majorBrand?: string
  looksLikeHtmlOrText?: boolean
}

const KNOWN_TEXT_PREFIXES = ['<!doctype', '<html', '<head', '<body', '<?xml', '{"', '[{"', '<svg', '<script']

export function validateMp4HeaderBuffer(buffer: Uint8Array): Mp4ValidationResult {
  if (!buffer || buffer.length < 12) {
    return {
      valid: false,
      reason: 'File is empty or too small to be a valid MP4 video container.',
    }
  }

  const headAscii = Buffer.from(buffer.subarray(0, Math.min(64, buffer.length)))
    .toString('utf8')
    .trimStart()
    .toLowerCase()

  for (const prefix of KNOWN_TEXT_PREFIXES) {
    if (headAscii.startsWith(prefix)) {
      return {
        valid: false,
        looksLikeHtmlOrText: true,
        reason: 'Received an HTML/JSON error page instead of binary MP4 video data.',
      }
    }
  }

  const boxSize =
    ((buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3]) >>> 0
  const boxType = Buffer.from(buffer.subarray(4, 8)).toString('ascii')

  if (boxType === 'ftyp') {
    const majorBrand = Buffer.from(buffer.subarray(8, 12)).toString('ascii')
    if (boxSize < 12) {
      return {
        valid: false,
        reason: 'Invalid MP4 ftyp header box size.',
      }
    }
    return {
      valid: true,
      majorBrand,
    }
  }

  // Some valid MP4 containers begin with free/skip/wide before ftyp or moov
  if ((boxType === 'free' || boxType === 'skip' || boxType === 'wide') && buffer.length >= 24) {
    if (boxSize >= 8 && boxSize + 8 <= buffer.length) {
      const nextType = Buffer.from(buffer.subarray(boxSize + 4, boxSize + 8)).toString('ascii')
      if (nextType === 'ftyp' || nextType === 'moov') {
        return {
          valid: true,
          majorBrand: nextType,
        }
      }
    }
  }

  return {
    valid: false,
    reason: `Invalid MP4 signature: expected ISO BMFF "ftyp" header, found "${boxType.replace(/[^\x20-\x7e]/g, '?')}".`,
  }
}

export async function validateMp4FileOnDisk(
  filePath: string,
  expectedBytes: number | null,
): Promise<{ valid: boolean; sizeBytes: number; reason?: string; majorBrand?: string }> {
  const stat = await fs.stat(filePath)
  if (stat.size <= 0) {
    return {
      valid: false,
      sizeBytes: 0,
      reason: 'Downloaded file is empty (0 bytes).',
    }
  }

  if (expectedBytes !== null && expectedBytes > 0 && stat.size < expectedBytes) {
    return {
      valid: false,
      sizeBytes: stat.size,
      reason: `Incomplete download: received ${stat.size} bytes out of expected ${expectedBytes} bytes.`,
    }
  }

  const handle = await fs.open(filePath, 'r')
  try {
    const headerBuf = Buffer.alloc(Math.min(256, stat.size))
    const { bytesRead } = await handle.read(headerBuf, 0, headerBuf.length, 0)
    const sig = validateMp4HeaderBuffer(headerBuf.subarray(0, bytesRead))
    return {
      valid: sig.valid,
      sizeBytes: stat.size,
      reason: sig.reason,
      majorBrand: sig.majorBrand,
    }
  } finally {
    await handle.close()
  }
}

/**
 * Generates a legitimate minimal playable ISO BMFF MP4 byte buffer
 * (`ftypisom` + `moov`/`mvhd` + `mdat`) for automated unit/integration tests.
 */
export function createMinimalValidMp4Buffer(payloadBytes = 4096): Buffer {
  const ftyp = Buffer.from([
    0x00, 0x00, 0x00, 0x14, // size = 20
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6f, 0x6d, // major_brand 'isom'
    0x00, 0x00, 0x02, 0x00, // minor_version
    0x69, 0x73, 0x6f, 0x6d, // compatible_brand 'isom'
  ])

  const mvhd = Buffer.from([
    0x00, 0x00, 0x00, 0x6c, // size = 108
    0x6d, 0x76, 0x68, 0x64, // 'mvhd'
    ...new Array<number>(100).fill(0),
  ])

  const moovSize = 8 + mvhd.length
  const moovHeader = Buffer.alloc(8)
  moovHeader.writeUInt32BE(moovSize, 0)
  moovHeader.write('moov', 4, 'ascii')

  const mdatSize = 8 + payloadBytes
  const mdatHeader = Buffer.alloc(8)
  mdatHeader.writeUInt32BE(mdatSize, 0)
  mdatHeader.write('mdat', 4, 'ascii')
  const mdatBody = Buffer.alloc(payloadBytes, 0xaa)

  return Buffer.concat([ftyp, moovHeader, mvhd, mdatHeader, mdatBody])
}
