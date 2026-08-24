export function createId(): string {
  const cryptoApi = globalThis.crypto

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID()
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16)
    cryptoApi.getRandomValues(bytes)

    // RFC 4122 v4 formatting bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    return `${hex.slice(0, 4).join('')}${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 12).join('')}-${hex.slice(12, 16).join('')}`
  }

  const random = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1)
  return `${random()}${random()}-${random()}-${random()}-${random()}-${random()}${random()}${random()}`
}