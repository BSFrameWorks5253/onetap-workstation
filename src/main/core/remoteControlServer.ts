import http from 'http'
import os from 'os'
import crypto from 'crypto'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { desktopCapturer, ipcMain, screen } from 'electron'
import type { Duplex } from 'stream'

export interface RemoteControlInfo {
  port: number
  token: string
  lanIps: string[]
}

const DEFAULT_PORT = 45253
const SESSION_TOKEN = crypto.randomBytes(8).toString('hex')

let activePort = DEFAULT_PORT
let httpServer: http.Server | null = null
let streamTimer: ReturnType<typeof setInterval> | null = null
let isCapturing = false
let psWorker: ChildProcessWithoutNullStreams | null = null

interface WsClient {
  socket: Duplex
  streaming: boolean
}

const clients = new Set<WsClient>()

function getLanIps(): string[] {
  const ips: string[] = []
  try {
    const ifaces = os.networkInterfaces()
    for (const name of Object.keys(ifaces)) {
      const list = ifaces[name] || []
      for (const info of list) {
        if (info.family === 'IPv4' && !info.internal && info.address) {
          ips.push(info.address)
        }
      }
    }
  } catch {}
  return ips
}

export function getRemoteControlInfo(): RemoteControlInfo {
  return {
    port: activePort,
    token: SESSION_TOKEN,
    lanIps: getLanIps()
  }
}

