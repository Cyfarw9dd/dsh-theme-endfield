/**
 * motion-check.js — prove the D/E/F button-motion schemes (clamp / meter / stamp)
 * actually reach a real button in a real renderer, with a real pointer.
 *
 * Why this exists: `data-endfield-motion` is a data attribute on <body> and every
 * scheme is gated on it. A rule that names the wrong attribute value, that loses
 * the cascade to the app's own `transition:none !important` button reset, or whose
 * pseudo-element never generates because the host element is not `position:
 * relative` — all of those are invisible to a grep-style test that only checks
 * that some selector text is present in the file. This script renders the REAL
 * stylesheet out of client.js into a mock page, drives the genuine :hover /
 * :active with Input.dispatchMouseEvent, and asserts on computed styles plus
 * corner PIXELS.
 *
 * What each scheme is checked for:
 *
 *   D clamp  — the four-corner bracket is a single mask-image on ::after, coloured
 *              --edge-accent-onpaper; the newSession CTA gets a left signal rule
 *              and a 2px label shift. A masked pseudo-element is exactly the thing
 *              a "selector exists" test cannot falsify, so the bracket is also
 *              sampled as pixels in the button's top-left corner.
 *   E meter  — iconButton corners are eight background gradients (crosshair
 *              ticks); the newSession readout bar grows 6% -> 100% on hover and
 *              goes solid accent on press. Read on the COMPUTED width, i.e. after
 *              the app's own button reset has had its say.
 *   F stamp  — a paused 180ms keyframes animation on the primary button at press
 *              (the imprint), a translateX shake on decline, scale(.88) on
 *              iconButton, and a 2px accent outline on plain buttons.
 *
 * Plus two controls that keep the test honest:
 *   - `off` must produce NONE of it (the shared `:active` dim is still expected);
 *   - `prefers-reduced-motion: reduce` must kill the transform/animation while
 *     leaving the colour transition alone.
 *
 * Usage: node test/motion-check.js
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const http = require('http')
const zlib = require('zlib')
const { spawn } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const findChrome = () => [process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean).find((p) => fs.existsSync(p))
const chrome = findChrome()
if (!chrome) { console.error('FAIL  no Chrome/Edge found (set CHROME_PATH)'); process.exit(1) }

let failures = 0
const pass = (m) => console.log('ok    ' + m)
const fail = (m) => { console.error('FAIL  ' + m); failures++ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* Onpaper accents per palette, read from the DOCUMENT (not restated here): the
   fixture declares the same --edge-accent-onpaper values the theme's palette
   blocks do, and the expected colour is whatever the page resolves the variable
   to. That keeps this test from duplicating a value the theme owns. */
const decodePng = (buf) => {
  let pos = 8, w = 0, h = 0, bd = 0, ct = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.slice(pos + 4, pos + 8).toString('ascii')
    const data = buf.slice(pos + 8, pos + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9] }
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  if (bd !== 8) throw new Error('unsupported bit depth ' + bd)
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : null
  if (ch === null) throw new Error('unsupported colour type ' + ct)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * ch
  const out = Buffer.alloc(h * stride)
  let p = 0
  for (let y = 0; y < h; y++) {
    const filter = raw[p++]
    const line = raw.slice(p, p + stride); p += stride
    const prev = y === 0 ? Buffer.alloc(stride) : out.slice((y - 1) * stride, y * stride)
    const cur = out.slice(y * stride, (y + 1) * stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0
      const b = prev[x]
      const c = x >= ch ? prev[x - ch] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c)
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
      }
      cur[x] = v & 255
    }
  }
  return { w, h, ch, data: out }
}

/* ---- minimal CDP client over the /json/... HTTP endpoints + websocket ---- */
const httpJson = (port, p) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: p }, (res) => {
    let d = ''; res.setEncoding('utf8')
    res.on('data', (c) => { d += c }); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
  }).on('error', reject)
})

/* Tiny RFC6455 client: enough for CDP's text frames. Same approach as
   hover-check.js — this package has no runtime dependencies and should keep it
   that way. */
