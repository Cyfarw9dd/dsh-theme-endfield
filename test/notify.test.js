/**
 * notify.test.js — the industrial notification module, driven through the
 * REAL client.js in a headless browser.
 *
 * What is proven here, from pixels and DOM rather than from source strings:
 *   1. a question dialog appearing mounts a STICKY [data-endfield-notify] card
 *      with the right kind, head copy and dismiss button;
 *   2. answering it (the dialog leaving the DOM) clears the card automatically;
 *   3. the notify switches are honoured live: master off clears and silences,
 *      the per-kind switch gates its own card;
 *   4. the done receipt auto-dismisses after its hold time.
 *
 * The attention path is driven through the page's own poll (the same channel
 * the live app uses); the done path is driven through the exported test hook
 * because its real trigger needs a sessions service.
 *
 * Usage: CHROME_PATH=<chrome> node test/notify.test.js
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')
const { BROWSER_SETTINGS_SCOPE_SNIPPET } = require(path.join(__dirname, 'fixtures', 'settings-scope.browser.js'))

const ROOT = path.resolve(__dirname, '..')
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'endfield-notify-'))
const chrome = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86\\)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find((p) => fs.existsSync(p))
if (!chrome) { console.error('FAIL  no Chrome/Edge found (set CHROME_PATH)'); process.exit(1) }

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body,#root{height:100%;margin:0}
  :root{--dsw-alias-bg-base:#e8e8e2;--dsw-alias-bg-layer-1:#f2f2ec;
    --dsw-alias-label-primary:#101110;--dsw-alias-label-secondary:#4a4c48;
    --dsw-alias-border-l2:#b6b8b3;--dsw-font-family:Arial,sans-serif}
  body{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
</style></head><body><div id="root"><div class="pI_x6G_frame"><div class="pI_x6G_centerCol"></div></div></div>
<script>window.__ModuleLoader__={load:(m)=>{window.__MOD__=m}}</script>
<script src="./client.js"></script>
<script>
  ${BROWSER_SETTINGS_SCOPE_SNIPPET}
  var __prefs=__endfieldSettingsScope({ enabled:'1', notify:'1', notifyDone:'1', notifyQuestion:'1', notifyApprove:'1', watermark:'0', loader:'0', thunder:'0', audioEnabled:'0' })
  /* Fake sessions service so the DONE trigger runs through its REAL path: the
     theme binds to the current session and fires on ConversationSnapshot.running
     EDGES, exactly as it does against the live runtime. */
  var sessSnap={running:false}; var sessNotify=function(){}
  var sess={
    list:{ subscribe:function(){return function(){}}, getSnapshot:function(){return {current:'s1'} } },
    binding:function(id){ return { session:{
      subscribe:function(fn){ sessNotify=fn; return function(){} },
      getSnapshot:function(){return sessSnap},
    } } },
  }
  const mod=window.__MOD__.factory(()=>null)
  window.__dispose__=mod.apply({
    get:(n)=>n==='theme'?{overrideTokens:()=>()=>{}}:(n==='settingsScope'?__prefs.binder:(n==='sessions'?sess:undefined)),
    effect:(f)=>f(),
  })
  document.body.appendChild(document.createElement('span'))
  const sleep=(ms)=>new Promise((r)=>setTimeout(r,ms))
  ;(async()=>{
    const q=[];const R=(name,pass,detail)=>q.push({name,pass:!!pass,detail:detail===undefined?'':String(detail)})
    const card=(kind)=>document.querySelector('[data-endfield-notify-kind="'+kind+'"]')
    const stack=()=>document.querySelector('[data-endfield-notify-stack]')
    // The watcher polls at 1000ms; wait past two periods for each phase.
    await sleep(1400)
    R('no card while nothing is pending', card('question')===null)
    // 1. question appears -> sticky card
    const dlg=document.createElement('div'); dlg.setAttribute('data-question-key','q1')
    document.body.appendChild(dlg)
    await sleep(1400)
    const qc=card('question')
    R('question card mounted', qc!==null)
    R('question head copy', qc!==null && qc.textContent.includes('等待回答'), qc && qc.textContent.slice(0,40))
    R('question card is sticky (has dismiss)', qc!==null && qc.querySelector('[data-endfield-notify-close]')!==null)
    R('role=alert on attention kinds', qc!==null && qc.getAttribute('role')==='alert')
    await sleep(1200)
    R('sticky card stays while unanswered', card('question')!==null)
    // 2. answered -> auto-clear
    dlg.remove()
    await sleep(1400)
    R('card clears when the dialog resolves', card('question')===null)
    // 3. per-kind switch: questions off, approvals on
    __prefs.setItem('dsh-theme-endfield-notify-question','0')
    document.body.appendChild(dlg)
    const app=document.createElement('div'); app.setAttribute('data-approval-key','a1')
    document.body.appendChild(app)
    await sleep(1500)
    R('question card suppressed by its switch', card('question')===null)
    const ac=card('approval')
    R('approval card mounted', ac!==null)
    R('approval head copy', ac!==null && ac.textContent.includes('需要授权'), ac && ac.textContent.slice(0,40))
    // dismiss button clears it while the dialog is still open
    ac.querySelector('[data-endfield-notify-close]').click()
    R('dismiss button clears the card', card('approval')===null)
    dlg.remove(); app.remove()
    // 4. master off tears the stack down
    __prefs.setItem('dsh-theme-endfield-notify','0')
    await sleep(300)
    R('master off removes the stack host', stack()===null || stack().children.length===0)
    // 5. done receipt through the REAL trigger: a running edge on the session
    __prefs.setItem('dsh-theme-endfield-notify','1')
    await sleep(200)
    sessSnap={running:true};  sessNotify()   // baseline: first readable value
    sessSnap={running:false}; sessNotify()   // falling edge -> 任务完成
    const dc=card('done')
    R('done card mounted via the running edge', dc!==null)
    R('done card has no dismiss (receipt)', dc!==null && dc.querySelector('[data-endfield-notify-close]')===null)
    R('role=status on the receipt', dc!==null && dc.getAttribute('role')==='status')
    await sleep(6600)
    R('done card auto-dismissed after its hold', card('done')===null)
    document.title='NOTIFY '+JSON.stringify(q)
  })()
</script></body></html>`

fs.copyFileSync(path.join(ROOT, 'client.js'), path.join(OUT, 'client.js'))
const page = path.join(OUT, 'notify.html')
fs.writeFileSync(page, HTML)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'notify-prof-'))
let dom = ''
try {
  dom = execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--virtual-time-budget=26000', '--window-size=1024,700',
    '--user-data-dir=' + tmp, '--dump-dom',
    'file:///' + page.replace(/\\/g, '/'),
  ], { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'ignore'] })
} catch (e) { console.error('FAIL  browser run failed: ' + e.message); process.exit(1) }
const m = dom.match(/<title>NOTIFY (.*?)<\/title>/s)
if (!m) { console.error('FAIL  notify page did not report results'); process.exit(1) }
const results = JSON.parse(m[1].replace(/&quot;/g, '"'))
let failures = 0
for (const r of results) {
  if (r.pass) console.log('ok    ' + r.name + (r.detail ? '  [' + r.detail + ']' : ''))
  else { console.error('FAIL  ' + r.name + (r.detail ? '  [' + r.detail + ']' : '')); failures++ }
}
if (failures) { console.error(failures + ' notify check(s) failed'); process.exit(1) }
console.log('all notify checks passed')