function sendWsFrame(socket: Duplex, opcode: number, payload: Buffer) {
  if (socket.destroyed || !socket.writable) return
  const len = payload.length
  let header: Buffer
  if (len < 126) {
    header = Buffer.alloc(2)
    header[0] = 0x80 | opcode
    header[1] = len
  } else if (len < 65536) {
    header = Buffer.alloc(4)
    header[0] = 0x80 | opcode
    header[1] = 126
    header.writeUInt16BE(len, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x80 | opcode
    header[1] = 127
    header.writeBigUInt64BE(BigInt(len), 2)
  }
  try {
    socket.write(Buffer.concat([header, payload]))
  } catch {}
}

function sendJson(socket: Duplex, obj: unknown) {
  sendWsFrame(socket, 0x1, Buffer.from(JSON.stringify(obj), 'utf8'))
}

function ensurePsWorker(): ChildProcessWithoutNullStreams | null {
  if (process.platform !== 'win32') return null
  if (psWorker && !psWorker.killed) return psWorker

  const initScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class OneTapInput {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern bool LockWorkStation();
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
  public struct POINT { public int X; public int Y; }
  public static void MoveRel(int dx, int dy) {
    POINT p; GetCursorPos(out p); SetCursorPos(p.X + dx, p.Y + dy);
  }
  public static void TapKey(byte vk) {
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, 2, UIntPtr.Zero);
  }
}
"@
`
  try {
    psWorker = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
      windowsHide: true,
      stdio: ['pipe', 'ignore', 'ignore']
    })
    psWorker.stdin.write(initScript + '\n')
    psWorker.on('exit', () => { psWorker = null })
    psWorker.on('error', () => { psWorker = null })
    return psWorker
  } catch {
    psWorker = null
    return null
  }
}

function runInputCmd(line: string) {
  const worker = ensurePsWorker()
  if (!worker || !worker.stdin.writable) return
  try {
    worker.stdin.write(line + '\n')
  } catch {}
}

function handleRemoteCommand(client: WsClient, msg: any) {
  if (!msg || typeof msg !== 'object') return
  const type = String(msg.type || '')

  if (type === 'stream') {
    client.streaming = Boolean(msg.enabled)
    updateStreamLoop()
    return
  }

  if (type === 'ping') {
    sendJson(client.socket, { type: 'pong', ts: Date.now() })
    return
  }

  if (process.platform !== 'win32') return

  switch (type) {
    case 'move': {
      const dx = Math.round(Number(msg.dx) || 0)
      const dy = Math.round(Number(msg.dy) || 0)
      if (dx !== 0 || dy !== 0) {
        runInputCmd(`[OneTapInput]::MoveRel(${dx}, ${dy})`)
      }
      break
    }
    case 'abs_tap': {
      const nx = Math.max(0, Math.min(1, Number(msg.nx) || 0))
      const ny = Math.max(0, Math.min(1, Number(msg.ny) || 0))
      const primary = screen.getPrimaryDisplay()
      const scale = primary.scaleFactor || 1
      const px = Math.round(nx * primary.size.width * scale)
      const py = Math.round(ny * primary.size.height * scale)
      runInputCmd(`[OneTapInput]::SetCursorPos(${px}, ${py}); [OneTapInput]::mouse_event(0x02,0,0,0,[UIntPtr]::Zero); [OneTapInput]::mouse_event(0x04,0,0,0,[UIntPtr]::Zero)`)
      break
    }
    case 'click': {
      const btn = String(msg.button || 'left')
      if (btn === 'right') {
        runInputCmd(`[OneTapInput]::mouse_event(0x08,0,0,0,[UIntPtr]::Zero); [OneTapInput]::mouse_event(0x10,0,0,0,[UIntPtr]::Zero)`)
      } else if (btn === 'double') {
        runInputCmd(`[OneTapInput]::mouse_event(0x02,0,0,0,[UIntPtr]::Zero); [OneTapInput]::mouse_event(0x04,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 40; [OneTapInput]::mouse_event(0x02,0,0,0,[UIntPtr]::Zero); [OneTapInput]::mouse_event(0x04,0,0,0,[UIntPtr]::Zero)`)
      } else {
        runInputCmd(`[OneTapInput]::mouse_event(0x02,0,0,0,[UIntPtr]::Zero); [OneTapInput]::mouse_event(0x04,0,0,0,[UIntPtr]::Zero)`)
      }
      break
    }
    case 'scroll': {
      const delta = Math.round(Number(msg.delta) || 0)
      if (delta !== 0) {
        runInputCmd(`[OneTapInput]::mouse_event(0x0800, 0, 0, ${delta}, [UIntPtr]::Zero)`)
      }
      break
    }
    case 'text': {
      const txt = String(msg.text || '')
      if (txt.length > 0 && txt.length <= 1000) {
        const b64 = Buffer.from(txt, 'utf8').toString('base64')
        runInputCmd(`$t = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')); [System.Windows.Forms.Clipboard]::SetText($t); [System.Windows.Forms.SendKeys]::SendWait('^v')`)
      }
      break
    }
    case 'key': {
      const key = String(msg.key || '').toLowerCase()
      const vkMap: Record<string, number> = {
        enter: 0x0d,
        backspace: 0x08,
        tab: 0x09,
        esc: 0x1b,
        space: 0x20,
        left: 0x25,
        up: 0x26,
        right: 0x27,
        down: 0x28,
        win: 0x5b,
        vol_mute: 0xad,
        vol_down: 0xae,
        vol_up: 0xaf,
        play_pause: 0xb3
      }
      const vk = vkMap[key]
      if (vk !== undefined) {
        runInputCmd(`[OneTapInput]::TapKey(${vk})`)
      }
      break
    }
    case 'power': {
      const action = String(msg.action || '')
      if (action === 'lock') {
        runInputCmd(`[OneTapInput]::LockWorkStation()`)
      } else if (action === 'screen_off') {
        runInputCmd(`[OneTapInput]::SendMessage([IntPtr]0xFFFF, 0x0112, [IntPtr]0xF170, [IntPtr]2)`)
      } else if (action === 'sleep') {
        runInputCmd(`rundll32.exe powrprof.dll,SetSuspendState 0,1,0`)
      }
      break
    }
  }
}