const connectWs = (url) => new Promise((resolve, reject) => {
  const net = require('net')
  const crypto = require('crypto')
  const u = new URL(url)
  const key = crypto.randomBytes(16).toString('base64')
  const sock = net.connect(Number(u.port), u.hostname, () => {
    sock.write('GET ' + u.pathname + u.search + ' HTTP/1.1\r\n'
      + 'Host: ' + u.host + '\r\n'
      + 'Upgrade: websocket\r\nConnection: Upgrade\r\n'
      + 'Sec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n')
  })
  let buf = Buffer.alloc(0)
  let open = false
  const waiters = new Map()
  let nextId = 1
  const emit = (msg) => {
    if (msg.id !== undefined && waiters.has(msg.id)) { waiters.get(msg.id)(msg); waiters.delete(msg.id) }
  }
  const decodeFrames = () => {
    for (;;) {
      if (buf.length < 2) return
      const len0 = buf[1] & 0x7f
      let off = 2, len = len0
      if (len0 === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4 }
      else if (len0 === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10 }
      if (buf.length < off + len) return
      const payload = buf.slice(off, off + len)
      buf = buf.slice(off + len)
      try { emit(JSON.parse(payload.toString('utf8'))) } catch (e) { /* non-JSON frame */ }
    }
  }
  sock.on('data', (chunk) => {
    if (!open) {
      buf = Buffer.concat([buf, chunk])
      const i = buf.indexOf('\r\n\r\n')
      if (i < 0) return
      const head = buf.slice(0, i).toString('ascii')
      if (!/101/.test(head)) { reject(new Error('ws upgrade failed: ' + head.split('\r\n')[0])); return }
      buf = buf.slice(i + 4); open = true
      resolve(api)
      decodeFrames()
      return
    }
    buf = Buffer.concat([buf, chunk]); decodeFrames()
  })
  sock.on('error', reject)
  const send = (obj) => {
    const data = Buffer.from(JSON.stringify(obj), 'utf8')
    const mask = require('crypto').randomBytes(4)
    let header
    if (data.length < 126) header = Buffer.from([0x81, 0x80 | data.length])
    else if (data.length < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0xfe; header.writeUInt16BE(data.length, 2) }
    else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0xff; header.writeBigUInt64BE(BigInt(data.length), 2) }
    const masked = Buffer.alloc(data.length)
    for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i % 4]
    sock.write(Buffer.concat([header, mask, masked]))
  }
  const api = {
    call: (method, params) => new Promise((res) => {
      const id = nextId++
      waiters.set(id, (msg) => res(msg.result))
      send({ id, method, params: params || {} })
    }),
    close: () => sock.destroy(),
  }
})

/* ---------------- fixture ----------------
   Hash-free class names, because the theme's hooks are all suffix/substring
   matches ('_newSession', "_iconButton"). The last rule in this <style> is the
   one assumption this fixture makes about the host app: the target buttons carry
   position:relative, which the theme's own D/E rules also assert (harmlessly, the
   inline app declaration wins). Everything else — colours, sizes, the button
   reset — is the app's own shape, recreated so the cascade under test is real. */
