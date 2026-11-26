import http, { type IncomingMessage, type ServerResponse } from 'node:http'

export interface MockServerHandle {
  baseUrl: string
  port: number
  close: () => Promise<void>
}

export async function startMockServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<MockServerHandle> {
  const server = http.createServer(handler)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind mock server port')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      }),
  }
}