function updateStreamLoop() {
  const anyStreaming = Array.from(clients).some((c) => c.streaming && !c.socket.destroyed)
  if (!anyStreaming) {
    if (streamTimer) {
      clearInterval(streamTimer)
      streamTimer = null
    }
    return
  }
  if (streamTimer) return

  streamTimer = setInterval(async () => {
    if (isCapturing) return
    const targets = Array.from(clients).filter((c) => c.streaming && !c.socket.destroyed)
    if (targets.length === 0) {
      updateStreamLoop()
      return
    }
    isCapturing = true
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1280, height: 720 }
      })
      const primary = sources[0]
      if (primary && !primary.thumbnail.isEmpty()) {
        const jpg = primary.thumbnail.toJPEG(62)
        for (const c of targets) {
          sendWsFrame(c.socket, 0x2, jpg)
        }
      }
    } catch {} finally {
      isCapturing = false
    }
  }, 100)
}

function attachWsClient(socket: Duplex) {
  const client: WsClient = { socket, streaming: false }
  clients.add(client)
  let buffer = Buffer.alloc(0)

  sendJson(socket, {
    type: 'hello',
    platform: process.platform,
    hostname: os.hostname()
  })

  socket.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk])
    while (buffer.length >= 2) {
      const byte1 = buffer[0]
      const byte2 = buffer[1]
      const opcode = byte1 & 0x0f
      const masked = (byte2 & 0x80) !== 0
      let payloadLen = byte2 & 0x7f
      let offset = 2

      if (payloadLen === 126) {
        if (buffer.length < 4) return
        payloadLen = buffer.readUInt16BE(2)
        offset = 4
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return
        payloadLen = Number(buffer.readBigUInt64BE(2))
        offset = 10
      }

      const maskLen = masked ? 4 : 0
      if (buffer.length < offset + maskLen + payloadLen) return

      let payload = buffer.subarray(offset + maskLen, offset + maskLen + payloadLen)
      if (masked) {
        const mask = buffer.subarray(offset, offset + 4)
        const decoded = Buffer.allocUnsafe(payloadLen)
        for (let i = 0; i < payloadLen; i++) {
          decoded[i] = payload[i] ^ mask[i % 4]
        }
        payload = decoded
      }

      buffer = buffer.subarray(offset + maskLen + payloadLen)

      if (opcode === 0x8) {
        socket.end()
        return
      }
      if (opcode === 0x9) {
        sendWsFrame(socket, 0xA, payload)
        continue
      }
      if (opcode === 0x1) {
        try {
          const parsed = JSON.parse(payload.toString('utf8'))
          handleRemoteCommand(client, parsed)
        } catch {}
      }
    }
  })

  const cleanup = () => {
    clients.delete(client)
    updateStreamLoop()
  }
  socket.on('close', cleanup)
  socket.on('error', cleanup)
}

export function initRemoteControlServer() {
  ipcMain.handle('remoteControl:getInfo', () => getRemoteControlInfo())

  if (httpServer) return
  httpServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ service: 'OneTap Remote Control', port: activePort }))
  })

  httpServer.on('upgrade', (req, socket) => {
    try {
      const url = new URL(req.url || '/', `http://localhost:${activePort}`)
      const token = url.searchParams.get('token') || ''
      if (token !== SESSION_TOKEN) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      const key = req.headers['sec-websocket-key']
      if (!key) {
        socket.destroy()
        return
      }
      const accept = crypto
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64')

      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
      )
      attachWsClient(socket)
    } catch {
      socket.destroy()
    }
  })

  const tryListen = (port: number) => {
    if (!httpServer) return
    httpServer.once('error', (err: any) => {
      if (err?.code === 'EADDRINUSE' && port < DEFAULT_PORT + 5) {
        tryListen(port + 1)
      }
    })
    httpServer.listen(port, '0.0.0.0', () => {
      activePort = port
      console.log(`[RemoteControl] LAN WebSocket listening on 0.0.0.0:${activePort}`)
    })
  }
  tryListen(DEFAULT_PORT)
}

export function stopRemoteControlServer() {
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
  for (const c of clients) {
    try { c.socket.destroy() } catch {}
  }
  clients.clear()
  if (psWorker) {
    try { psWorker.kill() } catch {}
    psWorker = null
  }
  if (httpServer) {
    try { httpServer.close() } catch {}
    httpServer = null
  }
}