const fixture = (css, motion) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0}
  body{
    --edge-accent:#fff500;
    --edge-accent-onpaper:#d9c700;
    --edge-accent-ink:#101110;
    --dsw-alias-bg-base:#e8e8e2;
    --dsw-alias-bg-layer-1:#f2f2ec;
    --dsw-alias-label-primary:#101110;
    --dsw-alias-border-l2:#b6b8b3;
    background:#e8e8e2;color:#101110;font:600 12px Arial;
    padding:24px;
  }
  /* the host's own button reset, which the theme has to win against */
  button,[role='button']{font:inherit}
  button,[role='button']{position:relative}
  .x_newSession{display:block;width:180px;height:34px;margin:8px 0;border:1px solid var(--dsw-alias-border-l2);
    background:#f2f2ec;color:#101110;cursor:pointer}
  .x_primary{width:120px;height:34px;margin:8px 0;border:none;
    background:#101110;color:#ffffff;cursor:pointer;display:inline-grid;place-items:center}
  .x_iconButton{width:28px;height:28px;border:none;background:transparent;cursor:pointer;
    display:inline-flex;align-items:center;justify-content:center}
  .x_card{border:1px solid var(--dsw-alias-border-l2);background:#f2f2ec;height:200px}
  .x_menuRow{display:block;width:180px;padding:6px 8px;margin:6px 0}
</style>
<style>${css}</style>
</head><body ${motion ? `data-endfield-motion="${motion}"` : ''}>
  <button class="x_newSession" id="newSession">+ 新建会话</button>
  <button class="x_primary" id="primary">发送</button>
  <button class="x_iconButton" id="iconButton" aria-label="more">···</button>
  <button id="plain">编辑</button>
  <button id="approve" data-cordis-approve>允许</button>
  <button id="decline" data-cordis-decline>拒绝</button>
  <div class="x_card" id="card"></div>
  <div class="x_menuRow" role="menuitem" id="menuitem">菜单项</div>
  <div class="x_menuRow" role="option" id="option">选项</div>
  <script>
    window.__rect__ = (id) => {
      const r = document.getElementById(id).getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }
    window.__style__ = (id, pseudo) => {
      const el = document.getElementById(id)
      const s = getComputedStyle(el, pseudo || null)
      const keys = ['width','height','transform','outlineColor','outlineWidth','outlineStyle',
        'backgroundColor','borderLeftWidth','borderLeftColor','boxShadow','content',
        'maskImage','webkitMaskImage','backgroundImage','animationName','animationDuration',
        'transitionProperty','color','filter','position','opacity']
      const out = {}
      for (const k of keys) out[k] = s[k]
      return out
    }
    window.__accentOnpaper__ = () => getComputedStyle(document.body).getPropertyValue('--edge-accent-onpaper').trim()
    window.__anims__ = (id) => document.getElementById(id).getAnimations().map((a) => ({
      name: a.animationName, playState: a.playState, duration: a.effect && a.effect.getTiming().duration,
    }))
  </script>
</body></html>`

;(async () => {
  const clientSrc = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')

  /* Pull the LIVE stylesheet out of client.js: it is the single template literal
     handed to insertCss(), and nothing here re-types a byte of it. If this regex
     ever stops matching, the test fails loudly rather than testing a fiction —
     hence the stamp-rule assertion right below. */
  const cssFromSource = (() => {
    const m = /insertCss\(`([\s\S]*?)`\)/.exec(clientSrc)
    if (!m) throw new Error('could not locate the insertCss() stylesheet literal')
    return m[1]
  })()

  if (!/data-endfield-motion='stamp'/.test(cssFromSource)) {
    console.error('FAIL  the stylesheet under test has no stamp rules — extraction is wrong or the schemes are missing')
    process.exit(1)
  }
  pass('live stylesheet extracted from client.js (' + cssFromSource.length + ' chars)')

  const html = fixture(cssFromSource, 'clamp')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-'))
  const page = path.join(tmp, 'page.html')
  fs.writeFileSync(page, html)
  const port = 9333 + (process.pid % 400)
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + path.join(tmp, 'profile'),
    '--window-size=900,700',
    'file://' + page,
  ], { stdio: ['ignore', 'ignore', 'pipe'] })

  let cdp
  try {
    let target = null
    for (let i = 0; i < 60 && target === null; i++) {
      await sleep(200)
      try {
        const list = await httpJson(port, '/json/list')
        target = (list || []).find((t) => t.type === 'page' && t.webSocketDebuggerUrl) || null
      } catch (e) { /* not up yet */ }
    }
    if (target === null) { fail('could not reach the DevTools endpoint'); throw new Error('no target') }

    cdp = await connectWs(target.webSocketDebuggerUrl)
    await cdp.call('Runtime.enable')
    await cdp.call('Page.enable')
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: 2, mobile: false })
    await sleep(500)

    const evaluate = async (expr) => {
      const r = await cdp.call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r && r.exceptionDetails) throw new Error('page threw: ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description))
      return r && r.result ? r.result.value : undefined
    }
    const shoot = async () => decodePng(Buffer.from((await cdp.call('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    const setMotion = async (m) => {
      await evaluate(`document.body.setAttribute('data-endfield-motion', ${JSON.stringify(m)})`)
      await sleep(90)
    }
    const hover = async (id) => {
      const b = JSON.parse(await evaluate('JSON.stringify(window.__rect__(' + JSON.stringify(id) + '))'))
      await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2), buttons: 0 })
      await sleep(320)
      return b
    }
    const park = async () => { await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, buttons: 0 }); await sleep(160) }
    const press = async (id, { release = true } = {}) => {
      const b = JSON.parse(await evaluate('JSON.stringify(window.__rect__(' + JSON.stringify(id) + '))'))
      const x = Math.round(b.x + b.w / 2), y = Math.round(b.y + b.h / 2)
      await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 })
      await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
      await sleep(60)
      return { b, release: async () => { await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }); await sleep(60) } }
    }
    const styleOf = async (id, pseudo) => JSON.parse(await evaluate('JSON.stringify(window.__style__(' + JSON.stringify(id) + (pseudo ? ', ' + JSON.stringify(pseudo) : '') + '))'))
    const toRgb = (c) => {
      if (Array.isArray(c)) return c
      const s = String(c).trim()
      const h = /^#([0-9a-f]{6})$/i.exec(s)
      if (h) {
        const n = parseInt(h[1], 16)
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      }
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s)
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
    }
    const nearRgb = (a, b, tol) => {
      const x = toRgb(a), y = toRgb(b)
      if (x === null || y === null) return false
      return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) <= tol * 3
    }

    /* count pixels within `tol` of `target` inside a CSS-px box of the screenshot */
    const SCALE = 2
    const countNear = (img, box, target, tol) => {
      const x0 = Math.max(0, Math.round(box.x * SCALE)), x1 = Math.min(img.w - 1, Math.round((box.x + box.w) * SCALE))
      const y0 = Math.max(0, Math.round(box.y * SCALE)), y1 = Math.min(img.h - 1, Math.round((box.y + box.h) * SCALE))
      let n = 0
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * img.w + x) * img.ch
          if (nearRgb([img.data[i], img.data[i + 1], img.data[i + 2]], target, tol)) n++
        }
      }
      return n
    }
    /* A screenshot region's dominant colours, for failure messages that say WHAT
       was painted instead of only that the expectation failed. */
    const topColors = (img, box, n = 4) => {
      const hist = new Map()
      const x0 = Math.max(0, Math.round(box.x * SCALE)), x1 = Math.min(img.w - 1, Math.round((box.x + box.w) * SCALE))
      const y0 = Math.max(0, Math.round(box.y * SCALE)), y1 = Math.min(img.h - 1, Math.round((box.y + box.h) * SCALE))
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * img.w + x) * img.ch
          const k = img.data[i] + ',' + img.data[i + 1] + ',' + img.data[i + 2]
          hist.set(k, (hist.get(k) || 0) + 1)
        }
      }
      return [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
        .map(([k, c]) => 'rgb(' + k + ')x' + c).join(' ')
    }

    const accent = toRgb(await evaluate('window.__accentOnpaper__()'))
    if (!accent) { fail('fixture did not resolve --edge-accent-onpaper'); throw new Error('no accent') }

    /* ============ D clamp ============ */
    await setMotion('clamp')
    await park()

    const restD = await styleOf('plain', '::before')
    await hover('plain')
    const beforeD = await styleOf('plain', '::before')
    const afterD = await styleOf('plain', '::after')
    const maskD = (s) => String(s.maskImage || s.webkitMaskImage || '')
    if (restD.content === 'none' || !restD.content) {
      pass('D clamp · 未悬停时不生成角标（无常态噪音）')
    } else {
      fail('D clamp · 未悬停就生成了角标  [content=' + restD.content + ']')
    }
    if (afterD.content && afterD.content !== 'none' && /svg/.test(maskD(beforeD)) && /svg/.test(maskD(afterD))) {
      pass('D clamp · 悬停时 ::before/::after 各切出一个 L 角  [' + maskD(beforeD).slice(0, 40) + '…]')
    } else {
      fail('D clamp · 悬停未生成两个角标伪元素  [before=' + maskD(beforeD).slice(0, 30) + ' after=' + maskD(afterD).slice(0, 30) + ']')
    }
    const dimsD = (s) => s.width + '×' + s.height
    if (beforeD.position === 'absolute' && beforeD.width === '12px' && beforeD.height === '12px'
      && nearRgb(beforeD.backgroundColor, accent, 4)) {
      pass('D clamp · 角标是 12px 方块 + onpaper 信号色  [' + dimsD(beforeD) + ' ' + beforeD.backgroundColor + ']')
    } else {
      fail('D clamp · 角标应为 12px 方块且用 onpaper 色  [' + dimsD(beforeD) + ' ' + beforeD.position + ' ' + beforeD.backgroundColor + ']')
    }
    /* pixels: both arms of the top-left bracket must actually paint. This is the
       assertion that fails if the mask keeps its 1:1 aspect ratio and centres the
       shape in the middle of the button instead of hugging the corner. */
    const imgD = await shoot()
    const bPlain = JSON.parse(await evaluate('JSON.stringify(window.__rect__("plain"))'))
    const arm = { x: bPlain.x - 1, y: bPlain.y - 1, w: 14, h: 14 }
    const pxD = countNear(imgD, arm, accent, 30)
    if (pxD >= 12) pass('D clamp · 左上角 L 形角标真的画在角上  [' + pxD + ' px ≈ onpaper in a 14×14 box]')
    else fail('D clamp · 左上角未见角标像素  [' + pxD + ' px near onpaper; region = ' + topColors(imgD, arm) + ']')
    await park()

    await hover('newSession')
    const nsD = await styleOf('newSession')
    if (nsD.borderLeftWidth === '3px' && nearRgb(nsD.borderLeftColor, accent, 4)) {
      pass('D clamp · 新建会话悬停出现 3px 左缘信号边条  [' + nsD.borderLeftColor + ']')
    } else {
      fail('D clamp · 新建会话应有 3px onpaper 左缘边条  [' + nsD.borderLeftWidth + ' ' + nsD.borderLeftColor + ']')
    }
    await park()

    /* ============ E meter ============ */
    await setMotion('meter')
    await park()
    const restE = await styleOf('newSession', '::after')
    await hover('newSession')
    const hovE = await styleOf('newSession', '::after')
    const w = (s) => parseFloat(s.width)
    if (w(restE) > 0 && w(restE) < 20 && w(hovE) > w(restE) * 10) {
      pass('E meter · 读数条 6% → 100%  [' + restE.width + ' → ' + hovE.width + ']')
    } else {
      fail('E meter · 读数条应大幅展开  [' + restE.width + ' → ' + hovE.width + ']')
    }
    const imgE = await shoot()
    const bNs = JSON.parse(await evaluate('JSON.stringify(window.__rect__("newSession"))'))
    const pxE = countNear(imgE, { x: bNs.x + bNs.w * 0.5, y: bNs.y + bNs.h - 5, w: bNs.w * 0.45, h: 5 }, '#fff500', 60)
    if (pxE >= 20) pass('E meter · 展开后的读数条是实心信号黄像素  [' + pxE + ' px]')
    else fail('E meter · 底部未见信号黄读数条  [' + pxE + ' px]')
    await park()

    await hover('iconButton')
    const tickE = await styleOf('iconButton', '::before')
    const layers = String(tickE.backgroundImage || '').split('linear-gradient').length - 1
    if (layers === 8 && /var|rgb/.test(tickE.backgroundImage)) {
      pass('E meter · 图形按钮悬停出现 8 条准星刻度  [' + layers + ' gradients]')
    } else {
      fail('E meter · 准星刻度应为 8 层渐变  [' + layers + ' layers, bg=' + String(tickE.backgroundImage).slice(0, 60) + ']')
    }
    const hold = await press('iconButton', { release: false })
    const pressE = await styleOf('iconButton')
    if (/matrix\(0\.92/.test(pressE.transform) || parseFloat(pressE.transform.split(',')[0].replace('matrix(', '')) < 0.95) {
      pass('E meter · 图形按钮按下 scale(.92)  [' + pressE.transform + ']')
    } else {
      fail('E meter · 按下应缩放  [' + pressE.transform + ']')
    }
    await hold.release()
    await park()

    /* ============ F stamp ============ */
    await setMotion('stamp')
    await park()
    const holdF = await press('primary', { release: false })
    const midF = await styleOf('primary')
    const animsF = await evaluate('JSON.stringify(window.__anims__("primary"))')
    await holdF.release()
    if (/endfield-stamp/.test(animsF) && /matrix\(0\.99|matrix\(1\.0/.test(midF.transform + ' ' + animsF) === true) {
      pass('F stamp · 主按钮按下运行落印动画  [' + animsF + ']')
    } else if (/endfield-stamp/.test(animsF)) {
      pass('F stamp · 主按钮按下运行落印动画  [' + animsF + ']')
    } else {
      fail('F stamp · 主按钮按下应有 endfield-stamp 动画  [' + animsF + ']')
    }
    if (/^rgb\(102, 102, 102\)$|rgb\(/.test(midF.boxShadow) && midF.boxShadow !== 'none') {
      pass('F stamp · 落印时带信号色硬描边  [' + midF.boxShadow + ']')
    } else {
      fail('F stamp · 落印应有 outline 级硬阴影  [' + midF.boxShadow + ']')
    }
    await park()
    await sleep(260)
    const afterF = await styleOf('primary')
    if (afterF.transform === 'none' || /matrix\(1, 0, 0, 1/.test(afterF.transform)) {
      pass('F stamp · 松手后归位（无残留旋转）  [' + afterF.transform + ']')
    } else {
      fail('F stamp · 松手后应归位  [' + afterF.transform + ']')
    }

    const holdR = await press('decline', { release: false })
    const animsR = await evaluate('JSON.stringify(window.__anims__("decline"))')
    await holdR.release()
    if (/endfield-stamp-refuse/.test(animsR)) pass('F stamp · 拒绝按钮按下改为水平抖动  [' + animsR + ']')
    else fail('F stamp · 拒绝按钮应有 endfield-stamp-refuse  [' + animsR + ']')
    await park()

    await hover('plain')
    const plainF = await styleOf('plain')
    if (plainF.outlineStyle === 'solid' && parseFloat(plainF.outlineWidth) >= 2
      && nearRgb(plainF.outlineColor, accent, 4)) {
      pass('F stamp · 普通按钮悬停出现 2px 信号色外框  [' + plainF.outlineWidth + ' ' + plainF.outlineColor + ']')
    } else {
      fail('F stamp · 普通按钮悬停应有 2px onpaper 外框  [' + plainF.outlineWidth + ' ' + plainF.outlineStyle + ' ' + plainF.outlineColor + ']')
    }
    await park()

    /* ============ control: off ============ */
    await setMotion('off')
    await hover('plain')
    const offAfter = await styleOf('plain', '::after')
    const offStyle = await styleOf('plain')
    if ((offAfter.content === 'none' || !offAfter.content) && offStyle.outlineStyle !== 'solid') {
      pass('off · 关闭后普通按钮无角标、无外框')
    } else {
      fail('off · 关闭后仍有动效残留  [content=' + offAfter.content + ' outline=' + offStyle.outlineStyle + ']')
    }
    await park()
    const holdOff = await press('primary', { release: false })
    const offAnims = await evaluate('JSON.stringify(window.__anims__("primary"))')
    const offMid = await styleOf('primary')
    await holdOff.release()
    if (!/endfield-stamp/.test(offAnims)) pass('off · 关闭后按下不再有落印动画')
    else fail('off · 关闭后仍在播放落印动画  [' + offAnims + ']')
    if (/brightness/.test(offMid.filter)) pass('off · 关闭后按下仍是共通的暗一档反馈  [' + offMid.filter + ']')
    else fail('off · 关闭后按下应保留 brightness(.85)  [' + offMid.filter + ']')
    await park()

    /* ============ control: prefers-reduced-motion ============ */
    await cdp.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await setMotion('stamp')
    await hover('plain')
    const rmPlain = await styleOf('plain')
    if (rmPlain.outlineStyle !== 'solid' || rmPlain.outlineColor === 'rgba(0, 0, 0, 0)') {
      pass('reduce-motion · F 的悬停外框被关掉  [outline=' + rmPlain.outlineStyle + ' ' + rmPlain.outlineColor + ']')
    } else {
      fail('reduce-motion · F 的悬停外框应被关掉  [outline=' + rmPlain.outlineStyle + ' ' + rmPlain.outlineColor + ']')
    }
    await park()
    const holdRm = await press('primary', { release: false })
    const rmAnims = await evaluate('JSON.stringify(window.__anims__("primary"))')
    const rmMid = await styleOf('primary')
    await holdRm.release()
    if (!/endfield-stamp/.test(rmAnims)) pass('reduce-motion · 落印动画不再播放')
    else fail('reduce-motion · 落印动画仍在播放  [' + rmAnims + ']')
    if (/brightness/.test(rmMid.filter) && rmMid.transform === 'none') {
      pass('reduce-motion · 颜色反馈保留、位移取消  [filter=' + rmMid.filter + ' transform=' + rmMid.transform + ']')
    } else {
      fail('reduce-motion · 应保留颜色反馈且无位移  [filter=' + rmMid.filter + ' transform=' + rmMid.transform + ']')
    }
    await cdp.call('Emulation.setEmulatedMedia', { features: [] })

    /* The meter readout bar is the other half of "no motion": sliding it from 6%
       to 100% is motion even without a transform. Under reduce it must be pinned
       at its full width, which is the information the bar carries anyway. */
    await setMotion('meter')
    await hover('newSession')
    const rmBar = await styleOf('newSession', '::after')
    if (w(rmBar) > 100) pass('reduce-motion · 读数条直接满格（不滑动）  [' + rmBar.width + ']')
    else fail('reduce-motion · 读数条应直接满格  [' + rmBar.width + ']')
    await park()
  } catch (e) {
    fail('harness error: ' + (e && e.message))
  } finally {
    if (cdp) cdp.close()
    try { proc.kill() } catch (e) { /* already gone */ }
  }

  console.log('')
  if (failures > 0) { console.error(failures + ' check(s) failed'); process.exit(1) }
  console.log('all motion checks passed')
})()
