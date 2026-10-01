/**
 * dsh-theme-endfield — Edge Intelligence Theme (browser client bundle)
 * 还原自《明日方舟：终末地》（Arknights: Endfield）官网的「工业编辑风」。
 * 参考：https://endfield.hypergryph.com
 *
 * Client 半部：
 *   1) theme.overrideTokens —— 覆盖主题令牌（亮/暗双色），映射终末地官网色板；
 *   2) insertCss —— 注入字体栈、强调色、直角化、去蓝、hover 反色等全局样式。
 *      （动态插件环境走 styles.insert；安装为独立 bundle 时直接注入 <style> 到 head。）
 *   3) 设置页「终末地主题设置」—— 设置项按四组分类（主题 / 背景 / 动画 / 娱乐），
 *      默认值 / 语义标记通过 DSH 的设置命名空间随 profile 落盘。DSH 0.1.7-rc.1 起
 *      走 client `ctx.configForms`（host index.js 导出的 volatile `Config`，命名空间
 *      = profile entry id `theme-endfield`）；旧版 DSH 回落到 `ctx.settingsScope`
 *      （host 的 `ctx.settings.register('dsh-theme-endfield', …)`）。文案跟随 DSH
 *      的语言设置。不再使用 localStorage：见本文 apply() 顶部
 *      「Durable preference store」注释。
 *
 * 文档：README.md 为索引；设计语言见 docs/design-language.md，
 * 各开关行为见 docs/features.md，实现决策与实测数据见 docs/engineering-notes.md。
 *
 * 由 dsh-client-modules 以 /plugins/theme-endfield/client.js 形式加载；
 * 通过 `dsh plugin --profile web add github:ymh0000123/dsh-theme-endfield` 安装挂载。
 */
window.__ModuleLoader__.load({
	id: "dsh-theme-endfield",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

function insertCss(css) {
  // Dynamic Cordis runner provides the `styles` global; standalone bundle does not.
  if (typeof styles !== 'undefined' && styles && typeof styles.insert === 'function') {
    return styles.insert(css)
  }
  // Idempotency: the installed bundle can be applied more than once (boot loader +
  // cordis composition both mount it). Never stack duplicate theme stylesheets.
  document.querySelectorAll('style[data-plugin="dsh-theme-endfield"]').forEach((old) => old.remove())
  const el = document.createElement('style')
  el.setAttribute('data-plugin', 'dsh-theme-endfield')
  el.textContent = css
  document.head.appendChild(el)
  return () => {
    if (el.parentNode) el.parentNode.removeChild(el)
  }
}

function apply(ctx) {    // Idempotency: the installed bundle can be applied more than once (boot loader +
    // cordis composition both mount it). Only the first application owns tokens/styles;
    // duplicate overrideTokens would replace the layer and break the toggle's dispose.
    // The flag is RELEASED by the run's dispose (see the ctx.effect cleanup below), so
    // a dispose followed by a re-apply in the same page session mounts the theme again
    // instead of staying dead until a hard reload.
    if (typeof window !== 'undefined' && window.__dshThemeEndfieldApplied) return
    // Claim the flag only once the theme service is actually there: a boot order where
    // it is still missing must not lock the flag in place and kill every later apply.
    const theme = ctx.get('theme')
    if (theme === undefined) return
    if (typeof window !== 'undefined') window.__dshThemeEndfieldApplied = true

    /* ---------- Durable preference store (replaces localStorage) ----------
       The theme's switches used to persist through `localStorage`, which DSH
       Desktop broke on every restart: Desktop binds a fresh random localhost
       port per launch, so the origin (and thus the browser storage scope)
       changed and the saved settings silently reset to defaults.

       The durable authority is DSH's own settings service, and DSH 0.1.7-rc.1
       moved it once more. The whole pre-0.1.7 seam — a host
       `ctx.settings.register(namespace, schema)` persisted by
       `@deepseek-ai/dsh-settings-file` to `<dshHome>/settings.yaml`, mirrored
       to the browser as the `ctx.settingsScope` service — is GONE: the package
       is not in the distribution any more, `settings.yaml` is not the settings
       carrier, and the client has no `settingsScope` service at all.

       What replaced it (see index.js for the host side):

         host    the plugin entry exports a schemastery `Config` whose fields
                 are `.volatile()`. `ctx.settings` projects it into a form and
                 persists user edits into the PROFILE PATCH
                 (<profile>/cordis.patch.yml) through `ctx.configEditor`,
                 i.e. a path owned by DSH and independent of the web origin.
         client  `ctx.get('configForms')` — the settings domain's shared-form
                 service — `.get(<profile entry id>)` returns that entry's
                 ConfigForm: getSnapshot() / subscribe() / set() / unset() /
                 mutate().

       The namespace is now the PROFILE ENTRY ID, not a plugin-chosen string:
       this package's cordis.patch.yml inserts `id: theme-endfield`, and
       index.js exports that same id as SETTINGS_ENTRY. Both halves still speak
       the old namespace string for the legacy fallback and as the prefix of
       every UI key in the tables below.

       Older hosts (<= 0.1.5-rc.2) keep the old seam, which this file still
       binds when no `configForms` service exists — see the transport-selection
       note further down. Either way the values live host-side, so:

         dsh web     (browser, fixed loopback port)  -> host persistence
         DSH Desktop (browser, random loopback port) -> host persistence

       Both are loopback pages, so DSH resolves the connection to 'host' mode
       and the values land on disk; a change of port does not move them because
       nothing lives in browser storage any more.

       Value model. Namespace fields are the tails of the old localStorage keys
       and are stored as the same strings, so the semantics (and any older
       <settings.yaml> section from a prior build) keep scanning identically:
         default-ON switches store  '1'  and read as  !== '0'
         default-OFF switches store '0'  and read as  === '1'
         palette/radius/fps/speed  store one of their documented literals.
       FIELD_DEFAULTS is the shipped fallback and mirrors index.js.

       Resilience. Before the transport hands us a section (boot), or in an
       environment with neither settings service at all (an out-of-DSH page,
       in-process tests), the store falls back to FIELD_DEFAULTS overlaid with
       any in-page overrides made this session. Writes are committed to the
       settings transport only when it is ready + writable; otherwise they are
       kept session-local so toggles still work in place but do not persist
       (there is no durable backend to persist to — and no localStorage). */
    /* DSH 0.1.7-rc.1 settings namespace: the profile entry id of this plugin's
       row (index.js SETTINGS_ENTRY, cordis.patch.yml `id: theme-endfield`).
       `configForms.get()` is keyed by exactly that string. */
    const PREFS_ENTRY = 'theme-endfield'
    /* Pre-0.1.7 namespace string. Still the prefix of every UI key in the
       tables below, and the namespace the legacy `settingsScope` bind asks
       for — so it stays even though the modern transport never uses it. */
    const PREFS_NS = 'dsh-theme-endfield'
    const PREFS_FIELD_DEFAULTS = {
      enabled: '1',
      palette: 'gray',
      radius: 'square',
      glass: 'off',
      texture: 'standard',
      motion: 'signal',
      watermark: '1',
      watermarkPersist: '0',
      loader: '0',
      thunder: '0',
      thunderAnim: '0',
      /* 通知模块：主开关 + 三触发（默认随主开关开启）。 */
      notify: '1',
      notifyDone: '1',
      notifyQuestion: '1',
      notifyApprove: '1',
      /* 音频通知 (host half: lib/audio.js). Two live slots — the prompt that
         starts a turn and the final answer that ends one. `audioAttention` and
         `audioTurnFail` are 预留: the sounds and switches ship, the triggers do
         not, and the settings rows say so.

         The MASTER switch ships OFF (opt-in), mirroring index.js FIELD_DEFAULTS
         and lib/audio.js FALLBACK: an install that upgrades into this feature
         must not start making noise by itself. The per-slot switches stay ON, so
         turning the master on is what starts the sound. */
      audioEnabled: '0',
      audioVolume: '100',
      audioBoot: '1',
      audioTurnStart: '1',
      audioTurnDone: '1',
      audioAttention: '1',
      audioTurnFail: '1',
      audioDebounceMs: '2500',
      audioSoundDir: '',
      audioHumanOnly: '1',
      audioDiag: '0',
    }
    /* Convert a namespaced storage key tail to the camelCase field the settings
       schema declares (index.js FIELD_DEFAULTS). A build that derived the field
       by stripping the namespace prefix instead left a compound name in its
       kebab-case spelling, so this conversion is also the read migration for any
       key the explicit table below does not list. */
    const prefsFieldFromKey = (rawKey) => {
      const prefix = PREFS_NS + '-'
      const tail = rawKey.indexOf(prefix) === 0 ? rawKey.slice(prefix.length) : rawKey
      return tail.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase())
    }
    /* Which schema field each UI/store key names. The left half is the key the
       theme's own code has always used (the localStorage-era name, which the
       settings rows, locales and tests all still speak); the right half is the
       field the HOST registered in its schema (index.js FIELD_DEFAULTS — the
       only names a scope.set can actually store).

       THEY ARE NOT THE SAME STRING for any compound field, and deriving one
       from the other by stripping the namespace prefix — the old
       `k.slice(PREFS_NS.length + 1)` — is the bug this table exists to kill: it
       turned 'dsh-theme-endfield-thunder-anim' into 'thunder-anim', while the
       schema declares 'thunderAnim'. Two fields were affected (thunderAnim,
       watermarkPersist): the write landed on an UNDECLARED key, schemastery
       kept it (it validates declared fields and passes extras through) but the
       declared field stayed at its default, so the switch worked for the page
       session, persisted junk into settings.yaml, and came back at its default
       on the next load. Hence "开关刷新后复位".

       Keys are therefore listed EXPLICITLY, never computed. */
    const PREFS_KEY_TO_FIELD = {
      'dsh-theme-endfield-enabled': 'enabled',
      'dsh-theme-endfield-palette': 'palette',
      'dsh-theme-endfield-radius': 'radius',
      'dsh-theme-endfield-glass': 'glass',
      'dsh-theme-endfield-texture': 'texture',
      'dsh-theme-endfield-motion': 'motion',
      'dsh-theme-endfield-watermark': 'watermark',
      'dsh-theme-endfield-watermark-persist': 'watermarkPersist',
      'dsh-theme-endfield-loader': 'loader',
      'dsh-theme-endfield-thunder': 'thunder',
      'dsh-theme-endfield-thunder-anim': 'thunderAnim',
      'dsh-theme-endfield-notify': 'notify',
      'dsh-theme-endfield-notify-done': 'notifyDone',
      'dsh-theme-endfield-notify-question': 'notifyQuestion',
      'dsh-theme-endfield-notify-approve': 'notifyApprove',
      /* 音频通知. These tails happen to equal their schema fields, so every one of
         them would also resolve correctly through the prefix-strip fallback — they
         are listed explicitly because test/settings-namespace.test.js asserts that
         EVERY declared host field has a mapping entry, and because "the mapping is
         the one place a UI key becomes a field" only holds if it is complete. */
      'dsh-theme-endfield-audio-enabled': 'audioEnabled',
      'dsh-theme-endfield-audio-volume': 'audioVolume',
      'dsh-theme-endfield-audio-boot': 'audioBoot',
      'dsh-theme-endfield-audio-turn-start': 'audioTurnStart',
      'dsh-theme-endfield-audio-turn-done': 'audioTurnDone',
      'dsh-theme-endfield-audio-attention': 'audioAttention',
      'dsh-theme-endfield-audio-turn-fail': 'audioTurnFail',
      'dsh-theme-endfield-audio-debounce-ms': 'audioDebounceMs',
      'dsh-theme-endfield-audio-sound-dir': 'audioSoundDir',
      'dsh-theme-endfield-audio-human-only': 'audioHumanOnly',
      'dsh-theme-endfield-audio-diag': 'audioDiag',
    }
    /* The pre-migration spelling of a compound field, for the sections that the
       buggy build already wrote: 'thunderAnim' -> 'thunder-anim'. Derived from
       the table (not from the schema, which cannot know it) so the two can never
       drift, and only for fields that really do have a distinct legacy double:
       every single-word field maps to itself and is skipped. */
    const PREFS_FIELD_TO_LEGACY_KEY = (() => {
      const m = {}
      for (const field of Object.keys(PREFS_KEY_TO_FIELD)) {
        const f = PREFS_KEY_TO_FIELD[field]
        const legacy = field.slice(PREFS_NS.length + 1)
        if (legacy !== f) m[f] = legacy
      }
      return m
    })()
    /* The single place a UI/store key turns into a schema field name: both the
       read path (prefsGet) and the write path (prefsSet/prefsCommit) go through
       it, so a switch can never read a field other than the one it writes. A key
       that is already a field name passes through, which is what the settings
       panel's own state and the tests use. */
    const prefsFieldOf = (rawKey) => {
      if (Object.prototype.hasOwnProperty.call(PREFS_KEY_TO_FIELD, rawKey)) return PREFS_KEY_TO_FIELD[rawKey]
      if (Object.prototype.hasOwnProperty.call(PREFS_FIELD_DEFAULTS, rawKey)) return rawKey
      /* Last resort: a key this table does not list. It is camelCased through
         prefsFieldFromKey rather than handed back as the raw tail, so a compound
         name reaching this path still lands on the camelCase field the host
         DECLARES instead of on an undeclared kebab key — which is precisely the
         failure mode the table above exists to prevent, and which a future
         compound row could otherwise reintroduce silently. */
      return prefsFieldFromKey(rawKey)
    }
    /* ---------- 音频通知 preferences (host half owns playback) ----------
       The browser's whole job here is switches, a volume number and the preview
       buttons; every sound is played by the host process, including the previews
       (that is the point: the preview must go through the same path as a real
       notification, or testing it proves nothing). The keys below pass through
       prefsFieldOf unchanged and equal the schema field names, so a switch can
       never write an undeclared field. */
    const AUDIO_ENABLED_KEY = 'audioEnabled'
    const AUDIO_BOOT_KEY = 'audioBoot'
    const AUDIO_TURN_START_KEY = 'audioTurnStart'
    const AUDIO_TURN_DONE_KEY = 'audioTurnDone'
    const AUDIO_VOLUME_KEY = 'audioVolume'
    const AUDIO_HUMAN_ONLY_KEY = 'audioHumanOnly'
    const AUDIO_DIAG_KEY = 'audioDiag'
    const AUDIO_SOUND_DIR_KEY = 'audioSoundDir'
    const AUDIO_STATE_URL = '/theme-endfield/audio/state'
    const AUDIO_PREVIEW_URL = '/theme-endfield/audio/preview'
    const AUDIO_ATTENTION_URL = '/theme-endfield/audio/attention'
    // Default ON for the master switch and both live slots; default OFF for the
    // diagnostics switch, so the host console stays quiet unless asked.
    const isAudioOn = () => prefsGet(AUDIO_ENABLED_KEY) !== '0'
    const isAudioBootOn = () => prefsGet(AUDIO_BOOT_KEY) !== '0'
    const isAudioStartOn = () => prefsGet(AUDIO_TURN_START_KEY) !== '0'
    const isAudioDoneOn = () => prefsGet(AUDIO_TURN_DONE_KEY) !== '0'
    const isAudioHumanOnly = () => prefsGet(AUDIO_HUMAN_ONLY_KEY) !== '0'
    const isAudioDiagOn = () => prefsGet(AUDIO_DIAG_KEY) === '1'
    const readAudioVolume = () => {
      const parsed = Number.parseInt(prefsGet(AUDIO_VOLUME_KEY), 10)
      return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 100
    }
    const readAudioSoundDir = () => prefsGet(AUDIO_SOUND_DIR_KEY) || ''
    /** Ask the host to play one slot through the real notification path. */
    const previewSlot = (slot) => {
      if (typeof fetch !== 'function') return Promise.resolve({ played: false, why: 'no fetch' })
      return fetch(AUDIO_PREVIEW_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slot }),
      }).then(
        (res) => res.json().catch(() => ({ played: false, why: 'bad response' })),
        (error) => ({ played: false, why: String(error && error.message ? error.message : error) }),
      )
    }
    /* ---------- 需要你回应：界面观察器 ----------
       WHY THIS EXISTS. The host-side seams that would normally carry this moment
       (`approval/request`, `user-questions/request`, raised by dsh-user-approval
       and dsh-tool-ask-user) do not fire in every deployment. Measured here: with
       the theme plugin mounted, a question was on screen and ANSWERED while the
       host half's counter stayed at 0 — because `ask_user_question` in this
       composition is provided outside the profile's plugin stack, so
       `dsh-tool-ask-user` never runs and the waterfall is never raised.

       The UI is therefore the only place where "a human must act" is always real.
       The host still owns the sound (switch, volume, debounce) — the page only
       reports that a confirmation box appeared. The host-side listeners stay in
       place for compositions where they DO fire; both paths end at the same slot
       and the host's debounce collapses a double report into one sound.

       ANCHORS: only the per-panel DATA ATTRIBUTES, never a class name.

       A class-based first attempt was tried and it mis-fired in the field:
       `[class*='_card']` matches 15 different components across the installed
       client packages (model selector, agent-preset picker, …) and
       `[class*='_frame']` matches 8, so opening any such card rang the attention
       sound while no confirmation box was on screen. What the panels actually
       expose, verified against the installed packages, is one stable attribute
       each:
         approval panel    <div data-approval-key="…">
         plan review panel <div data-plan-review-key="…">
         question dialog   <div data-question-key="…">

       A marker that disappears in a future UI release silences this feature
       without breaking anything — hence the counter in the settings page, which
       is the only way to notice that the anchors stopped matching. */
    const ATTENTION_MARKERS = [
      { kind: 'approval', selector: '[data-approval-key]' },
      { kind: 'plan-review', selector: '[data-plan-review-key]' },
      { kind: 'question', selector: '[data-question-key]' },
    ];
    // Exposed on the module so a test can assert the anchors stay semantic (see
    // exports.__attentionMarkers at the bottom of this file).
    module.exports.__attentionMarkers = ATTENTION_MARKERS;
    /** Which kind of pending interaction is on screen right now, if any. */
    const detectPendingInteraction = () => {
      if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null
      for (const marker of ATTENTION_MARKERS) {
        try {
          if (document.querySelector(marker.selector) !== null) return marker.kind
        } catch (e) { /* malformed selector: treat as absent */ }
      }
      return null
    }
    /** Tell the host a confirmation box appeared; it decides whether to sound. */
    const reportAttention = (kind) => {
      if (typeof fetch !== 'function') return Promise.resolve({ played: false, why: 'no fetch' })
      return fetch(AUDIO_ATTENTION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind }),
      }).then(
        (res) => res.json().catch(() => ({ played: false, why: 'bad response' })),
        (error) => ({ played: false, why: String(error && error.message ? error.message : error) }),
      )
    }
    const prefsListeners = []
    const prefsLocal = Object.assign({}, PREFS_FIELD_DEFAULTS) // schema defaults, for boot / no transport
    // The subset of prefsLocal a USER has actually edited this session. It is what
    // prefsGetValue overlays on the fetched section: prefsLocal as a whole carries
    // the shipped defaults, so overlaying all of it would shadow the very values
    // the host just served (watermark off would read back as its default on).
    const prefsLocalEdited = new Set()
    // Fields a panel toggle changed so far but that have not yet been durably
    // committed to the host scope. If the scope was not ready at apply() time and
    // only appears later, these are replayed so a pre-bind edit still persists
    // instead of silently living in page-only memory.
    const prefsDirty = new Set()
    // Fields whose value THIS SESSION changed (see prefsSet), regardless of where
    // that edit currently stands. Used to tell "the host already holds this value"
    // apart from "the user put it back to a value the host happens to hold":
    // only the former means there is nothing left to persist.
    const prefsEdited = new Set()
    let prefsFieldValue = null // last schema-resolved user+base+defaults section from the scope, if any
    /* The bound settings transport: a DSH 0.1.7 `ConfigForm` or a legacy
       `settingsScope`. Both answer getSnapshot()/subscribe()/set(), which is
       all the store below needs; `prefsScopeKind` records which one it is (for
       diagnostics and the write-settlement contract). */
    let prefsScope = null
    let prefsScopeKind = null // 'configForms' | 'settingsScope' | null
    let prefsScopeNs = null // the namespace / profile entry id the scope came from
    let prefsUnsubscribe = null // disposer of the active scope subscription, if any
    let prefsBindTimer = null // retry handle for a settings transport that arrives late
    let prefsRetryTimer = null // bounded retry for held edits whose ready cue has not arrived
    let prefsSettleTimer = null // bounded settle watch for a transport bound before it was ready
    // Max held-edit retry passes. The ready transition is normally the cue; this
    // bounded timer is the safety net for a mirror whose first describe predates
    // a late host registration and sees no document commit to rerun on.
    const PREFS_RETRY_LIMIT = 20 // ~20 * 500ms = up to ~10s after the last held edit
    let prefsRetryCount = 0
    // True while prefsReplayDirty is mid-pass. A normal DSH scope.set is async,
    // but the mirror can fold a ready snapshot in synchronously (and document
    // mocks/transitions too), which would re-enter the replay from the theme's
    // own subscription and write the same held edits twice. The bus flag makes a
    // single replay pass authoritative; re-entrant calls become no-ops.
    let prefsReplayBusy = false
    /* Theme layers install *their* reconcile here once they exist (updated from
       the bottom of apply) so a transport event can live-apply a real change. */
    let reconcileFromPrefs = null
    /* True once an authoritative (status:'ready') section has been read for THIS
       page load, plus the one-shot hook the startup surfaces that depend on such a
       section install below. See prefsMarkSettled. */
    let prefsSettledOnce = false
    let onPrefsSettled = null
    /* Whether the settings page has rendered its body, for the boot report: a
       report from a page whose settings page was never opened is expected to
       show nothing, and must not be mistaken for a failure. */
    let panelMounted = false
    /* --- transport selection ------------------------------------------------
       Two DSH generations expose the same durable-preference seam under
       different names, and the theme has to work on both without throwing on
       whichever is absent:

         0.1.7-rc.1   cfg = ctx.get('configForms')   (the settings domain's
                      shared-form service)
                      cfg.get(<profile entry id>) -> ConfigForm with
                      getSnapshot() / subscribe() / set() / unset() / mutate()
                      and a snapshot of { status, value, base, user, revision,
                      writable, mode }. set() returns Promise<boolean>: false
                      means the Host refused or SKIPPED the write (the classic
                      case being memory mode on a non-loopback page).
         <=0.1.5-rc.2 binder = ctx.get('settingsScope') / ctx.settingsScope
                      binder.bind({ namespace, decode }) -> scope with the same
                      snapshot fields, and a fire-and-forget set().

       Same snapshot vocabulary, same write intent, so everything downstream of
       acquisition is shared; only the lookup, the namespace string and the
       settlement of set() differ. `configForms` is tried FIRST because on
       0.1.7 the legacy service does not exist at all.

       A ConfigForm is keyed by the PROFILE ENTRY ID, which the patch layer
       assigns: this package's own bundle patch inserts `theme-endfield`, but a
       hand-written insert may use the package name and the loader's tree path
       prefixes include groups with `include:`. PREFS_ENTRY_CANDIDATES lists the
       spellings this package can be installed under, in likelihood order.
       Acquisition prefers whichever candidate the Host actually SERVES and
       otherwise binds the first one immediately: a form is only a lazy view over
       the shared mirror, so binding early is what lets a slow boot deliver its
       section late instead of losing that page load's settings entirely. A wrong
       guess self-heals — while the bound form reports 'unavailable' and the
       mirror reloads, prefsOnScopeChange moves the binding to whichever
       candidate is served. */
    const PREFS_ENTRY_CANDIDATES = [
      PREFS_ENTRY,                   // this package's cordis.patch.yml row id
      'include:' + PREFS_ENTRY,      // loader tree path when bundle-mounted
      PREFS_NS,                      // a row inserted under the old namespace name
      'include:' + PREFS_NS,
    ]
    /* The 0.1.7 shared-form service, or undefined on a host that has none. Both
       access forms are tried: the injected-property spelling DSH's own client
       plugins use, then the optional-lookup form this module has always used. */
    const getConfigForms = () => {
      try {
        if (ctx.configForms !== undefined && ctx.configForms !== null
          && typeof ctx.configForms.get === 'function') return ctx.configForms
      } catch (e) { /* property may be a getter that throws when not available */ }
      try {
        const forms = ctx.get('configForms')
        if (forms !== undefined && forms !== null && typeof forms.get === 'function') return forms
      } catch (e) { /* optional service lookup */ }
      return undefined
    }
    // Try the idiomatic injected-property access first (how DSH client plugins like
    // dsh-client-locale consume services — exports.inject plus `ctx.xxx`), then
    // the lookup form this module has historically used for optional services.
    const getSettingsScopeBinder = () => {
      try {
        if (ctx.settingsScope !== undefined && ctx.settingsScope !== null
          && typeof ctx.settingsScope.bind === 'function') return ctx.settingsScope
      } catch (e) { /* property may be a getter that throws when not available */ }
      try { return ctx.get('settingsScope') } catch (e) { return undefined }
    }
    /* The namespaces the Host's describe view actually SERVES, for diagnostics.
       This is the one fact that tells "the host half exported no Config" apart
       from "the client bound an entry spelling this install does not use": both
       leave the bound form unserved, and only the served list says which one
       happened. Returns null while the mirror has not answered yet. */
    const prefsServedNamespaces = () => {
      try {
        const forms = getConfigForms()
        if (forms === undefined || typeof forms.describe !== 'function') return null
        const mirrored = forms.describe().getSnapshot()
        const view = mirrored && mirrored.view
        if (!view || !Array.isArray(view.namespaces)) return null
        return view.namespaces.map((row) => row && row.ns)
      } catch (e) { return null }
    }
    /* Snapshot of any transport object, or null when it cannot be read. */
    const prefsSnapshotOf = (scope) => {
      if (!scope || typeof scope.getSnapshot !== 'function') return null
      try { return scope.getSnapshot() } catch (e) { return null }
    }
    /* The first CANDIDATE spelling the Host actually serves (status 'ready'),
       or null. Kept separate from acquisition because it is also the re-check a
       bound-but-unserved form runs when the mirror reloads. */
    const prefsFindReadyForm = () => {
      const forms = getConfigForms()
      if (forms === undefined) return null
      for (const ns of PREFS_ENTRY_CANDIDATES) {
        let form = null
        try { form = forms.get(ns) } catch (e) { form = null }
        if (!form || typeof form.getSnapshot !== 'function') continue
        const snap = prefsSnapshotOf(form)
        if (snap !== null && snap.status === 'ready') return { scope: form, kind: 'configForms', ns }
      }
      return null
    }
    /* Acquire the transport for this page.
       A SERVED candidate wins outright. Otherwise the FIRST candidate is bound
       anyway, even while the mirror is still 'loading' or reports it
       'unavailable': a ConfigForm always exists (it is a lazy view over the
       shared mirror), and binding it immediately is what lets a slow or
       later-served Host still deliver its section through the subscription —
       exactly how the legacy binder behaved. A wrong guess is not fatal:
       prefsOnScopeChange re-selects as soon as another candidate is served. */
    const acquirePrefsScope = () => {
      const ready = prefsFindReadyForm()
      if (ready !== null) return ready
      const forms = getConfigForms()
      if (forms !== undefined) {
        for (const ns of PREFS_ENTRY_CANDIDATES) {
          let form = null
          try { form = forms.get(ns) } catch (e) { form = null }
          if (form && typeof form.getSnapshot === 'function') return { scope: form, kind: 'configForms', ns }
        }
      }
      const binder = getSettingsScopeBinder()
      if (binder !== undefined && binder !== null && typeof binder.bind === 'function') {
        let scope = null
        try { scope = binder.bind({ namespace: PREFS_NS, decode: prefsResolveSection }) } catch (e) { dbg('bind threw', e && e.message); scope = null }
        if (scope !== null && scope !== undefined) return { scope, kind: 'settingsScope', ns: PREFS_NS }
      }
      return null
    }
    /* A schema-accepted section from the transport, else in-memory defaults
       (PREFS_FIELD_DEFAULTS is the fallback BEFORE a first section arrives).
       Fields the user has edited this session are overlaid ON TOP on purpose: a
       toggle writes prefsLocal synchronously and only then does the host echo the
       section back, so reading the fetched section first would show the panel the
       new state while the theme still acted on the old one until the round-trip
       closed. Only EDITED fields are overlaid (see prefsLocalEdited), so a served
       value for any other field is still what the theme reads. */
    let prefsOverlayCache = null
    const prefsGetValue = () => {
      const base = prefsFieldValue || PREFS_FIELD_DEFAULTS
      if (prefsLocalEdited.size === 0) return base
      /* Hot path: the watermark observer reads prefs many
         times per frame. Rebuilding this overlay per read allocated a fresh
         ~24-key object every time; caching it against the base-section
         REFERENCE keeps those reads allocation-free. prefsSet invalidates on
         every edit (the only place prefsLocalEdited grows), and a new section
         from the host arrives as a different `base` reference, so a stale pair
         can never be served. Callers treat the result as read-only — prefsGet
         is the sole runtime consumer and only reads single fields. */
      if (prefsOverlayCache !== null && prefsOverlayCache.base === base) return prefsOverlayCache.out
      const out = Object.assign({}, base)
      for (const field of prefsLocalEdited) out[field] = prefsLocal[field]
      prefsOverlayCache = { base, out }
      return out
    }
    /** read one field as its raw stored string: <stored-or-default>, never null. */
    const prefsGet = (rawKey) => {
      const field = prefsFieldOf(rawKey)
      const sec = prefsGetValue()
      if (sec && Object.prototype.hasOwnProperty.call(sec, field)) return String(sec[field])
      return PREFS_FIELD_DEFAULTS[field]
    }
    /** subscribe to any change of the whole namespace (transport or local). */
    const prefsSubscribe = (listener) => {
      prefsListeners.push(listener)
      return () => {
        const i = prefsListeners.indexOf(listener)
        if (i >= 0) prefsListeners.splice(i, 1)
      }
    }
    const prefsEmit = () => {
      for (const l of prefsListeners.slice()) { try { l() } catch (e) { /* keep going */ } }
      if (reconcileFromPrefs) try { reconcileFromPrefs() } catch (e) { /* keep going */ }
    }
    /* The FIRST authoritative section of a page load is a moment of its own: it is
       the instant the stored preferences become knowable at all. On a real page
       load the Host serves that section over the wire, so every read made while
       apply() runs — including the boot plate's — falls back to the schema
       defaults. A surface whose whole job happens at startup therefore cannot act
       on its apply()-time read; it hangs off this transition instead.

       Fires at most once per page load, and only AFTER the section has been
       resolved (prefsFieldValue assigned) and any legacy migration has run, so a
       hook reading prefsGet() sees final values rather than a half-applied
       snapshot. Deliberately not re-fired by later sections: a section that
       changes later is an ordinary runtime edit, not a page load. */
    const prefsMarkSettled = () => {
      if (prefsSettledOnce) return
      prefsSettledOnce = true
      if (onPrefsSettled) try { onPrefsSettled() } catch (e) { /* keep going */ }
    }
    const dbg = (...a) => { try { if (typeof console !== 'undefined' && console.warn) console.warn('[dsh-theme-endfield:prefs]', ...a) } catch (e) { /* noop */ } }

    /* --- Durable write gate -----------------------------------------------
       A scope snapshot from @deepseek-ai/dsh-client-ui-settings carries three
       flags that must ALL hold before a scope.set can durably land:
         mode    === 'host'   loopback page syncing the Host document.
                              'memory' (non-loopback) never persists.
         status  === 'ready'  the Host's describe view actually SERVES this
                              namespace and a decoded value stands. It stays
                              'loading' before the first accepted section and
                              becomes 'unavailable' when the namespace is NOT in
                              the host's served list (the host half has not run
                              its ctx.settings.register(...) yet, or the mirror
                              last fetched before it appeared). A scope.set into
                              a 'loading'/'unavailable' host scope reaches no
                              durable store.
         writable=== true     the Host document accepts writes.
       Gating on snap.writable ALONE is the old bug: a host-mode describe view
       answers writable=true even while this namespace is still unserved, so the
       old code fired scope.set into a namespace the host had not registered,
       cleared the dirty mark and logged the misleading
       `commit ... status= unavailable` warn — the preference kept working for
       the page session but vanished on the next reload. We issue a real wire
       write only once the namespace is genuinely served, and keep the edit
       dirty so a later ready transition (re)plays it. */
    const prefsSnap = () => {
      const scope = prefsScope
      if (!scope) return null
      try { return scope.getSnapshot() } catch (e) { return null }
    }
    const prefsDurablyServed = (snap) => !!snap && snap.mode === 'host' && snap.status === 'ready' && !!snap.writable
    /* One field write through the bound transport, with one settlement contract
       for both generations. The legacy scope.set() is fire-and-forget; a
       ConfigForm's set() returns Promise<boolean>, where false means the Host
       REFUSED or SKIPPED the write (most commonly memory mode on a non-loopback
       page) and a rejection means the wire call failed. Either way the edit is
       put back into prefsDirty so a later ready/replay pass retries it instead
       of the setting looking saved while nothing reached the document.
       Deliberately NOT marked dirty up front for a thenable write: DSH's own
       client folds an ACCEPTED write into the shared mirror before the returned
       promise resolves, so a synchronous dirty mark would make every toggle
       emit a redundant second write. A late repair beats a duplicate write.
       @returns true when the write was issued (not when it was accepted). */
    const prefsWriteField = (field, value) => {
      const scope = prefsScope
      if (!scope || typeof scope.set !== 'function') return false
      let result = null
      try { result = scope.set(field, String(value)) } catch (e) {
        dbg('set threw', field, e && e.message)
        prefsDirty.add(field)
        return false
      }
      if (result && typeof result.then === 'function') {
        result.then((ok) => {
          if (ok === false) {
            dbg('set REFUSED by the host', field, value)
            prefsDirty.add(field)
            prefsScheduleRetry()
          } else {
            prefsDirty.delete(field)
          }
        }, (e) => {
          dbg('set REJECTED', field, value, String(e && e.message || e))
          prefsDirty.add(field)
        })
      } else {
        prefsDirty.delete(field)
      }
      return true
    }
    /* Push edits recorded while the scope was not durably served as soon as it
       is (bind catch-up + an unavailable/loading -> ready subscription both call
       this). A dirty field is cleared only once it is WRITTEN to a served host
       scope, or once the host's own FETCHED section already holds that exact
       value. Guarded against races the same way as prefsCommit: a rejected async
       write keeps the field for a later try. */
    const prefsReplayDirty = () => {
      if (prefsReplayBusy) return
      if (prefsDirty.size === 0) return
      prefsReplayBusy = true
      try {
        const snap = prefsSnap()
        const durable = prefsDurablyServed(snap)
        for (const field of Array.from(prefsDirty)) {
          const local = prefsLocal[field]
          const hostValue = snap && snap.value
            ? (Object.prototype.hasOwnProperty.call(snap.value, field) ? String(snap.value[field]) : undefined)
            : undefined
          /* An edit the host ALREADY holds needs no write — provided the host
             really holds it, rather than the user having just typed that value
             back in. Those differ in exactly one case, and it is the one that
             matters: the user reverts a field to a value the host's stale view
             still reports (the pre-migration default is the common one), and
             skipping the write would silently drop the revert. So only a field
             this session never edited is cleared on equality; an edited field is
             cleared by its write.
             Equality with the shipped DEFAULT is likewise not a reason to clear:
             the host may still hold a non-default value, and "put it back to the
             default" is then a real edit that has to reach the document. */
          if (local === hostValue && !prefsEdited.has(field)) {
            prefsDirty.delete(field)
            continue
          }
          if (!durable) continue
          // Optimistically clear; a refused/rejected write puts the field back
          // into prefsDirty from prefsWriteField's settlement handler.
          if (prefsWriteField(field, local)) {
            dbg('replayed held', field, '=', local)
            prefsDirty.delete(field)
          }
        }
      } finally {
        prefsReplayBusy = false
      }
    }
    /* Bounded safety net for a held edit whose "ready" cue never arrives on its
       own. A normal scope subscription fires on the ready transition and replays
       immediately; this is only for a mirror whose first describe predated a late
       host registration and that sees no intermediate document commit / reconnect
       to rerun on. Each tick simply calls prefsReplayDirty() again; once nothing
       is held (all written) the loop stops itself. Stops after PREFS_RETRY_LIMIT
       ticks so an environment where the namespace is genuinely never served does
       not spin forever. */
    const prefsStopRetry = () => {
      if (prefsRetryTimer !== null && typeof clearTimeout === 'function') clearTimeout(prefsRetryTimer)
      prefsRetryTimer = null
      prefsRetryCount = 0
    }
    const prefsScheduleRetry = () => {
      // Nothing held any more: no reason to keep ticking.
      if (prefsDirty.size === 0) { prefsStopRetry(); return }
      // A durably-served scope needs no timer — its subscription replays fast.
      if (prefsDurablyServed(prefsSnap())) { prefsStopRetry(); return }
      if (prefsRetryTimer !== null) return // already ticking
      if (typeof setTimeout !== 'function') return // no timer environment
      prefsRetryCount = 0
      const tick = () => {
        prefsRetryTimer = null
        prefsRetryCount += 1
        if (prefsRetryCount > PREFS_RETRY_LIMIT) { prefsStopRetry(); return }
        if (prefsDirty.size === 0) { prefsStopRetry(); return }
        if (prefsDurablyServed(prefsSnap())) { prefsStopRetry(); return }
        prefsReplayDirty()
        if (prefsDirty.size > 0) prefsRetryTimer = setTimeout(tick, 500)
        else prefsStopRetry()
      }
      prefsRetryTimer = setTimeout(tick, 500)
    }
    const prefsCommit = (field, encoded) => {
      // Best-effort durable write. A real wire write happens only while the
      // scope is durably served (see the gate note above); before that we stay
      // session-local, record the edit in prefsDirty and let prefsReplayDirty
      // push it once the namespace is served. We deliberately do NOT
      // prefsEmit() here: the caller's toggle already reconciles the layer it
      // changes, and the authoritative echo arrives through the scope
      // subscription below, so an immediate synchronous emit would do the same
      // work twice.
      const scope = prefsScope
      if (scope) {
        const snap = prefsSnapshotOf(scope)
        if (prefsDurablyServed(snap)) {
          dbg('commit', field, '=', encoded, 'via', prefsScopeKind, prefsScopeNs, 'status=', snap.status, 'mode=', snap.mode)
          prefsWriteField(field, encoded)
          return true
        }
        dbg('held (namespace not durably served yet)', field, '=', encoded, 'snap=', snap === null ? null : { status: snap.status, writable: snap.writable, mode: snap.mode }, 'hostServes=', prefsServedNamespaces())
      } else {
        dbg('commit with NO settings transport bound (page-local only)', field, encoded, 'hostServes=', prefsServedNamespaces())
      }
      prefsDirty.add(field)
      prefsScheduleRetry()
      return false
    }
    /** write one field with the exact stored-string value the UI derives. */
    const prefsSet = (rawKey, encoded) => {
      const field = prefsFieldOf(rawKey)
      prefsLocal[field] = String(encoded)
      prefsLocalEdited.add(field)
      prefsEdited.add(field)
      prefsOverlayCache = null
      prefsCommit(field, prefsLocal[field])
    }
    /* Normalize a section the transport handed us to a full set of SCHEMA
       fields: the declared fields the mirror resolved, plus schema defaults for
       any it has not. Field names come from the one table (prefsFieldOf), so a
       section is keyed exactly the way the theme reads it. */
    const prefsResolveSection = (section) => {
      const out = Object.assign({}, PREFS_FIELD_DEFAULTS)
      if (section === null || typeof section !== 'object') return out
      for (const field of Object.keys(PREFS_FIELD_DEFAULTS)) {
        if (Object.prototype.hasOwnProperty.call(section, field)) out[field] = String(section[field])
      }
      return out
    }
    /* Sections written by the BUILD THAT SHIPPED THE FIELD-NAME BUG still carry
       the pre-migration spelling of a compound field ('thunderAnim' written as
       'thunder-anim'), because that write landed on an undeclared key the schema
       passes through instead of storing it into the declared field. Without this
       pass the user's stored choice is ignored and the field default silently
       wins — for them the switch would look like it reset again after the fix.
       Returns the [field, value] pairs whose recorded legacy value is the one to
       honour, i.e. the edits that need re-committing onto the declared field.

       WHEN IS THE DECLARED FIELD THE USER'S OWN VALUE? This is the whole
       question, because a fetched section ALWAYS carries every declared field:
       the schema merges its defaults into the stored section, so
       `hasOwnProperty` cannot tell a user-set value from an implied default.
       And in practice only ONE signal can: a value that differs from the shipped
       default. A declared field sitting at its default is indistinguishable from
       an untouched one — the section is the merged view, so nothing survives in
       it to say whether the document stored that default or the schema inserted
       it. Therefore:

         declared absent or === default  -> nothing recorded a choice for this
                                            field, so the stray legacy key is the
                                            only trace of one: honour it.
         declared set to anything else    -> a correctly-writing build stored it,
                                            so it wins and the stray key is
                                            ignored. (Never let the pre-migration
                                            spelling overwrite a real edit.)

       That makes the migration idempotent in the good direction: after the value
       is re-committed, the declared field is non-default and the stray key can
       never win again. */
    const prefsLegacyFields = (section) => {
      const out = []
      if (section === null || typeof section !== 'object') return out
      for (const field of Object.keys(PREFS_FIELD_TO_LEGACY_KEY)) {
        const legacy = PREFS_FIELD_TO_LEGACY_KEY[field]
        if (!Object.prototype.hasOwnProperty.call(section, legacy)) continue
        const value = section[legacy]
        if (value === undefined || value === null || String(value) === '') continue
        const declared = Object.prototype.hasOwnProperty.call(section, field) ? String(section[field]) : undefined
        if (declared !== undefined && declared !== PREFS_FIELD_DEFAULTS[field]) continue
        out.push([field, String(value)])
      }
      return out
    }
    /* Re-commit a legacy-spelled value onto the declared field, once. Writes go
       through prefsSet, i.e. through the same durable gate as a user toggle: on a
       served scope it lands on the schema field immediately, on one that is not
       served yet it is held and replayed (and mirrored locally, so the theme
       behaves correctly meanwhile). The stale key itself is left in the document
       — the theme no longer declares or reads it, and rewriting a section it does
       not own would be a bigger hammer than the bug deserves. */
    const prefsMigrated = new Set()
    // The section object this pass has already run against. A section is a fresh
    // object on every transport update, so identity is what says "this document
    // has not been examined yet" — and it keeps the pass from re-running against
    // its own writes within the same snapshot.
    let prefsMigratedFor = null
    const prefsMigrateLegacy = (section) => {
      if (section === null || typeof section !== 'object') return
      if (section === prefsMigratedFor) return
      prefsMigratedFor = section
      for (const [field, value] of prefsLegacyFields(section)) {
        if (prefsMigrated.has(field)) continue
        prefsMigrated.add(field)
        dbg('migrating legacy-spelled field', PREFS_FIELD_TO_LEGACY_KEY[field], '->', field, '=', value)
        prefsSet(field, value)
      }
    }
    /* Everything a bound transport needs after acquisition: adopt the initial
       snapshot, subscribe, then run the catch-up / legacy-repair / settled
       passes the single-transport version already ran. */
    /* Drop the active transport subscription, if any. Called by the re-selection
       below (switching to a different entry spelling) and by run teardown. */
    const prefsReleaseSubscription = () => {
      if (typeof prefsUnsubscribe === 'function') {
        try { prefsUnsubscribe() } catch (e) { /* the transport may already be gone */ }
      }
      prefsUnsubscribe = null
    }
    const prefsOnScopeChange = (scope) => {
      const snap = prefsSnapshotOf(scope)
      if (snap === null) return
      /* Re-selection. A form bound before the mirror answered reports 'loading'
         (bound while the Host was still sending its describe view) or
         'unavailable' (this install does not use that entry spelling); the
         moment the Host serves one of the OTHER candidates, move the binding
         there instead of staying deaf to the real entry. Re-selection uses a
         ready-only scan, so it can never bounce between two unserved
         candidates.

         'loading' is included in the trigger — not only 'unavailable' — because
         a real boot binds during exactly that window: client.js reaches
         acquirePrefsScope() while the mirror is still fetching, so the FIRST
         candidate is bound with status:'loading'. If that guess is the wrong
         spelling, the fix-up has to happen on the unserved side of the
         transition; waiting for 'unavailable' alone misses a wrong form that
         goes straight from 'loading' to a served other candidate. */
      if ((snap.status === 'unavailable' || snap.status === 'loading') && prefsScopeKind === 'configForms') {
        const ready = prefsFindReadyForm()
        if (ready !== null && ready.ns !== prefsScopeNs) {
          dbg('re-selecting settings entry', prefsScopeNs, '->', ready.ns)
          prefsReleaseSubscription()
          prefsScope = null
          prefsScopeKind = null
          prefsScopeNs = null
          prefsBindScope(ready)
          // A re-selection happens long after apply() (the mirror answered
          // late), so the theme is already mounted and must reconcile onto the
          // section that just arrived. Harmless at apply time, where no layer
          // has installed its reconciler yet.
          prefsEmit()
          return
        }
      }
      /* ONLY a status that cannot carry a section is ignored here. 'loading' is
         deliberately NOT ignored: it is the state a real page load STARTS in
         (the Host serves the section over the wire, so the bound form reports
         status:'loading', writable:false, valueKeys:0 while apply() runs), and
         the transition that matters — loading -> ready — is a single
         subscription event. Returning early on 'loading' swallowed exactly that
         event, so a section that settled after the bind never reached
         prefsFieldValue, the held edits were never replayed onto it, and
         prefsMarkSettled() never fired. Everything then fell back to the schema
         defaults until the next reload, even though the Host had served the
         user's values. The bounded settle watch usually rescued it, which is why
         the failure was intermittent rather than total. */
      if (snap.status !== 'ready' && snap.status !== 'unavailable' && snap.status !== 'loading') return
      if (snap.status === 'ready' && snap.value !== undefined) prefsFieldValue = prefsResolveSection(snap.value)
      // An unavailable/loading -> ready transition is precisely when an edit we
      // HELD (see prefsCommit) can finally be written: replay any dirty fields
      // the moment the namespace is durably served. prefsReplayDirty is a no-op
      // when nothing is held or the scope is not yet served.
      prefsReplayDirty()
      // The FIRST served section is also the first chance to see a document the
      // buggy build wrote (before that there is nothing to read), so the legacy
      // repair runs here too — and again on any later section that has not been
      // examined yet. Whatever it queues is replayed below.
      prefsMigrateLegacy(snap.value)
      prefsReplayDirty()
      prefsEmit()
      /* Deliberately last: the startup hook must read the section only after it
         is resolved and migrated (and after prefsEmit has let the layer
         reconciler mount a theme the settled section switched on), and it must
         fire once rather than on every snapshot. */
      if (snap.status === 'ready' && snap.value !== undefined) prefsMarkSettled()
    }
    const prefsBindScope = (acquired) => {
      const scope = acquired.scope
      prefsScope = scope
      prefsScopeKind = acquired.kind
      prefsScopeNs = acquired.ns
      const initial = prefsSnapshotOf(scope)
      if (initial) dbg('bound', acquired.kind, 'ns=', acquired.ns, '; initial status=', initial.status, 'writable=', initial.writable, 'mode=', initial.mode, 'valueKeys=', initial.value ? Object.keys(initial.value).length : 0)
      if (initial && initial.status === 'ready' && initial.value !== undefined) {
        prefsFieldValue = prefsResolveSection(initial.value)
      }
      /* The subscription disposer is RETAINED here (the single-transport version
         dropped it): a ConfigForm is a shared, provider-owned controller, so the
         run's teardown must remove this listener instead of leaking it into the
         next run — see the prefs ctx.effect below. */
      if (typeof scope.subscribe === 'function') {
        try {
          const unsubscribe = scope.subscribe(() => prefsOnScopeChange(scope))
          if (typeof unsubscribe === 'function') prefsUnsubscribe = unsubscribe
        } catch (e) { dbg('subscribe threw', e && e.message) }
      }
      // Catch up: an edit made before the scope settled must still persist. Replay
      // only genuinely user-changed fields (those prefsSet recorded as dirty) that
      // now differ from a freshly-fetched, durably-served host section.
      prefsReplayDirty()
      // Then repair a section the buggy build wrote with the pre-migration field
      // spelling, and re-run the catch-up for whatever that migration queued.
      prefsMigrateLegacy(initial && initial.value)
      prefsReplayDirty()
      /* A section that was ALREADY ready when the scope bound is authoritative on
         the first read too. In practice no hook is installed yet at this point in
         apply() (the boot-loader block below runs later), so this normally just
         records the transition — the plate's own apply()-time read is already
         correct when the section beat apply(), and that path is unchanged. */
      if (initial && initial.status === 'ready' && initial.value !== undefined) prefsMarkSettled()
      // Safety net for a transport bound before the Host served it (no-op when
      // the section was ready already).
      prefsStartSettleWatch(0)
    }
    /* Bounded settle watch for a transport that was bound before the Host served
       it. The subscription is normally the cue — the shared describe mirror
       re-derives every form on a reload and the store notifies on a snapshot
       change — but a mirror that answers WITHOUT replacing the bound form's
       snapshot (or that only ever serves a different entry spelling) would leave
       this page load on schema defaults forever. This is the bounded safety net
       the legacy generation had as its 250 ms binder poll: it re-checks a limited
       number of times, moves to a newly served candidate spelling when one
       appears, and stops the moment the bound snapshot is ready. */
    const PREFS_SETTLE_LIMIT = 20 // ~20 * 500ms = up to ~10s after the bind
    const prefsStartSettleWatch = (attempt) => {
      if (prefsScope === null) return
      /* A re-bind or a re-selection can start a new chain while an earlier one
         is still pending; drop the old timer first so exactly one chain runs.
         The passes are idempotent, but duplicate chains duplicate logs and
         duplicate snapshot work. Clearing an already-fired handle is harmless. */
      if (prefsSettleTimer !== null && typeof clearTimeout === 'function') clearTimeout(prefsSettleTimer)
      prefsSettleTimer = null
      const snap = prefsSnapshotOf(prefsScope)
      if (snap !== null && snap.status === 'ready') {
        /* The form is served but its store never emitted (or the value arrived
           between acquisition and subscription). Run the same passes the
           subscription would have run — adopt, replay, migrate, settle — unless
           the bind already did them, then stop watching. */
        if (prefsFieldValue === null || prefsDirty.size > 0) prefsOnScopeChange(prefsScope)
        return
      }
      if (attempt >= PREFS_SETTLE_LIMIT) {
        /* Give up loudly, once. This is the page load that will lose the user's
           switches on the next reload, and the line below says which side is at
           fault: boundNs/status describe the client's binding, hostServes lists
           what the host actually serves (our entry id missing from it means the
           host half exported no Config — see index.js). */
        const finalSnap = prefsSnapshotOf(prefsScope)
        dbg('settle watch gave up after', attempt, 'attempts; preferences stay page-local. boundNs=', prefsScopeNs, 'status=', finalSnap === null ? null : finalSnap.status, 'mode=', finalSnap === null ? null : finalSnap.mode, 'hostServes=', prefsServedNamespaces())
        return
      }
      const ready = prefsFindReadyForm()
      if (ready !== null && ready.ns !== prefsScopeNs) {
        dbg('settle watch re-selecting settings entry', prefsScopeNs, '->', ready.ns)
        prefsReleaseSubscription()
        prefsScope = null
        prefsScopeKind = null
        prefsScopeNs = null
        prefsBindScope(ready)
        prefsEmit()
        return
      }
      if (typeof setTimeout !== 'function') return
      prefsSettleTimer = setTimeout(() => prefsStartSettleWatch(attempt + 1), 500)
    }
    /* One-shot boot report, logged ONLY when the store did not end up in the
       healthy state (a served, settled, writable host section with nothing held).
       "The switches reset on reload" has several causes that look identical from
       the outside — the entry spelling is wrong, the mirror never answered, the
       page is memory-backed, or an edit never reached the document — and each one
       is a property of THIS machine's install. When everything is fine this says
       nothing at all; when it is not, one line names the cause instead of leaving
       it to guesswork. */
    const prefsReportBoot = () => {
      const snap = prefsSnapshotOf(prefsScope)
      const healthy = snap !== null && snap.status === 'ready' && snap.mode === 'host'
        && snap.writable === true && prefsDirty.size === 0
      if (healthy) return
      dbg('boot report (preferences did NOT reach a durable section):',
        'boundNs=', prefsScopeNs, 'kind=', prefsScopeKind,
        'status=', snap === null ? null : snap.status,
        'mode=', snap === null ? null : snap.mode,
        'writable=', snap === null ? null : snap.writable,
        'valueKeys=', snap && snap.value ? Object.keys(snap.value).length : 0,
        'settled=', prefsSettledOnce,
        'dirty=', Array.from(prefsDirty),
        'panelMounted=', panelMounted,
        'hostServes=', prefsServedNamespaces(),
        'candidates=', PREFS_ENTRY_CANDIDATES)
    }
    /* DIAG-ROUND5 (a host-vs-store value comparison printed on every load) was
       removed here: its cause was confirmed and fixed by the durable
       configForms transport, and dbg() is an unconditional console.warn, so the
       probe had become pure console noise on healthy pages. */
    let prefsBootReportTimer = null
    if (typeof setTimeout === 'function') {
      // After the mirror has had a fair chance to answer (the settle watch's own
      // budget), state the outcome once whether or not it worked. Tracked so the
      // dispose effect below can revoke it: after a teardown prefsScope is null,
      // which reads as "unhealthy" and would print a misleading boot report for
      // a page that is simply gone.
      prefsBootReportTimer = setTimeout(prefsReportBoot, PREFS_SETTLE_LIMIT * 500 + 500)
    }
    /* Repeatedly try to obtain a settings transport until one is servable. DSH
       web mounts plugin rows concurrently, so the settings service (and its
       describe mirror) can legitimately settle AFTER this theme's apply() runs;
       without this retry a single synchronous attempt that raced would leave
       prefsScope null forever and every subsequent toggle would silently stay
       page-local — the exact "works now, gone on refresh" symptom. */
    const rebindPrefs = (attempt) => {
      if (prefsScope !== null) return
      if (attempt > 40) { dbg('gave up binding a settings transport after retries; staying in-memory', 'hostServes=', prefsServedNamespaces()); return }
      let acquired = null
      try { acquired = acquirePrefsScope() } catch (e) { dbg('acquisition threw', e && e.message); acquired = null }
      if (acquired === null) {
        if (typeof setTimeout === 'function') {
          if (attempt % 8 === 0) dbg('waiting for a settings transport (attempt', attempt, ')')
          prefsBindTimer = setTimeout(() => rebindPrefs(attempt + 1), 250)
        }
        return
      }
      try {
        prefsBindScope(acquired)
      } catch (e) {
        // A throw in the middle of a bind leaves nothing usable behind: release
        // the slot and keep retrying instead of pretending a broken transport is
        // bound.
        prefsScope = null
        prefsScopeKind = null
        prefsScopeNs = null
        dbg('bind failed', e && e.message)
        if (typeof setTimeout === 'function') prefsBindTimer = setTimeout(() => rebindPrefs(attempt + 1), 250)
      }
    }
    // Kick off the (re)trying transport acquisition.
    rebindPrefs(0)
    // Dispose on run teardown (mirrors ctx.effect owned resources). One effect
    // owns the whole store — the earlier pair was a strict duplicate — and it
    // also releases the transport subscription: a ConfigForm is shared and
    // provider-owned, so leaving our listener behind would leak it into the
    // next run of this plugin in the same page.
    ctx.effect(() => () => {
      prefsListeners.length = 0
      prefsReleaseSubscription()
      prefsScope = null
      prefsScopeKind = null
      prefsScopeNs = null
      prefsFieldValue = null
      onPrefsSettled = null
      if (prefsBindTimer !== null && typeof clearTimeout === 'function') clearTimeout(prefsBindTimer)
      prefsBindTimer = null
      if (prefsRetryTimer !== null && typeof clearTimeout === 'function') clearTimeout(prefsRetryTimer)
      prefsRetryTimer = null
      if (prefsSettleTimer !== null && typeof clearTimeout === 'function') clearTimeout(prefsSettleTimer)
      prefsSettleTimer = null
      if (prefsBootReportTimer !== null && typeof clearTimeout === 'function') clearTimeout(prefsBootReportTimer)
      prefsBootReportTimer = null
    })

    const RADIUS_KEY = 'dsh-theme-endfield-radius'
    const ENABLED_KEY = 'dsh-theme-endfield-enabled'
    const isEnabled = () => prefsGet(ENABLED_KEY) !== '0'
    const MOTION_KEY = 'dsh-theme-endfield-motion'
    /* Order is the select's order, default first. A–C are the original three;
       D–F were added as three independent motion MOTIFS (corner brackets /
       instrument meter / stamp) so each can be judged separately rather than
       stacked onto one button. */
    const MOTION_OPTIONS = ['signal', 'silent', 'impact', 'clamp', 'meter', 'stamp', 'off']
    /* Option label keys, in MOTION_OPTIONS order. Kept as a table rather than a
       nested ternary chain so a new scheme cannot be added to the list and
       silently fall back to the off label (the old chain had no default). */
    const MOTION_LABEL_KEYS = {
      signal: 'motionSignal', silent: 'motionSilent', impact: 'motionImpact',
      clamp: 'motionClamp', meter: 'motionMeter', stamp: 'motionStamp', off: 'motionOff',
    }
    const readMotion = () => {
      const value = prefsGet(MOTION_KEY)
      return MOTION_OPTIONS.includes(value) ? value : 'signal'
    }
    const syncMotion = () => {
      if (typeof document === 'undefined' || document.body === null) return
      const value = readMotion()
      if (isEnabled() && value !== 'off') document.body.setAttribute?.('data-endfield-motion', value)
      else document.body.removeAttribute?.('data-endfield-motion')
    }
    /* 工业底纹. Same three-literal shape as glass; carried on <body> as
       data-endfield-texture, and REMOVED entirely for 'off' (the runtime behaviour
       the other switches share). The official /operator backgrounds are the
       'standard' tier, so that is the shipped default. */
    const TEXTURE_KEY = 'dsh-theme-endfield-texture'
    const TEXTURE_OPTIONS = ['off', 'subtle', 'standard']
    const readTexture = () => {
      const value = prefsGet(TEXTURE_KEY)
      return TEXTURE_OPTIONS.includes(value) ? value : 'standard'
    }
    const syncTexture = () => {
      if (typeof document === 'undefined' || document.body === null) return
      const value = readTexture()
      if (isEnabled() && value !== 'off') document.body.setAttribute?.('data-endfield-texture', value)
      else document.body.removeAttribute?.('data-endfield-texture')
    }
    const GLASS_KEY = 'dsh-theme-endfield-glass'
    const GLASS_OPTIONS = ['off', 'subtle', 'standard', 'strong']
    const readGlass = () => {
      const value = prefsGet(GLASS_KEY)
      return GLASS_OPTIONS.includes(value) ? value : 'off'
    }
    const syncGlass = () => {
      if (typeof document === 'undefined' || document.body === null) return
      const value = readGlass()
      if (isEnabled() && value !== 'off') document.body.setAttribute?.('data-endfield-glass', value)
      else document.body.removeAttribute?.('data-endfield-glass')
    }
    const syncRadiusMode = () => {
      // The bundle can run before <body> exists (see runLoader's DOMContentLoaded
      // deferral for the same window); a classList touch on null would throw and
      // kill the whole install. syncPaletteClass guards the same way.
      if (typeof document === 'undefined' || document.body === null) return
      const mode = prefsGet(RADIUS_KEY) || 'square'
      if (mode === 'round') document.body.classList.add('theme-endfield-round')
      else document.body.classList.remove('theme-endfield-round')
    }

    /* ---------- accent palette: 终末地灰 (default) / 谷地黄 / 武陵青 ----------
       The palette is ONE class on <body>; the stylesheet defines both variable
       sets, so switching is a class flip with no restyling work here. Because the
       app applies its theme tokens as inline body styles and this theme's token
       overrides are var(--edge-accent) references, those tokens re-resolve on the
       same flip — no JS repaint, no theme.overrideTokens() re-registration.

       'valley' (谷地黄, signal yellow) is the DEFAULT, so an unset field and any
       unrecognised value both mean yellow. Only the exact string 'wuling' selects
       武陵青, which keeps a corrupt stored value (schema rejects / outside the
       fallback) from silently changing the shipped look.

       A palette flip made in another tab or restored by the browser is caught by
       the body-class observer below, which re-syncs the class onto the page. */
    const PALETTE_KEY = 'dsh-theme-endfield-palette'
    /* 终末地灰 (gray) is the DEFAULT, so an unset field and any unrecognised value
       both mean gray. Only the exact strings 'valley' / 'wuling' select a bright
       palette, which keeps a corrupt stored value from silently changing the
       shipped look. valley and wuling carry their own body class; gray's class
       exists too (its block overrides the base body block) so every non-default
       state is observable from the DOM. */
    const PALETTE_CLASSES = { gray: 'theme-endfield-gray', wuling: 'theme-endfield-wuling' }
    const readPalette = () => {
      const stored = prefsGet(PALETTE_KEY)
      return stored === 'valley' || stored === 'wuling' ? stored : 'gray'
    }
    /* Read from the DOM, not from storage: the canvas must match what is actually
       on screen. While the theme is switched off the class is absent, so the sheet
       keeps its default palette instead of following an ignored preference. */
    const isPalette = (name) => typeof document !== 'undefined'
      && document.body !== null
      && document.body.classList.contains(PALETTE_CLASSES[name])
    const syncPaletteClass = () => {
      if (typeof document === 'undefined' || document.body === null) return
      // A class only applies while the theme owns the page; unmount() drops it.
      const active = isEnabled() ? readPalette() : null
      for (const [name, cls] of Object.entries(PALETTE_CLASSES)) {
        if (name === active) document.body.classList.add(cls)
        else document.body.classList.remove(cls)
      }
    }

    /* ---------- background ENDFIELD watermark (settings-toggleable) ----------
       Two independent switches:
         WATERMARK_KEY  — the watermark itself (default ON), shown on the hero page.
         WATERMARK_PERSIST_KEY — "keep showing it off the hero page" (default OFF),
           which also paints it on an active conversation / settings / any other page.
       On the hero page the mark is centred on the headline. Off the hero page there
       is no headline to follow, so it is centred in the conversation column instead
       and mounted INSIDE that column rather than on <body>: a fixed body child
       paints above the message text (it has no z-index competitor to lose to),
       which would wash out what the user is reading. See mountPointFor().

       Both placements must stay strictly BEHIND the app's own chrome. That is a
       z-index question in the hero case and it is genuinely subtle -- see the long
       note on s.zIndex in styleWatermark(); it is locked down by
       test/watermark-stacking.test.js, which compares real screenshots because a
       pointer-events:none layer cannot be hit-tested. */
    const WATERMARK_KEY = 'dsh-theme-endfield-watermark'
    const WATERMARK_PERSIST_KEY = 'dsh-theme-endfield-watermark-persist'
    const isWatermarkOn = () => prefsGet(WATERMARK_KEY) !== '0'
    // Default OFF: the hero-only behaviour stays the shipped default.
    const isWatermarkPersistOn = () => prefsGet(WATERMARK_PERSIST_KEY) === '1'
    /* Hash-free selectors only. DSH 0.1.2-rc.1 rebuilt its CSS modules and every
       hex hash changed (0/33 of the old pinned hashes survive), so anything of the
       form [class*='pXSMma_root'] dies silently on upgrade. The stable hooks are
       the semantic SUFFIX of the module class plus structural attributes:
         data-phase is rendered ONLY on ConversationRoot (settling|hero|active) and
         a status dot, and only ConversationRoot's class ends in '_root', so
         [class$='_root'][data-phase=…] names the conversation column exactly. */
    const isHeroVisible = () => {
      if (typeof document === 'undefined') return false
      const hero = document.querySelector('[class$="_root"][data-phase="hero"]')
      if (!hero) return false
      const r = hero.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    /** The visible conversation column — the persist-mode anchor and mount parent. */
    const findConversationRoot = () => {
      if (typeof document === 'undefined') return null
      const all = document.querySelectorAll('[class$="_root"][data-phase]')
      for (const el of all) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) return el
      }
      return null
    }
    const findVisibleHeadline = () => {
      if (typeof document === 'undefined') return null
      const all = document.querySelectorAll('[class$="_headlineText"]')
      for (const h of all) {
        const r = h.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) return h
      }
      return null
    }
    let watermarkEl = null
    let watermarkRaf = null
    let watermarkHost = null
    /* Where the mark belongs for the current page, and how it must stack there:
         hero    -> <body>, above the (empty) hero backdrop, following the headline.
         persist -> inside the conversation column, BEHIND the message text.
       Returning the parent alongside the mode keeps the two decisions in one place,
       so remount happens exactly when either the parent or the stacking changes. */
    const mountPointFor = () => {
      if (isHeroVisible()) return { mode: 'hero', parent: document.body }
      const conv = findConversationRoot()
      if (conv !== null) return { mode: 'persist', parent: conv }
      // No conversation column on screen (e.g. a full-page settings view). A body
      // child at z-index:-1 paints BELOW the body/frame's own opaque backgrounds
      // there and never shows, so prefer the app FRAME: while the mark is mounted
      // in it the stylesheet gives the frame isolation:isolate (the same pair of
      // properties the conversation column gets above), so -1 stays above the
      // frame background and strictly below the page content. body is only the
      // last resort for a page that has no frame at all. findAppFrame is declared
      // further down but only ever called from here at runtime, never during the
      // synchronous apply pass.
      const frame = findAppFrame()
      return { mode: 'persist', parent: frame !== null ? frame : document.body }
    }
    const positionWatermark = () => {
      if (!watermarkEl) return
      if (watermarkEl.getAttribute('data-endfield-watermark') === 'persist') {
        // Centred in its own positioned parent — no per-frame measurement needed.
        return
      }
      const headline = findVisibleHeadline()
      if (!headline) return
      const r = headline.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const cy = r.top + r.height / 2
      const cx = r.left + r.width / 2
      const vw = (typeof window !== 'undefined' && window.innerWidth) || (typeof document !== 'undefined' ? document.documentElement.clientWidth : 0)
      // Half the logo box: 13vw wide (240px cap) x square aspect / 2 (see the
      // ::after sizing and the height calc in styleWatermark).
      const half = vw * 0.13 * 0.51
      const top = (cy - half) + 'px'
      const tx = 'translateX(' + (cx - vw / 2) + 'px)'
      // Only write when the value actually changed, so a stable layout costs nothing.
      if (watermarkEl.style.top !== top) watermarkEl.style.top = top
      if (watermarkEl.style.transform !== tx) watermarkEl.style.transform = tx
    }
    const watermarkRafLoop = () => {
      // Only the hero placement is measured per frame; persist mode is pure CSS, so
      // the loop must stop when the mode changes rather than spin for nothing.
      if (!watermarkEl || watermarkEl.getAttribute('data-endfield-watermark') !== 'hero') {
        watermarkRaf = null
        return
      }
      positionWatermark()
      watermarkRaf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(watermarkRafLoop) : null
    }
    const styleWatermark = (el, mode) => {
      const s = el.style
      s.display = 'flex'
      s.alignItems = 'center'
      s.justifyContent = 'center'
      s.pointerEvents = 'none'
      s.fontWeight = '900'
      s.letterSpacing = '0.1em'
      s.color = 'var(--dsw-alias-label-primary)'
      s.textTransform = 'uppercase'
      s.userSelect = 'none'
      /* Single-child mark: the official logo paints as the ::after mask. */
      /* The theme's own face, via its own variable. It used to read
         --dsw-font-family directly, which now points at the APP's stack (the
         theme no longer overrides that token) — so reading it here would silently
         un-style the wordmark. --edge-font is body-scoped and falls back to the
         same stack, so this element is themed with or without the token. */
      s.fontFamily = 'var(--edge-font)'
      /* Strength comes from a CSS variable, never a literal number, so the two
         colour schemes can carry DIFFERENT alphas (defined in the stylesheet) and
         a scheme flip simply re-resolves the variable — no observer, no repaint
         logic here. An inline numeric opacity would also outrank the stylesheet,
         which is exactly what made this value unthemeable before. */
      /* Opacity now lives on the ::before (letters) and ::after (emblem) rules in
         the stylesheet instead of on the element, for the same themeability
         reason as before (CSS variables, scheme-dependent values, no repaint on
         flip) plus one new one: the official emblem mask is a soft blur that
         needs a slightly HIGHER alpha than the letters to read as part of the
         same mark, and one element-level opacity cannot express that. */
      if (mode === 'hero') {
        s.position = 'fixed'
        s.left = '0'
        s.right = '0'
        s.top = ''
        s.bottom = ''
        /* Logo-only box: 13vw wide (240px cap) x the square viewBox. */
        s.height = 'calc(min(13vw, 240px) * 1.02)'
        /* z-index 0, NOT 1 — this is the fix for the wordmark painting on top of
           the app's own popovers, and the cause was a z-index TIE:
             the hero composer wrapper ('*_composerHero') is position:relative +
             z-index:1, so it IS a stacking context and the model-select menu's
             z-index:20 is trapped inside it; that 20 never competes at body level.
           The mark used to be z-index:1 too — the same level as composerHero in
           the root stacking context — and ties are broken by DOM order. Appended
           to <body> last, the mark won every tie and painted over the whole
           composer subtree, dropdown included (measured: 12027 changed pixels
           inside the opaque menu box, matching 11002 px found in a real capture).
           At 0 it loses to composerHero (1), the tabs (1) and the composer seat
           (7), yet still paints ABOVE the app frame's own opaque bg-base: the
           frame is position:relative with z-index:auto, so it creates no stacking
           context, both boxes paint in the same step, and the mark is still the
           later sibling. Verified by test/watermark-stacking.test.js. */
        s.zIndex = '0'
        s.fontSize = '9.5vw'
        s.transform = ''
      } else {
        // Fill the conversation column and sit behind its content. z-index:-1 paints
        // below in-flow text but still above the column's own background, which is
        // why the column is given `isolation: isolate` in the stylesheet: without a
        // stacking context there, -1 would slide behind that background and vanish.
        s.position = 'absolute'
        s.left = '0'
        s.right = '0'
        s.top = '0'
        s.bottom = '0'
        s.height = ''
        s.zIndex = '-1'
        s.fontSize = '9.5vw'
        s.transform = ''
      }
    }
    const syncWatermarkVisibility = () => {
      /* Streaming fast path. A mounted persist-mode mark is still correctly
         placed while (a) the switches that could turn it off are unchanged,
         (b) no hero root exists in the document and (c) its host is still
         attached — all three decidable WITHOUT a single getBoundingClientRect.
         The observer fires on every body mutation batch, so during token
         streaming this used to run the full mountPointFor() below (several
         querySelector(All) + rect reads = one forced layout) per frame. Any
         check failing here falls through to the full decision, so every real
         transition — theme off, hero appearing, host detached, persist flipped
         off — is still caught on the same batch. */
      if (watermarkEl !== null && watermarkHost !== null && watermarkHost.isConnected
        && typeof document !== 'undefined'
        && watermarkEl.getAttribute('data-endfield-watermark') === 'persist'
        && isEnabled() && isWatermarkOn() && isWatermarkPersistOn()
        && document.querySelector('[class$="_root"][data-phase="hero"]') === null) return
      const on = isEnabled() && isWatermarkOn()
      const target = on ? mountPointFor() : null
      // Off the hero page the mark only survives when the persist switch is on.
      // parent can be null during very early boot (no <body> yet) — never mount.
      const shouldShow = target !== null && target.parent !== null
        && (target.mode === 'hero' || isWatermarkPersistOn())
      if (shouldShow && watermarkEl) {
        // A page change can flip the mode or move the parent — restyle/reparent in place.
        if (watermarkEl.getAttribute('data-endfield-watermark') !== target.mode) {
          watermarkEl.setAttribute('data-endfield-watermark', target.mode)
          styleWatermark(watermarkEl, target.mode)
        }
        if (watermarkHost !== target.parent) {
          target.parent.appendChild(watermarkEl)
          watermarkHost = target.parent
        }
      } else if (shouldShow && !watermarkEl) {
        const el = document.createElement('div')
        el.setAttribute('data-endfield-watermark', target.mode)
        /* Translation-proofing. The wordmark is a brand name that must never be
           rewritten by Chrome/Edge "translate this page", a Google Translate widget
           or a translator extension.
           The real defence is structural: the glyphs come from CSS `content` on a
           ::before (see the stylesheet), so there is NO DOM text node to translate —
           text-walking translators cannot see it at all. The attributes below are the
           declarative belt-and-braces for anything that inspects the element itself:
             translate="no"   — the HTML5 opt-out honoured by Chrome/Edge translate
             class notranslate — Google Translate's own opt-out hook
             lang="en"        — stops "this looks like Chinese page text" heuristics
           aria-hidden keeps a purely decorative mark out of the accessibility tree. */
        el.setAttribute('translate', 'no')
        el.setAttribute('lang', 'en')
        el.setAttribute('aria-hidden', 'true')
        el.className = 'notranslate'
        styleWatermark(el, target.mode)
        target.parent.appendChild(el)
        watermarkEl = el
        watermarkHost = target.parent
      } else if (!shouldShow && watermarkEl) {
        if (watermarkEl.parentNode) watermarkEl.parentNode.removeChild(watermarkEl)
        watermarkEl = null
        watermarkHost = null
      }
      // While visible, follow the headline every frame (page switches, sidebar
      // width changes, animations) — no reliance on observer timing. The persist
      // placement is pure CSS, so it needs no frame loop.
      const needsLoop = watermarkEl !== null && watermarkEl.getAttribute('data-endfield-watermark') === 'hero'
      if (needsLoop && !watermarkRaf && typeof requestAnimationFrame === 'function') {
        watermarkRaf = requestAnimationFrame(watermarkRafLoop)
      } else if (!needsLoop && watermarkRaf !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(watermarkRaf)
        watermarkRaf = null
      }
    }
    const onWatermarkResize = () => { if (watermarkEl) positionWatermark() }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', onWatermarkResize)
    }
    let watermarkObserver = null
    /* The bundle can be evaluated before <body> exists (the same window runLoader
       defends with a DOMContentLoaded deferral). The old code created the observer
       only when body was already there and never retried, so an early-boot apply
       left the watermark without its (re)attach channel
       for good. Deferred install instead, and right after installing, catch up on
       everything the observer missed while it did not exist yet. */
    const installWatermarkObserver = () => {
      if (watermarkObserver !== null) return
      if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || document.body === null) return
      watermarkObserver = new MutationObserver(() => {
        syncWatermarkVisibility()
      })
      watermarkObserver.observe(document.body, { childList: true, subtree: true })
    }
    const watermarkObserverLate = () => {
      installWatermarkObserver()
      if (watermarkObserver === null) return
      syncWatermarkVisibility()
    }
    if (typeof document !== 'undefined' && document.body !== null) installWatermarkObserver()
    else if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('DOMContentLoaded', watermarkObserverLate, { once: true })
    }

    /* ---------- scheme + motion + frame helpers ------------------------------
       These three used to live inside the contour engine; the feature is gone
       but the watermark, loader and thunder code still read them. */
    const isDarkScheme = () => typeof document !== 'undefined'
      && document.body
      && document.body.hasAttribute('data-ds-dark-theme')

    /* Someone who asked the OS for less motion gets the pattern without the motion.
       The boot plate and the thunder entrance both honour this; checked live
       rather than cached so changing the OS setting takes effect on the next
       reconciliation. */
    const prefersReducedMotion = () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const findAppFrame = () => {
      if (typeof document === 'undefined') return null
      const col = document.querySelector('[class$="_centerCol"], [class*="_centerCol "]')
      const frame = col !== null ? col.parentElement : null
      if (frame === null) return null
      const r = frame.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return null
      return frame
    }

    // DOM sampling stays outside the extraction kernel, which remains usable
    // by headless geometry tests and future renderers with explicit trail input.
    /* ---------- boot loading screen (settings-toggleable, default OFF) ----------
       Recreates the Endfield launcher boot screen: a full-viewport black plate with
       an 8px signal-yellow progress rail down the left edge, a meter group (tick +
       percentage + status line) that rides the fill end, and the centred ENDFIELD
       wordmark. It plays once per page load, then fades out and removes itself.

       Default OFF as requested: a loading plate that covers the app is opt-in, and
       an off switch must cost nothing, so nothing is built or timed until enabled.

       Geometry is not guessed — it is measured off the reference frame (1340x731):
         rail width 8px, fill 57.5% of viewport height at the captured moment,
         meter left edge x=24, tick 4x15px, digits cap-height 28px (~39px Arial),
         status line 15px below the digits in #666.
       Those ratios are reproduced here as em/percentage values so they hold at any
       viewport size. */
    const LOADER_KEY = 'dsh-theme-endfield-loader'
    // Default OFF (=== '1' rather than !== '0'): opt-in, per the request.
    const isLoaderOn = () => prefsGet(LOADER_KEY) === '1'
    let loaderEl = null
    let loaderRaf = null
    let loaderTick = null
    let loaderFuse = null
    let loaderExitTimer = null
    let loaderPlateH = 0
    let loaderMeterH = 0
    // Last-resort hard kill. Deliberately NOT cleared by clearLoaderTimers(): the
    // completion flourish calls that to stop the progress clocks, and this timer has
    // to outlive it so a stalled flourish can still never leave the app covered.
    let loaderKill = null
    let loaderDone = false
    const clearLoaderTimers = () => {
      if (loaderRaf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(loaderRaf)
      loaderRaf = null
      if (loaderTick !== null && typeof clearInterval === 'function') clearInterval(loaderTick)
      loaderTick = null
      if (loaderFuse !== null && typeof clearTimeout === 'function') clearTimeout(loaderFuse)
      loaderFuse = null
      if (loaderExitTimer !== null && typeof clearTimeout === 'function') clearTimeout(loaderExitTimer)
      loaderExitTimer = null
    }
    /** Remove the plate and release every timer/handle it owns. Idempotent. */
    const destroyLoader = () => {
      clearLoaderTimers()
      if (loaderKill !== null && typeof clearTimeout === 'function') clearTimeout(loaderKill)
      loaderKill = null
      if (loaderEl && loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl)
      loaderEl = null
      loaderPlateH = 0
      loaderMeterH = 0
    }
    /* One boot animation. The progress value is derived from elapsed WALL-CLOCK time,
       never accumulated per frame, so it cannot drift.

       Two clocks drive the same `step`, deliberately:
         requestAnimationFrame — smooth, vsync-aligned updates while the tab paints;
         setInterval           — a coarse fallback that keeps advancing when rAF is
                                 throttled or suspended (background/occluded tab, an
                                 embedded webview, a headless renderer that stops
                                 painting after first paint).
       rAF alone is NOT safe here: when it stalls, a full-screen plate would stay on
       screen forever. Because progress is time-based and `step` is idempotent for a
       given instant, running from both clocks is harmless — whichever fires first
       just renders the current value.

       `loaderFuse` is the last line of defence: a single timeout that force-finishes
       the plate even if both clocks stop, so the app can never stay covered. */
    /* 启动加载动画音. The sound is played by the HOST (lib/audio.js) — the page
       only reports that the plate started, so volume, debounce, the custom-sound
       directory and the slot switch all stay in one place. `audioBootSent` makes
       this exactly once per page load, which is the loader's own contract: the
       预览 button re-runs the plate deliberately and must not re-ring a boot
       sound, and neither must a toggle-on. */
    let audioBootSent = false
    const playBootChime = () => {
      if (audioBootSent) return
      audioBootSent = true
      // Master switch, slot switch and volume are the host's call; the page only
      // avoids the round-trip when the feature is switched off outright.
      if (typeof isAudioOn === 'function' && !isAudioOn()) return
      try {
        previewSlot('boot').catch(() => { /* host bridge absent: boot stays silent */ })
      } catch (e) { /* keep going */ }
    }
    const runLoader = () => {
      // The plate is themed BY this theme: with the master switch off its
      // stylesheet is gone and the plate would render as stray unstyled text in
      // the page flow (the percentage and status rows are real DOM text), so an
      // off switch must not be able to start it — including the settings 预览
      // button and the toggle-on path, which both land here.
      if (!isEnabled()) return
      if (loaderDone || loaderEl !== null) return
      if (typeof document === 'undefined') return
      // The plate is a <body> child. If the client bundle is evaluated before the
      // body exists, defer to DOMContentLoaded instead of silently skipping the
      // animation (loaderDone stays false, so the retry is the real first run).
      if (!document.body) {
        if (typeof document.addEventListener === 'function') {
          document.addEventListener('DOMContentLoaded', () => { runLoader() }, { once: true })
        }
        return
      }
      loaderDone = true
      playBootChime()

      const el = document.createElement('div')
      el.setAttribute('data-endfield-loader', '')
      // Same translation-proofing as the watermark: every glyph the plate shows is
      // brand/UI chrome drawn from CSS `content` or set as textContent on elements
      // marked notranslate, so "translate this page" cannot rewrite ENDFIELD.
      el.setAttribute('translate', 'no')
      el.setAttribute('lang', 'en')
      el.setAttribute('aria-hidden', 'true')
      el.className = 'notranslate'
      /* Poster layout, following the supplied key-art reference (1184x685).
         The brand block is a LEFT-aligned stack that sits in the right third of
         the plate: kicker, END, FIELD, then a detail cluster and the tagline, all
         sharing one left rhythm line. No localized chip — the reference wordmark is
         latin-only, so every glyph here comes from CSS content() and the plate
         carries no translatable DOM text at all.
         The meter (tick + percent + status) RIDES THE FILL END: its top follows the
         rail's fill height, matching the launcher reference where the readout sits
         just under the leading edge of the yellow bar.
         `-wipe` is the completion flourish: once the rail reaches 100% it expands
         from the rail into a full-screen yellow sweep to the right, then the whole
         plate fades out. It is a separate layer so the sweep can cover the brand
         block and meter without disturbing their layout. */
      el.innerHTML =
        '<div data-endfield-loader-tex></div>' +
        '<div data-endfield-loader-track></div>' +
        '<div data-endfield-loader-fill></div>' +
        '<div data-endfield-loader-meter>' +
        '<span data-endfield-loader-tick></span>' +
        '<span data-endfield-loader-pct></span>' +
        '<span data-endfield-loader-status></span>' +
        '</div>' +
        '<div data-endfield-loader-brand>' +
        '<span data-endfield-loader-kicker></span>' +
        '<span data-endfield-loader-word data-endfield-loader-word1></span>' +
        '<span data-endfield-loader-word data-endfield-loader-word2></span>' +
        '<span data-endfield-loader-detail>' +
        '<span data-endfield-loader-chev></span>' +
        '<span data-endfield-loader-sub></span>' +
        '<span data-endfield-loader-seq></span>' +
        '<span data-endfield-loader-squares>' +
        '<i data-on></i><i data-on></i><i data-on></i><i></i><i></i><i></i>' +
        '<i data-on></i><i data-on></i><i></i><i></i><i></i><i></i>' +
        '</span>' +
        '</span>' +
        '<span data-endfield-loader-tag></span>' +
        '</div>' +
        '<div data-endfield-loader-wipe></div>'
      document.body.appendChild(el)
      loaderEl = el

      const fill = el.querySelector('[data-endfield-loader-fill]')
      const meter = el.querySelector('[data-endfield-loader-meter]')
      const pct = el.querySelector('[data-endfield-loader-pct]')
      const status = el.querySelector('[data-endfield-loader-status]')
      const DURATION = 1750
      const start = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now()
      loaderPlateH = el.clientHeight || Math.ceil(el.getBoundingClientRect().height) || 0
      loaderMeterH = meter ? Math.ceil(meter.getBoundingClientRect().height) : 0
      const now = () => ((typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now())
      /* Completion sequence, in order:
           WIPE_MS  the rail expands rightward into a full-screen yellow sweep;
           EXIT_MS  the whole plate (yellow included) fades to transparent.
         The fuse below must outlast WIPE_MS + EXIT_MS, or it would tear the plate
         down mid-flourish. */
      const WIPE_MS = 520
      const EXIT_MS = 620
      let finished = false
      /* Play the yellow sweep, then fade out, then remove. Guarded so the two clocks
         plus the fuse can all reach the end without stacking timers, restarting the
         sweep, or double-removing the node.

         Both phases are driven from JS on the same dual-clock/wall-clock basis as
         the progress ramp, NOT from a CSS transition. Measured reason: a CSS
         transition is not a reliable animation primitive in every renderer this
         plate can run in — in the verification renderer a transition declared this
         way emitted no transitionrun/start/end events at all and the computed width
         stayed pinned at its start value indefinitely, which would leave a 10px
         stub on screen instead of a sweep. Driving it here means the flourish
         advances wherever the progress ramp advances, and it stays measurable. */
      const finish = () => {
        if (finished) return
        finished = true
        // Stop the progress clocks but keep the plate: the flourish reuses these
        // handles, so clearLoaderTimers() must not be what tears the node down.
        clearLoaderTimers()
        if (!loaderEl) return
        const el = loaderEl
        const wipeEl = el.querySelector('[data-endfield-loader-wipe]')
        const hasRaf = typeof requestAnimationFrame === 'function'
        const hasTimeout = typeof window !== 'undefined' && typeof window.setTimeout === 'function'
        // Someone who asked for less motion gets the plate gone, not a flourish.
        const reduceMotion = typeof window !== 'undefined'
          && typeof window.matchMedia === 'function'
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduceMotion || (!hasRaf && !hasTimeout)) { destroyLoader(); return }
        el.setAttribute('data-endfield-loader-wiping', '')
        // JS owns opacity from here, so the stylesheet transition must not fight it.
        el.style.transition = 'none'
        const t0 = now()
        const plateW = el.clientWidth || 0
        const RAIL = 10
        let exitMarked = false
        const flourish = () => {
          if (!loaderEl) return
          const elapsed = now() - t0
          // phase 1 — sweep out of the rail across the full width
          const wt = Math.min(1, elapsed / WIPE_MS)
          const eased = 1 - Math.pow(1 - wt, 3)
          if (wipeEl) {
            wipeEl.style.opacity = '1'
            wipeEl.style.width = (RAIL + eased * Math.max(0, plateW - RAIL)).toFixed(1) + 'px'
          }
          // phase 2 — fade the whole plate, yellow included
          const fadeMs = elapsed - WIPE_MS
          if (fadeMs > 0) {
            if (!exitMarked) { exitMarked = true; el.setAttribute('data-endfield-loader-exit', '') }
            el.style.opacity = Math.max(0, 1 - fadeMs / EXIT_MS).toFixed(3)
          }
          if (elapsed >= WIPE_MS + EXIT_MS) { destroyLoader(); return }
          loaderRaf = hasRaf ? requestAnimationFrame(flourish) : null
        }
        // First frame synchronously so the sweep never starts from a blank frame.
        flourish()
        if (typeof setInterval === 'function') loaderTick = setInterval(flourish, 30)
        if (hasTimeout) loaderExitTimer = window.setTimeout(destroyLoader, WIPE_MS + EXIT_MS + 400)
      }
      const step = () => {
        if (finished || !loaderEl) return
        const t = Math.min(1, (now() - start) / DURATION)
        // easeOutCubic: quick climb, gentle settle onto 100%.
        const eased = 1 - Math.pow(1 - t, 3)
        const value = Math.round(eased * 100)
        const shown = value + '%'
        if (fill) fill.style.height = (eased * 100).toFixed(2) + '%'
        if (pct && pct.textContent !== shown) pct.textContent = shown
        if (status) {
          const label = value < 45 ? 'Connecting...' : (value < 99 ? 'Updating...' : 'Ready')
          if (status.textContent !== label) status.textContent = label
        }
        /* Meter follows the fill's leading edge, driven by the SAME eased value so
           the bar and its readout can never disagree. Positioned in px and clamped:
           the group is ~90px tall, so a raw percentage would push it off the bottom
           of the screen as the fill nears 100%. GAP keeps the tick just below the
           leading edge (per the reference, the readout trails the edge). Measure
           after updating the text: the initial empty meter is much shorter than the
           completed percentage/status group and would otherwise make 100% overflow.
           Keep extra room below the line box because the percentage uses a compact
           line-height and its glyphs can paint below that box. */
        if (meter) {
          const SAFE_BOTTOM = 64
          if (value >= 100) {
            /* Anchor the completed readout from the bottom. At this point the
               percentage and status have their final font metrics, so bottom
               anchoring is more reliable than clamping a cached top position. */
            meter.style.setProperty('top', 'auto', 'important')
            meter.style.setProperty('bottom', SAFE_BOTTOM + 'px', 'important')
          } else {
            meter.style.removeProperty('bottom')
            meter.style.removeProperty('top')
            const plateRect = el.getBoundingClientRect()
            loaderMeterH = Math.ceil(meter.getBoundingClientRect().height)
            const GAP = 10
            const raw = eased * (plateRect.height || loaderPlateH) + GAP
            const maxTop = Math.max(0, (plateRect.height || loaderPlateH) - loaderMeterH - SAFE_BOTTOM)
            meter.style.top = Math.min(raw, maxTop).toFixed(1) + 'px'
            /* Use the rendered rectangle as the final authority. Font metrics and
               fractional viewport sizes can make the line box differ from the
               cached height, especially in a narrow window. Correct any remaining
               overflow instead of allowing the readout to be clipped. */
            const meterRect = meter.getBoundingClientRect()
            const allowedBottom = plateRect.bottom - SAFE_BOTTOM
            if (meterRect.bottom > allowedBottom) {
              const currentTop = parseFloat(meter.style.top) || 0
              meter.style.top = Math.max(0, currentTop - meterRect.bottom + allowedBottom).toFixed(1) + 'px'
            }
          }
        }
        if (t >= 1) {
          el.setAttribute('data-endfield-loader-complete', '')
          // Hold the completed frame for a beat so 100% is actually readable.
          if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
            if (loaderExitTimer === null) loaderExitTimer = window.setTimeout(finish, 220)
          } else finish()
          return
        }
        loaderRaf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(step) : null
      }
      // Paint the first frame synchronously: the plate must never flash at 0%/empty.
      step()
      // Clock 2: coarse fallback that survives rAF throttling.
      if (typeof setInterval === 'function') loaderTick = setInterval(step, 60)
      if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
        // Fuse: if both progress clocks stall, force the completion sequence.
        loaderFuse = window.setTimeout(() => { finished = false; finish() }, DURATION + 1600)
        // Hard kill: covers the flourish itself stalling (a suspended tab can hold a
        // CSS transition indefinitely). Outlasts fuse + wipe + fade, then removes the
        // node unconditionally, so the app can never stay covered.
        loaderKill = window.setTimeout(destroyLoader, DURATION + 1600 + WIPE_MS + EXIT_MS + 400)
      } else if (loaderRaf === null && loaderTick === null) {
        destroyLoader()
      }
    }

    /* The first authoritative settings section can land AFTER apply() has run (the
       Host serves it over the wire), and until it does every prefsGet falls back
       to the schema default — for the loader that default is '0' ("default off"),
       so the boot-time call in apply() is a silent no-op and the plate never plays
       however the user has it stored. That is the whole "the startup animation
       stopped appearing" symptom, and it is invisible to any test whose fixture
       scope answers 'ready' from the first synchronous read.

       This closes the window. The store calls it once, on the first real section
       of the page load — which IS the "once per page load" moment the boot-time
       call is trying to hit — and the guards below keep every other case out:
         - a section that changes LATER (another window, a reverting host) never
           reaches here at all, because the store fires this hook only once;
         - a plate already played or mid-play is left alone;
         - a user who has answered this question in-session (the settings toggle)
           outranks a section that was still in flight when they answered it. What
           enforces that is prefsGetValue overlaying prefsLocalEdited, so
           isLoaderOn() already reads the session value; the prefsEdited check
           below merely pins the same intent at this call site instead of leaning
           on the overlay's internals. The plain 预览 button needs neither guard:
           runLoader() sets loaderDone the instant it starts. */
    onPrefsSettled = () => {
      if (loaderDone || loaderEl !== null) return
      if (prefsEdited.has('loader')) return
      if (!isEnabled()) return
      if (!isLoaderOn()) return
      runLoader()
    }

    /* ---------- 雷霆大字 (娱乐模式, default OFF) ----------
       A task-boundary announcement: when a turn starts, 「任务开始」 slams into the
       middle of the screen in heavy white type; when it ends, 「任务完成」 does the
       same. Each stays for exactly 3s and removes itself.

       WHERE THE SIGNAL COMES FROM. This is turn-level state, not tool-level, so it
       reads the ONE authoritative bit: ConversationSnapshot.running on the current
       session (@deepseek-ai/dsh-client-runtime — the same field the app's own
       turn-status label and stop button switch on). No DOM sniffing: the class
       hashes those surfaces carry are not a contract, and a spinner appearing is
       not the same event as a turn starting.

       Reached through ctx.get('sessions'), NOT inject: the theme must still mount
       when the sessions service is absent (the in-process settings tests supply a
       ctx with only theme/slots), and a missing service means "no announcements",
       not "no theme".

       EDGES, NOT LEVELS. Only a false->true / true->false transition announces. The
       first readable value of a session is recorded as a BASELINE and stays silent,
       which is what stops 「任务开始」 from firing merely because the user switched
       into a session that was already running. */
    const THUNDER_KEY = 'dsh-theme-endfield-thunder'
    /* The slam-in animation is its OWN switch, default OFF — same shape as
       等高线背景 → 动态等高线: the layer is one decision, animating it is another.
       With it off the word still appears instantly, holds 3s and leaves; only the
       scale punch and the fade are dropped. */
    const THUNDER_ANIM_KEY = 'dsh-theme-endfield-thunder-anim'
    const THUNDER_START = '任务开始'
    const THUNDER_DONE = '任务完成'
    // Hold time, per the request: visible for 3s, then gone.
    const THUNDER_MS = 3000
    // Default OFF (=== '1' rather than !== '0'): opt-in, like the boot animation.
    const isThunderOn = () => prefsGet(THUNDER_KEY) === '1'
    // Default OFF for the same reason, and read independently of the parent switch.
    const isThunderAnimOn = () => prefsGet(THUNDER_ANIM_KEY) === '1'
    /* The OS preference still wins over an enabled animation switch. Checked
       live rather than cached, so changing the OS setting takes effect on the
       next announcement. */
    const thunderWantsAnim = () => isThunderAnimOn() && !prefersReducedMotion()
    let thunderEl = null
    let thunderTimer = null
    // Detaches the click-to-dismiss listener; null when none is armed.
    let thunderDismiss = () => {}
    /** Remove the plate and release its timer and listener. Idempotent. */
    const destroyThunder = () => {
      if (thunderTimer !== null && typeof clearTimeout === 'function') clearTimeout(thunderTimer)
      thunderTimer = null
      /* Detach BEFORE removing the node, and reset the handle first so the listener
         calling back into here cannot re-enter this line. */
      const detach = thunderDismiss
      thunderDismiss = () => {}
      detach()
      if (thunderEl && thunderEl.parentNode) thunderEl.parentNode.removeChild(thunderEl)
      thunderEl = null
    }
    /* Announce one word. A second call inside the 3s window REPLACES the first
       (turn/end immediately followed by a queued turn/start is a real sequence), so
       the node is rebuilt rather than reused — that restarts the CSS animation,
       which merely re-setting textContent would not. */
    const showThunder = (text) => {
      if (!isEnabled() || !isThunderOn()) return
      if (typeof document === 'undefined' || !document.body) return
      destroyThunder()
      const el = document.createElement('div')
      el.setAttribute('data-endfield-thunder', '')
      // Pure decoration over content the user is already reading: never announced,
      // never hit-tested (pointer-events:none lives in the stylesheet).
      el.setAttribute('aria-hidden', 'true')
      /* No animation: the word appears at full size and full opacity, holds, then is
         removed by the timer below. Two independent reasons land on this same static
         path — the animation switch being off (the default) and the OS asking for
         reduced motion — so both go through thunderWantsAnim(). */
      if (!thunderWantsAnim()) el.setAttribute('data-endfield-thunder-still', '')
      const word = document.createElement('span')
      word.setAttribute('data-endfield-thunder-word', '')
      word.textContent = text
      el.appendChild(word)
      document.body.appendChild(el)
      thunderEl = el
      /* CLICK ANYWHERE TO DISMISS EARLY, without waiting out the 3s.

         Listening on the DOCUMENT rather than on the plate is the whole point. The
         plate is pointer-events:none on purpose (it is a caption laid over text the
         user may be mid-sentence in, not a modal), and making it clickable would turn
         it into a full-screen click-eater for 3 seconds: the dismissing click would
         be swallowed instead of reaching whatever the user actually aimed at. With a
         document listener the click BOTH dismisses the word and lands normally, so
         clicking blank space costs nothing and clicking a control still works.

         pointerdown, not click, for two reasons: it covers mouse/touch/pen in one
         event, and it fires on press so the word disappears the instant the user
         acts. It also cannot self-dismiss when 预览 triggers this from a button's
         click handler — that interaction's pointerdown has already been dispatched
         before this listener exists, and a later click event does not re-fire it.

         Capture phase so an app handler calling stopPropagation cannot make the word
         undismissable. */
      if (typeof document.addEventListener === 'function' && typeof document.removeEventListener === 'function') {
        const onPointerDown = () => { destroyThunder() }
        document.addEventListener('pointerdown', onPointerDown, true)
        thunderDismiss = () => { document.removeEventListener('pointerdown', onPointerDown, true) }
      }
      // No timer available (a stripped test host) must not leave the plate up.
      if (typeof setTimeout === 'function') thunderTimer = setTimeout(destroyThunder, THUNDER_MS)
      else destroyThunder()
    }

    /* Resolved LAZILY, never cached at apply() time. The web boot mounts every
       plugin row concurrently (`Promise.all` over the manifest in dsh-web-frontend)
       and this theme declares no `inject`, so apply() can legitimately run before
       dsh-client-runtime has provided `sessions`. A one-shot `const sessions =
       ctx.get('sessions')` here would capture undefined for the whole session and
       the feature would be permanently dead depending on load order — the exact
       kind of race that only shows up on a slow or cold page load.

       Declaring inject: ['sessions'] is the other valid fix, but it would put the
       WHOLE THEME into cordis' pending state until that service appears, which
       would delay the token/stylesheet mount that everything else here depends on.
       A theme must paint even if the announcement feature never gets its service,
       so the lookup is deferred instead and re-tried on the retry timer below. */
    const getSessions = () => {
      const s = ctx.get('sessions')
      return (s === undefined || s === null) ? undefined : s
    }
    let thunderUnsubList = null
    let thunderUnsubSession = null
    let thunderRebindTimer = null
    /* Retry budget for thunderRebind, bounded like every other retry in this
       file (rebindPrefs 40, settle watch 20): a permanently absent sessions
       service must not leave a 120 ms poll running for the life of the page.
       A settings change re-runs syncThunder -> thunderRebind, which restarts
       the budget. */
    let thunderRebindAttempts = 0
    let thunderWatchedId = null
    // null = nothing readable observed yet, so the next value is a baseline.
    let thunderLastRunning = null
    /** The running bit of one session face, or null when it cannot be read. */
    const thunderReadRunning = (face) => {
      try {
        const snap = face.getSnapshot()
        if (snap === null || typeof snap !== 'object') return null
        return snap.running === true
      } catch (e) {
        return null
      }
    }
    const thunderDetach = () => {
      if (thunderUnsubSession !== null) {
        try { thunderUnsubSession() } catch (e) { /* already torn down */ }
        thunderUnsubSession = null
      }
      thunderWatchedId = null
      thunderLastRunning = null
    }
    /** Subscribe to selection changes once; idempotent. */
    const thunderSubscribeList = (sessions) => {
      if (thunderUnsubList !== null) return
      let unsub = null
      try { unsub = sessions.list.subscribe(() => { thunderRebind() }) } catch (e) { unsub = null }
      thunderUnsubList = (typeof unsub === 'function') ? unsub : null
    }
    /* Follow the CURRENT session. `sessions.list` publishes the selection, and the
       runtime's own list subscriber (registered at construction, so it runs first)
       stages the session that makes binding() resolve. A miss here is therefore
       ordinary timing rather than an error, so it retries on a short timer instead
       of giving up — that single deferred retry is also what covers the very first
       reconcile during boot, before any session is staged. */
    const thunderRebind = () => {
      const sessions = getSessions()
      if (thunderRebindTimer !== null && typeof clearTimeout === 'function') clearTimeout(thunderRebindTimer)
      thunderRebindTimer = null
      /* Service not there yet: keep retrying rather than giving up for good, since
         the only reason to be here is that the feature is switched on — but only
         within the budget above. */
      if (sessions === undefined) {
        if (thunderRebindAttempts >= 100) {
          dbg('thunder rebind gave up: no sessions service after', thunderRebindAttempts, 'tries')
          return
        }
        thunderRebindAttempts += 1
        if (typeof setTimeout === 'function') thunderRebindTimer = setTimeout(thunderRebind, 120)
        return
      }
      // The list subscription may have been skipped earlier (no service then), so
      // attach it as soon as one exists.
      thunderSubscribeList(sessions)
      let id
      try {
        const snap = sessions.list.getSnapshot()
        id = (snap === null || typeof snap !== 'object') ? undefined : snap.current
      } catch (e) {
        return
      }
      if (id === undefined || id === null) {
        thunderDetach()
        return
      }
      /* Already watching this one: skip the detach/resubscribe churn. `sessions.list`
         publishes for every unrelated reason (a title change, a job row, a sidebar
         refresh), and rebinding on each one would tear down and re-add the same
         subscription constantly.

         Deliberately NOT claimed as an edge-correctness guard: the reseed would be
         synchronous, so `running` cannot change inside the gap and the baseline
         would land on the value it already held. Verified by removing this line —
         the edge assertions still pass. It is a cost guard, and it is honest about
         being one. */
      if (id === thunderWatchedId && thunderUnsubSession !== null) return
      thunderDetach()
      let face = null
      try {
        const binding = sessions.binding(id)
        if (binding !== undefined && binding !== null) face = binding.session
      } catch (e) {
        face = null
      }
      if (face === null || typeof face.subscribe !== 'function' || typeof face.getSnapshot !== 'function') {
        if (thunderRebindAttempts >= 100) {
          dbg('thunder rebind gave up: session face never became bindable for', id)
          return
        }
        thunderRebindAttempts += 1
        if (typeof setTimeout === 'function') thunderRebindTimer = setTimeout(thunderRebind, 120)
        return
      }
      thunderRebindAttempts = 0
      thunderWatchedId = id
      thunderLastRunning = thunderReadRunning(face)
      let unsub = null
      try {
        unsub = face.subscribe(() => {
          const next = thunderReadRunning(face)
          if (next === null || next === thunderLastRunning) return
          const prev = thunderLastRunning
          thunderLastRunning = next
          // First readable value is the baseline, not an edge — see the note above.
          if (prev === null) return
          showThunder(next ? THUNDER_START : THUNDER_DONE)
          // Falling edge is also the notification module's 任务完成 trigger:
          // the SAME authoritative bit, one subscription, two consumers.
          if (!next) showNotify('done')
        })
      } catch (e) {
        unsub = null
      }
      thunderUnsubSession = (typeof unsub === 'function') ? unsub : null
      if (thunderUnsubSession === null) thunderWatchedId = null
    }
    const thunderStopWatch = () => {
      if (thunderRebindTimer !== null && typeof clearTimeout === 'function') clearTimeout(thunderRebindTimer)
      thunderRebindTimer = null
      thunderRebindAttempts = 0
      if (thunderUnsubList !== null) {
        try { thunderUnsubList() } catch (e) { /* already torn down */ }
        thunderUnsubList = null
      }
      thunderDetach()
    }
    /* Switched off costs nothing: no subscription, no timer, no plate — an off
       switch must not leave a listener behind that wakes on every streamed
       token just to return early. The watch is now shared with the notify
       module's 任务完成 trigger, so it stays armed while EITHER feature is on
       (showThunder and showNotify both self-guard, so the idle consumer is a
       no-op call, not a second subscription). */
    const syncThunder = () => {
      if (!(isEnabled() && (isThunderOn() || isNotifyDoneOn()))) {
        thunderStopWatch()
        destroyThunder()
        return
      }
      // thunderRebind() resolves the service itself and re-arms its own retry, so
      // there is nothing to check here — being switched on is the whole condition.
      thunderRebind()
    }

    /* ---------- 需要你回应 watcher ----------
       A coarse poll rather than a MutationObserver. The reason is the failure mode
       rather than the cost: an observer watching a container that the app later
       replaces (or an anchor that renders before `document.body` exists) stops
       delivering and cannot tell anyone, while a poll that asks "is a confirmation
       box on screen?" keeps working through any re-render, and its only symptom is
       up to `AUDIO_ATTENTION_POLL_MS` of latency — imperceptible for a chime.

       The edge is "a box is on screen after a moment where none was". A box that
       stays open does not re-report, so a forgotten dialog cannot beep forever; and
       a re-render that briefly drops the node and puts it back would re-report, so
       the poll is deliberately slower than a React remount. Whatever still slips
       through lands on the host's per-slot debounce, which is the backstop for
       every path. */
    /* Detection is edge-triggered on a MutationObserver, with a slow poll as the
       backstop. The first version polled alone at 400ms, which stacked its
       worst-case latency on top of the ~200-400ms it takes the host to cold-start
       the player process — the user measured the total as "a bit delayed". The
       observer cuts the first term to roughly one animation frame; the poll stays
       because an observer bound to a container the app later replaces would stop
       delivering silently, and a poll cannot. Its period is deliberately longer
       than a React remount, so a re-render that briefly drops and re-adds the node
       cannot register as two separate boxes. */
    const AUDIO_ATTENTION_POLL_MS = 1000
    /* The app mutates the DOM continuously while a turn streams, so a mutation
       cannot run the query on its own frame: it only schedules one. Coalescing on
       the next frame keeps the check off the render path and collapses a burst of
       mutations into a single look. */
    let audioAttentionTimer = null
    let audioAttentionObserver = null
    let audioAttentionFrame = null
    let audioAttentionKind = null
    const audioAttentionTick = () => {
      try {
        const kind = detectPendingInteraction()
        if (kind === null) {
          // Resolution clears every sticky notification: the question was
          // answered / the approval decided, so the card has no reason to stay.
          if (audioAttentionKind !== null) notifyResolveAttention()
          audioAttentionKind = null
          return
        }
        if (kind === audioAttentionKind) return
        audioAttentionKind = kind
        // Visual half of the same event (self-guarded on the notify switches).
        showNotify(kind)
        if (!isAudioOn()) return
        reportAttention(kind)
      } catch (e) { /* never let the watcher break the page */ }
    }
    /** Collapse a burst of mutations into one look on the next frame. */
    const audioAttentionSchedule = () => {
      if (audioAttentionFrame !== null) return
      if (typeof requestAnimationFrame !== 'function') {
        audioAttentionTick()
        return
      }
      audioAttentionFrame = requestAnimationFrame(() => {
        audioAttentionFrame = null
        audioAttentionTick()
      })
    }
    const syncAudioAttentionWatch = () => {
      /* The watch now serves TWO consumers: the audio chime and the visual
         notification, so it must run when EITHER is switched on. The notify
         master alone is not enough — all three kind switches could be off. */
      const notifyWantsWatch = isNotifyOn() && (isNotifyQuestionOn() || isNotifyApproveOn())
      const wanted = isEnabled() && (isAudioOn() || notifyWantsWatch)
      if (wanted && audioAttentionTimer === null && typeof setInterval === 'function') {
        audioAttentionKind = null
        audioAttentionTimer = setInterval(audioAttentionTick, AUDIO_ATTENTION_POLL_MS)
        if (typeof MutationObserver === 'function' && typeof document !== 'undefined' && document.body) {
          audioAttentionObserver = new MutationObserver(audioAttentionSchedule)
          try {
            audioAttentionObserver.observe(document.body, { childList: true, subtree: true })
          } catch (e) {
            audioAttentionObserver = null
          }
        }
        audioAttentionTick()
      } else if (!wanted && audioAttentionTimer !== null) {
        stopAudioAttentionWatch()
      }
    }
    const stopAudioAttentionWatch = () => {
      if (audioAttentionTimer !== null && typeof clearInterval === 'function') clearInterval(audioAttentionTimer)
      audioAttentionTimer = null
      if (audioAttentionObserver !== null) {
        try { audioAttentionObserver.disconnect() } catch (e) { /* already gone */ }
        audioAttentionObserver = null
      }
      if (audioAttentionFrame !== null) {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(audioAttentionFrame)
        audioAttentionFrame = null
      }
      audioAttentionKind = null
    }
    // Exposed so the watcher test can drive the mutation path (the observer's own
    // callback in a browser) without a real MutationObserver.
    module.exports.__attentionCheck = audioAttentionTick
    module.exports.__attentionSchedule = audioAttentionSchedule

    /* ---------- 终末地工业风通知 ----------------------------------------------
       Three triggers, one visual language: 任务完成 (turn end, from the SAME
       ConversationSnapshot.running edge the thunder announcement reads) and
       提问 / 索权 (the attention watcher's question / approval / plan-review
       kinds). Sound is NOT re-implemented: the existing audio slots already fire
       for exactly these moments (attention via reportAttention above, turn end
       via the host's own listener), so a notification is the VISUAL half of the
       same event and the audio switches keep owning the audible half.

       Lifetime rules differ by urgency, deliberately:
         done      auto-dismisses after NOTIFY_DONE_MS — it is a receipt;
         attention STICKS until the interaction resolves (the watcher's
                   kind -> null transition clears it) or the user dismisses it —
                   these need a human decision, and a receipt-style fade could
                   hide exactly the moment the user was being called for.

       The stack is plain DOM (same decision as thunder/watermark): the panel's
       mini-React owns settings, not page chrome, and a fixed-position stack has
       no interaction with the app's layout. */
    const NOTIFY_KEY = 'dsh-theme-endfield-notify'
    const NOTIFY_DONE_KEY = 'dsh-theme-endfield-notify-done'
    const NOTIFY_QUESTION_KEY = 'dsh-theme-endfield-notify-question'
    const NOTIFY_APPROVE_KEY = 'dsh-theme-endfield-notify-approve'
    // Master default ON: the module was requested as a feature, not as an
    // opt-in experiment. Sub-switches default ON and read independently.
    const isNotifyOn = () => prefsGet(NOTIFY_KEY) !== '0'
    const isNotifyDoneOn = () => prefsGet(NOTIFY_DONE_KEY) !== '0'
    const isNotifyQuestionOn = () => prefsGet(NOTIFY_QUESTION_KEY) !== '0'
    const isNotifyApproveOn = () => prefsGet(NOTIFY_APPROVE_KEY) !== '0'
    /** Does this attention kind have a notification switch flipped on? */
    const notifyWantsKind = (kind) => {
      if (kind === 'question') return isNotifyQuestionOn()
      // plan-review is an approval-family surface (same human decision).
      return isNotifyApproveOn()
    }
    const NOTIFY_DONE_MS = 6000
    let notifyStack = null
    const notifyTimers = new Map() // kind -> dismissal timeout (done only)
    /** The industrial card: square, 2px ink border, paper fill, signal rail. */
    /** Copy per kind. Hardcoded zh like the thunder words: page chrome, not a
        settings string, and the theme's face is bilingual-unfriendly by design. */
    const notifyCopy = (kind) => ({
      done: { title: '任务完成', body: '回合已结束，可以继续。' },
      question: { title: '等待回答', body: '助手提出了一个需要你选择的问题。' },
      approval: { title: '需要授权', body: '一个操作正在等待你的批准。' },
      'plan-review': { title: '方案确认', body: '计划变更正在等待你的审阅。' },
    }[kind] || { title: '通知', body: '' })
    const notifyCard = (kind, title, body) => {
      const el = document.createElement('div')
      el.setAttribute('data-endfield-notify', kind)
      el.setAttribute('data-endfield-notify-kind', kind)
      // done is a receipt -> status; attention kinds call for a human -> alert.
      el.setAttribute('role', kind === 'done' ? 'status' : 'alert')
      const rail = document.createElement('span')
      rail.setAttribute('data-endfield-notify-rail', '')
      rail.setAttribute('aria-hidden', 'true')
      const main = document.createElement('div')
      main.setAttribute('data-endfield-notify-main', '')
      const head = document.createElement('span')
      head.setAttribute('data-endfield-notify-head', '')
      head.textContent = title
      const text = document.createElement('span')
      text.setAttribute('data-endfield-notify-body', '')
      text.textContent = body
      main.appendChild(head)
      main.appendChild(text)
      el.appendChild(rail)
      el.appendChild(main)
      // Sticky kinds carry their own dismissal; the receipt does not need one.
      if (kind !== 'done') {
        const close = document.createElement('button')
        close.setAttribute('data-endfield-notify-close', '')
        close.setAttribute('aria-label', '×')
        close.type = 'button'
        close.textContent = '×'
        close.addEventListener('click', () => dismissNotify(kind))
        el.appendChild(close)
      }
      return el
    }
    /** Idempotent stack host, created on first use and torn down with the run. */
    const notifyHost = () => {
      if (notifyStack !== null && notifyStack.isConnected) return notifyStack
      if (typeof document === 'undefined' || !document.body) return null
      if (notifyStack === null) notifyStack = document.createElement('div')
      notifyStack.setAttribute('data-endfield-notify-stack', '')
      // Newest on top: the stack is a column and toasts prepend, so the live
      // interaction is always the closest to the corner.
      document.body.appendChild(notifyStack)
      return notifyStack
    }
    /** Show (or replace) the toast for one kind. Self-guarded on every switch. */
    const showNotify = (kind) => {
      if (!isEnabled() || !isNotifyOn()) return
      if (kind === 'done' && !isNotifyDoneOn()) return
      if (kind !== 'done' && !notifyWantsKind(kind)) return
      if (typeof document === 'undefined' || !document.body) return
      const host = notifyHost()
      if (host === null) return
      dismissNotify(kind, true)
      const copy = notifyCopy(kind)
      const el = notifyCard(kind, copy.title, copy.body)
      host.insertBefore(el, host.firstChild)
      if (kind === 'done' && typeof setTimeout === 'function') {
        notifyTimers.set(kind, setTimeout(() => dismissNotify('done'), NOTIFY_DONE_MS))
      }
    }
    /** Remove the toast for a kind; `quiet` skips timer cleanup recursion. */
    const dismissNotify = (kind, quiet) => {
      if (!quiet && notifyTimers.has(kind)) {
        clearTimeout(notifyTimers.get(kind))
        notifyTimers.delete(kind)
      }
      if (notifyStack === null) return
      const el = notifyStack.querySelector('[data-endfield-notify-kind="' + kind + '"]')
      if (el !== null) el.remove()
    }
    /** Attention resolution clears every sticky kind (question answered,
        approval decided, panel replaced by another kind). */
    const notifyResolveAttention = () => {
      for (const kind of ['question', 'approval', 'plan-review']) dismissNotify(kind)
    }
    const destroyNotify = () => {
      for (const t of notifyTimers.values()) clearTimeout(t)
      notifyTimers.clear()
      if (notifyStack !== null && notifyStack.parentNode) notifyStack.parentNode.removeChild(notifyStack)
      notifyStack = null
    }
    // Exposed for tests: drive one notification directly (the done edge needs a
    // sessions service, which in-process harnesses stub differently).
    module.exports.__notifyFire = showNotify
    module.exports.__notifyDismiss = dismissNotify


    let disposeToken = () => {}
    let disposeStyles = () => {}
    let mounted = false
    const mount = () => {
      if (mounted) return
      mounted = true
      disposeToken = theme.overrideTokens('edge-intelligence-theme', {
      '--dsw-alias-bg-base': {
        light: '#e8e8e2',
        dark: '#101110',
      },
      '--dsw-alias-bg-layer-1': {
        light: '#f2f2ec',
        dark: '#181a18',
      },
      '--dsw-alias-bg-layer-2': {
        light: '#dcddd6',
        dark: '#1e201d',
      },
      '--dsw-alias-bg-overlay': {
        light: '#f2f2ec',
        dark: '#1c1e1c',
      },
      /* 菜单/弹层面（@ 与 / 呼出的列表、模型选择、工作区菜单……）。
         上游默认 --dsw-menu-surface-fill 是 **58%/45% alpha 的半透明**
         (#f8f9fa94 / #43454a73)，设计上要配 --dsw-menu-backdrop-filter 的
         blur(40px) 磨砂。本主题没有给菜单接磨砂（玻璃开关只覆盖输入卡与侧栏），
         半透明就只是「透」：正文与背景纹理会从菜单底下渗上来（用户实测反馈）。
         对齐到主题自己的浮层令牌——不透明、与纸面同族，配 0.5px 描边 + 阴影
         分层。若日后玻璃开关要扩到菜单，应整组换（半透明 + backdrop-filter），
         不能只留半透明。 */
      '--dsw-menu-surface-fill': {
        light: '#f2f2ec',
        dark: '#1c1e1c',
      },
      '--dsw-alias-border-l1': {
        light: '#d8d9d5',
        dark: '#343633',
      },
      '--dsw-alias-border-l2': {
        light: '#b6b8b3',
        dark: '#4a4d49',
      },
      '--dsw-alias-brand-primary': {
        light: '#101110',
        /* The one ACCENT-carrying token in this layer, so it is the one that must
           not be a literal. A token value may itself be a var() reference: the app
           writes these as inline properties on <body>, the palette variables are
           declared on <body> too, so the reference resolves on the same element and
           re-resolves when the palette class flips — no re-registration of this
           layer, no JS repaint. Verified by test/palette-switch.test.js, which
           caught exactly this token still reading #fff500 after a flip. */
        dark: 'var(--edge-accent)',
      },
      '--dsw-alias-label-primary': {
        light: '#101110',
        dark: '#f5f5f0',
      },
      '--dsw-alias-label-secondary': {
        light: '#4a4c48',
        dark: '#898d89',
      },
      '--dsw-alias-state-error-primary': {
        light: '#ff3b30',
        dark: '#ff6b61',
      },
      '--dsw-alias-state-success-primary': {
        light: '#2f9e44',
        dark: '#4fbf5c',
      },
      '--dsw-alias-state-warn-primary': {
        light: '#d9822b',
        dark: '#ffb700',
      },
      '--dsw-specific-sidebar-fill': {
        light: '#e8e8e2',
        dark: '#101110',
      },
    })

    disposeStyles = insertCss(`
      /* ================= typography: SCOPED to the theme's own elements =====
         The theme used to redeclare the app's two font TOKENS at :root:
             --dsw-font-family: Arial, ...      -> dropped, see below
             --ds-font-family-code: <mono list> -> dropped (see the note under it)
         and that is what broke third-party widgets.

         WHY IT BROKE THEM. The app declares --dsw-font-family at :root and then
         renders the UI root font from it — dsh-web-frontend ships exactly
         'body{font-family:var(--dsw-font-family, <system stack>)}'. A :root
         declaration WINS over the app's own :root one, so the entire UI root
         font became Arial; a widget injected into the app root (DeepSeek-
         Balance-Whale-Widget and friends) carries 'font-family:inherit' and
         therefore inherited Arial, losing its own face for its balance digits.
         The root font token is a SHARED PUBLIC INTERFACE of the app, not a
         theme-private knob: overriding it silently restyles every third-party
         component on the page, so this theme no longer touches either token.

         WHAT KEEPS THE LOOK. The theme's industrial editorial face lives in
         --edge-font, declared on body and applied ONLY to elements this theme
         owns: the boot plate, the watermark wordmark, and the settings panel.
         --dsw-font-family is still READ on those elements, as the trailing
         fallback of that stack, so nothing outside the theme is ever affected
         while the app's own font configuration stays part of the protocol. The
         ORDER of that stack matters and is documented where it is declared —
         flipping it re-types the boot plate.

         The code token went for the same reason. It is nearly identical to the
         app's own list (only the final fallbacks differ: Liberation Mono, Menlo,
         Courier, PingFang SC, Microsoft YaHei here vs Helvetica, Arial,
         sans-serif in the app), so dropping the override is visually inert on
         every code surface the theme does not own.

         NO GLOBAL TEXT PROPERTIES EITHER. There is deliberately no 'body { ... }'
         rule setting font-family / font-feature-settings / font-variant-*: all
         three inherit, so all three leak into injected third-party nodes exactly
         the way the token did. openType features belong on the specific elements
         that measure with them instead (see the loader's own tabular figures). */
      /* ================= accent palette =================================
         Every accent value in this stylesheet reads from the variables below
         instead of a literal, so the whole theme repaints from ONE declaration
         block. Two palettes ship:

           谷地黄 (default)  signal yellow  #fff500 — the Endfield site accent
           武陵青            teal-cyan      #14d0d0

         WHY THIS BLOCK IS ON body AND NOT :root. The app applies its theme
         tokens as INLINE STYLES ON <body> (dsh-client-ui-layout does
         body.style.setProperty(name, value) for every token in the snapshot).
         A custom property declared at :root that substitutes one of those
         tokens is resolved AT THE html ELEMENT, where the token does not
         exist, so it becomes guaranteed-invalid and computes to nothing.
         That was not theory: the shipped --edge-line / --edge-paper /
         --edge-soft were declared at :root and measured EMPTY in a real
         browser, which silently disabled the themed scrollbar
         (scrollbar-color computed to 'auto') and left the table/hairline
         rules falling back. Moving them onto body is what makes them resolve
         (see test/probe-edge-line.js).

         The same fact is what makes the palette switch free: the theme's
         token overrides are values like var(--edge-accent), body carries the
         palette class, so flipping the class re-resolves every token and
         every rule below with NO JavaScript repaint at all — verified in a
         real browser (test/probe-css.js), not assumed.

         --edge-accent-rgb is the same colour as a bare comma list, because
         rgba() needs channels rather than a hex; substituting a comma-list
         custom property inside rgba() is legal and was verified in the same
         probe. Keeping both in one place is why the ~30 translucent washes
         did not have to become 60 declarations.

         Values are MEASURED, not chosen — see test/palette-contrast.test.js,
         which fails the build if any of them stops clearing its bar:
           ink #101110 on 谷地黄 16.50:1 · on 武陵青 6.62:1   (AA, solid chips)
           accent as dark-mode icon ink   15.26:1  ·  6.12:1  (>=3 icon floor) */
      body {
        --edge-accent: #fff500;
        --edge-accent-rgb: 255, 245, 0;
        /* Text paired with the accent as a SOLID FILL. The bright palettes carry
           ink-coloured text on their accents; 终末地灰's dark-scheme fill (#626262)
           needs white instead, so the pairing travels as its own token. */
        --edge-accent-ink: #101110;
        /* Hover/pressed step of the accent, still carrying ink-coloured text:
           谷地黄 13.60:1 · 武陵青 5.31:1. */
        --edge-accent-deep: #e8e000;
        /* The one place the accent must survive on CREAM as a fill (the light
           deepseek-450 slot): pure signal yellow is nearly paper-white there,
           so light mode uses a darkened step of the same hue. */
        --edge-accent-onpaper: #d9c700;
        /* Turn-status gradient text stops — see the long note on that rule.
           Gradient text paints glyphs with EVERY stop, and reduced-motion pins
           the mid band permanently inside the letters, so all four clear AA
           against both surfaces of their mode:
             谷地黄 light #6b5d00 5.35 / mid #3f3600 9.82
                    dark  #fff500 15.26 / mid #a08a00 5.11
             武陵青 light #006a6a 5.22 / mid #003f3f 9.58
                    dark  #14d0d0 9.14 / mid #7ee7e7 12.06 */
        --edge-status-light: #6b5d00;
        --edge-status-light-mid: #3f3600;
        --edge-status-dark: #fff500;
        --edge-status-dark-mid: #a08a00;
        /* Hero backdrop glow alpha, per scheme. These are the measured values
           from the note on that rule: the replacement must not change how deep
           the hero reads compared with the app's own #6187D8 at 8%. */
        --edge-glow-light: 0.08;
        --edge-glow-dark: 0.05;
      }
      /* ---------- 武陵青 (teal-cyan, #14d0d0) ----------
         Only the palette changes here; paper, ink, borders and the semantic
         state colours (error red, success green, warn amber) are shared, so
         this block is exactly the set of values that carry the accent hue.

         BRIGHTNESS. The first version shipped #0daaaa (the literal
         rgb(13, 170, 170) that was asked for) and read as too dark next to the
         signal yellow it alternates with — measured, that is not a matter of
         taste: relative luminance was 31.7% against the yellow's 86.6%, so on a
         near-black page the cyan chip carried barely a third of the presence.
         #14d0d0 keeps the same hue axis (R low, G == B, so it is still the same
         teal rather than drifting toward grey-cyan) and lifts luminance to
         49.8% — 57% brighter — while every measured invariant still holds:
           ink #101110 on the chip   6.62 -> 9.88:1   (AA, and now better)
           chip as dark-mode ink     6.62 -> 9.88:1   (icon floor is 3)
         It is deliberately NOT taken to the yellow's luminance: past ~#16dcdc
         the light-mode chip stops separating from cream (1.39:1 at #16dcdc
         versus 1.56:1 here), and a cyan that pale reads white-ish rather than
         teal. This is the brightest step that still looks like 武陵青 in both
         schemes. */
      body.theme-endfield-wuling {
        --edge-accent-ink: #101110;
        --edge-accent: #14d0d0;
        /* Same colour, channel-list form, for the ~30 rgba() washes. Derived from
           the hex above and kept beside it so the two cannot drift. */
        --edge-accent-rgb: 20, 208, 208;
        /* Hover step. Chosen to match the PERCEPTUAL drop the yellow palette uses
           (#fff500 -> #e8e000 is ΔY 19.9) rather than a copied percentage, so
           hover feels equally strong in both palettes: ΔY 19.7 here, 7.72:1 under
           ink text. */
        --edge-accent-deep: #10b8b8;
        /* Cyan is still far darker than yellow under ink (9.88 vs 16.50), so it
           needs no separate on-cream step — the accent itself reads on paper. */
        --edge-accent-onpaper: #14d0d0;
        /* Light mode dips deep, exactly as the yellow palette does: on cream no
           tint above #007070 clears AA on both surfaces, and that is a property of
           the paper, not of how bright the accent is — so these two are unchanged
           by the brightening. */
        --edge-status-light: #006a6a;
        --edge-status-light-mid: #003f3f;
        --edge-status-dark: #14d0d0;
        /* Dark mode LIFTS for its mid band instead of dipping like yellow's
           #a08a00: a darker cyan mid stop measured 3.54:1 and failed, because cyan
           at this lightness has less headroom below it than yellow does. Raised
           with the accent so the shimmer keeps a visible band: #7ee7e7 is 12.06:1
           and ΔY 40.6 from the accent (the old #4fd6d6 would now sit only ΔY 27.8
           away and read flatter). */
        --edge-status-dark-mid: #7ee7e7;
        /* Cyan carries real luminance where yellow is nearly neutral on cream, so
           the glow alphas are measured rather than inherited. Both stay inside the
           depth of the #6187D8 glow they replace (budget: light 9.90, dark 11.28).
           Dark comes down from 0.05 to 0.04 because the brighter accent lifts a
           near-black page faster: 0.05 now measures |ΔY| 7.6 where the old cyan
           measured 6.0. */
        --edge-glow-light: 0.08;
        --edge-glow-dark: 0.04;
      }
      /* ---------- 终末地灰 (Endfield industrial gray) ----------
         The official site's own interaction language, measured from its shipped
         CSS (endfield.hypergryph.com bundles on web.hycdn.cn): hover and selection
         surfaces are a GRAY SCALE — dark button hover #484848, list hover #626262,
         light hover #f0f0f0 / #d9d9d9 — while yellow stays a rare signal. This
         palette makes the theme follow that grammar by default.

         WHY ACCENT AND STATUS SPLIT HERE. No mid-gray is AA in BOTH directions
         on near-black: white text on the fill needs luminance <= 0.183 while
         gray-as-text-on-ink needs >= 0.200 — the intervals do not overlap. The
         palette therefore uses the roles the architecture already provides:
           --edge-accent / -deep   FILLS, paired with --edge-accent-ink text
           --edge-status-dark/-mid 'accent as text' roles in dark mode
         The bright palettes keep status-dark == accent, so for them the split
         changes nothing visually.

         Values are MEASURED (WCAG, test/palette-contrast.test.js):
           light fill #d9d9d9 + ink   13.41:1 · hover #cccccc + ink 11.78:1
           dark  fill #6a6a6a + white  5.41:1 · hover #424242 + white 10.04:1
           dark  status #d9d9d9        13.41 / 12.40:1 (base / layer-1)
           dark  status-mid #b3b3b3     9.03 /  8.35:1
           light status #666666         4.67 /  5.11:1
           light status-mid #4a4a4a     7.20 /  7.89:1
           dark  accent as icon ink     3.49 / 3.28:1 (>= 3 floor, both surfaces) */
      body.theme-endfield-gray {
        --edge-accent-ink: #101110;
        --edge-accent: #d9d9d9;
        /* Neutral wash base shared by both schemes: on cream a gray wash reads as
           soft shading, on ink as a soft lift — the same 'composited contrast'
           doctrine the translucent surfaces follow. */
        --edge-accent-rgb: 126, 126, 126;
        --edge-accent-deep: #cccccc;
        /* The one slot the accent must carry as a FILL on cream: a light gray
           would dissolve into the paper, so it dips to the official #666666. */
        --edge-accent-onpaper: #666666;
        --edge-status-light: #666666;
        --edge-status-light-mid: #4a4a4a;
        --edge-status-dark: #d9d9d9;
        --edge-status-dark-mid: #b3b3b3;
        --edge-glow-light: 0.08;
        --edge-glow-dark: 0.04;
      }
      /* Dark scheme flips the FILL role only: an official-family mid gray
         (#6a6a6a, between the site's #666 and #7e7e7e) under WHITE ink, hover
         deepens to official #424242. #6a6a6a is the darkest gray that still
         clears the 3:1 NON-TEXT floor on BOTH dark surfaces (3.49:1 on bg-base,
         3.28:1 on layer-1) — the caret, focus ring and scrollbar hover read the
         accent directly. Text roles stay on the light grays in both schemes. */
      body.theme-endfield-gray[data-ds-dark-theme] {
        --edge-accent-ink: #ffffff;
        --edge-accent: #6a6a6a;
        --edge-accent-deep: #424242;
        --edge-accent-onpaper: #6a6a6a;
      }
      /* Token-derived aliases. These MUST be on body, not :root — see above. */
      body {
        --edge-signal: var(--edge-accent);
        --edge-signal-dim: rgba(var(--edge-accent-rgb), 0.7);
        --edge-paper: var(--dsw-alias-bg-base);
        --edge-panel: var(--dsw-alias-bg-layer-1);
        --edge-line: var(--dsw-alias-border-l1);
        --edge-soft: var(--dsw-alias-bg-layer-2);
        /* The theme's own face. THREE things are deliberate here.

           (1) THE THEME STACK LEADS, with --dsw-font-family as a trailing
               fallback — and this ORDER was measured, not guessed. On this host
               the app's token renders in Segoe UI while the theme's stack renders
               Arial (same string, 81.688px vs 84.516px — measured by
               test/font-scope.test.js), so reading the token FIRST would silently
               repaint the boot plate, the watermark and the settings panel in a
               different face and invalidate every Arial-based proportion the
               loader was measured with (see the pixel-scan notes on the brand
               block). Leading with the theme stack keeps those surfaces exactly
               as they render today, which is what this fix has to promise: the
               request is to stop RESTYLING THE WHOLE APP, not to re-type the
               theme.
           (2) THE TOKEN IS STILL HONOURED, which is the protocol half of the
               requirement: it is read, not ignored, and it is what applies on a
               host with no Arial/Narrow/PingFang/YaHei at all — so a system
               carrying neither the theme stack nor a configured root font still
               lands on the app's stack instead of an arbitrary generic. A user
               who deliberately configures a root font family therefore still
               reaches the theme's own elements. If a future author wants the
               world's configuration to win OUTRIGHT over the theme face, swapping
               the two halves of this declaration is the whole change — say so in
               the commit, because it re-types the boot plate.
           (3) IT IS DECLARED ON body, NOT :root, for the same reason the aliases
               above are — see the app-token note higher up. The var() fallback is
               not decoration either: a custom property that substitutes a token
               missing at the element it is READ from computes to nothing, the
               trap that already shipped once with --edge-line
               (test/probe-edge-line.js). Resolving where the value is used cannot
               hit it. */
        --edge-font: Arial, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif, var(--dsw-font-family);
      }
      /* ---------- where the theme's face is applied, and where it is NOT ----------
         Only elements this theme created or owns. Every one of the three is a
         node the theme injected itself, so a third-party widget can never be an
         ancestor or a descendant of one of them — unless it attaches INSIDE the
         boot plate or the watermark, which it does not: those layers are
         pointer-events:none, aria-hidden chrome.
           [data-endfield-loader]  the boot plate      (also carries the feature
                                                       settings the layout measures:
                                                       tabular figures + the
                                                       altered single-storey
                                                       glyph)
           [data-endfield-watermark] the ENDFIELD wordmark
           .endfield-settings      the 「终末地主题设置」 panel root
         Deliberately NOT on body: the app renders its UI root font from
         var(--dsw-font-family) on body, and a body font-family here would
         re-break every installed widget exactly as the old :root override did. */
      [data-endfield-loader],
      [data-endfield-watermark],
      .endfield-settings {
        font-family: var(--edge-font);
        font-feature-settings: "tnum" 1, "ss01" 1;
        font-variant-ligatures: no-common-ligatures;
      }
      /* The persist-mode watermark is a z-index:-1 child of the conversation column.
         Two properties are needed on that column, and only while the mark is mounted
         there (the :has() guard makes this a no-op whenever the feature is off):
           isolation: isolate — without a stacking context, z-index:-1 escapes to the
             nearest ancestor context and paints behind the column's own opaque
             background, i.e. invisible.
           position: relative — the column ships as position:static, so an absolutely
             positioned child would resolve against the app frame instead and spill
             across the sidebar. This makes the column the containing block so
             inset:0 means "exactly this column".
         Every absolute descendant the app itself renders (header:after, tab:after,
         heroGlow, the overlay composer seat) already has a positioned ancestor
         nearer than this column, so their containing blocks are unchanged. */
      /* Suffix-only match: the :has(>) guard pins this to exactly the element the
         JS mounted the watermark into (only the conversation column or the app
         frame ever hosts it), so the broad '_root' suffix cannot over-match. */
      [class$='_root']:has(> [data-endfield-watermark]) {
        isolation: isolate;
        position: relative;
      }
      /* The persist FALLBACK mounts inside the app FRAME on pages with no
         conversation column (a full-page settings view). Same reason as the rule
         above: without isolation, the mark's z-index:-1 escapes to the root
         stacking context and paints below the frame's own opaque background —
         i.e. it never shows, which is exactly what the old body-level fallback
         did. The frame is already position:relative, so
         isolation alone is enough here. The :has() guard keeps the frame's
         stacking behaviour stock whenever the mark is not mounted in it. */
      [class*='_frame']:has(> [data-endfield-watermark]) {
        isolation: isolate;
      }
      /* The mark sits behind text, so it must never intercept selection or clicks. */
      [data-endfield-watermark] {
        pointer-events: none !important;
      }
      /* ---------- watermark strength, per colour scheme ----------
         One variable per scheme instead of one number in JS, because the two
         schemes genuinely need different alphas and a scheme flip must re-resolve
         with no JS involved.

         Computed, not eyeballed — contrast of the composited ink against its own
         background (the mark is always BEHIND text, so this measures how loudly
         the decoration competes for attention, never foreground readability):

              alpha | dark #101110  | light #e8e8e2
              0.07  | 1.171 : 1     | 1.152 : 1
              0.085 | 1.215 : 1     | 1.186 : 1
              0.10  | 1.278 : 1     | 1.225 : 1
              0.13  | 1.406 : 1     | 1.310 : 1   <- previous dark value
              0.16  | 1.541 : 1     | 1.398 : 1   <- previous persist value

         Dark mode is the reported problem: adding luminance to a near-black page
         makes the wordmark read far louder than the same alpha subtracted from
         cream, and at 0.13/0.16 it visibly cluttered the UI. Dark therefore drops
         to 0.085 (1.215:1) — still clearly present, no longer competing. Light
         keeps more strength (0.13) because cream needs it to register at all;
         1.310:1 there looks quieter than 1.215:1 on black.
         Floor is ~1.06:1, below which the mark reads as absent. */
      body {
        --edge-wm-alpha: 0.13;
        /* The emblem mask is NORMALISED to full strength by the build (the official
           PNG's own alpha peaks at ~40%, which under this opacity read as nothing),
           so the emblem needs only a small lift over the letters to sit in the same
           presence band. */
        --edge-wm-emblem-alpha: 0.16;
      }
      body[data-ds-dark-theme] {
        --edge-wm-alpha: 0.085;
        --edge-wm-emblem-alpha: 0.105;
      }
      /* ================= 背景纹理：官网 /operator 那一套底纹 =================

         全部素材与参数来自官网自己的 CSS（5f3bf8547312569e.css，/operator 路由），
         逐条对应见 docs/notes/endfield-motion-research.md 附录 D：

           block-bg.svg     → 工程网格 217×217 矢量，官方 12.8125rem 一格、opacity:.05
           wave-bg.png      → 右上角阶梯波纹，官方 39.1875×26.3125rem / contain / 100% 0
           tape-wave-bg.png → 中下部波纹带，官方 59.125rem×13.5rem / cover
           45° 斜纹          → 官方 shallowBg：13.9512529279% / 36.0487470721% 停靠、
                              .75rem 周期（后写的 background-size 覆盖前面的 .5rem）
           三色信号线        → 官方 decoLine 原文（见下方 .endfield-settings-group-title）

         三个素材是官方站点自己的发布产物，由仓库所有者指示「沿用官方」，以**原始
         字节**内嵌为 data URI（scripts/build-texture.js；URL 与 sha256 见其头注与
         README 素材归属）。PNG 不做任何再压缩或量化。

         **纹理不铺满窗口**——官网每一层都锚定在内容区的一个部位，而不是整窗平铺：
           · 网格（decoFlag）用 clip-path 水平裁到中央内容列，mask 从上往下、
             50% 之后淡出 → 只在内容区上半段；
           · 斜纹（shallowBg）是**底部 32.8125rem 高的一条带**，mask 从下往上淡出；
           · 波纹钉死右上角；波纹带在中下部（top: 50% + 3.8125rem）。
         本主题照此映射到**主内容列 _centerCol**（它就是 DSH 的「内容列」）：
         侧栏与外框**不上纹理**，四个层各自锚定在列内的一个区域。

         官网这些底纹是**静态的**（无 animation/transition），本段一条过渡都不加。 */

      /* 纹理令牌。alpha 与官网同为 0.05 量级；test/texture.test.js 实算「纹理压在
         实际底面上」的合成对比度，断言落在装饰区间（与水印、hero 光晕同一规则）。 */
      body {
        --edge-tex-ink: #181818;
        /* The official block-bg.svg is a TRANSPARENT tile whose only content is a 2px
           black stroke. That makes it usable in exactly one way: as an ALPHA MASK
           (same trick the watermark uses with --edge-emblem). Used as a background
           image it paints nothing visible; used opaque it blackens the surface.
           So the ALPHA travels in the mask (--edge-tex-grid-mask) and the COLOUR
           travels separately in --edge-tex-grid-color / --edge-tex-hatch-color —
           the two MUST NOT be the same custom property: putting the url() inside a
           linear-gradient() is invalid CSS and silently resolves the whole
           background to none (measured: an entire layer stack vanished). */
        --edge-tex-grid-a: 5%;
        --edge-tex-hatch-a: 5%;
        /* Declared after the alphas above so var() substitution picks up this block's
           values rather than the previous rule's. */
        --edge-tex-grid-color: color-mix(in srgb, var(--edge-tex-ink) var(--edge-tex-grid-a), transparent);
        --edge-tex-hatch-color: color-mix(in srgb, var(--edge-tex-ink) var(--edge-tex-hatch-a), transparent);
      }
      body[data-ds-dark-theme] {
        --edge-tex-ink: #e9e9e3;
        --edge-tex-grid-a: 7%;
        --edge-tex-hatch-a: 6%;
      }

      /* EDGE_TEX_BEGIN (generated by scripts/build-texture.js — do not edit by hand) */
  /* endfield-block-bg.svg (engineering grid tile (viewBox 217x217, 2px stroke)) — 163B raw, 0KB base64, sha256 16d0d6dcb24d1cdb… */
  body { --edge-tex-grid-mask: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMTcgMjE3Ij48cGF0aCBkPSJNIDAgMCBMIDEgMSBoIDIxNyBNIDEgMSB2IDIxNyBNIDEgMSBMIDIxNyAyMTciIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIyIiAvPjwvc3ZnPg=="); }
  /* endfield-wave-bg.png (627x461 stepped wave, used top-right) — 17084B raw, 22KB base64, sha256 5a9efdd3ede79f2e… */
  body { --edge-tex-wave: url("data:image/png;base64,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"); }
  /* endfield-tape-wave-bg.png (946x216 wave band, used as the centre strip) — 37025B raw, 48KB base64, sha256 66b0f225288d5c5b… */
  body { --edge-tex-tape: url("data:image/png;base64,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"); }
  /* EDGE_TEX_END */

      /* 锚点：**内容列里的那个不透明根**（_centerCol 的直接子元素 _root，即会话
         根，应用自己声明 position:relative）。第一版挂 _centerCol 本身——但它里面
         还有一层不透明的 wSkVaW_root（background:var(--dsw-alias-bg-base); height:100%），
         z-index:-1 的叠加层画在那层不透明底**之下**，整段纹理无声消失（像素实测零
         变化）。挂到根上，叠加层才在「根底色之上、正文之下」。isolation 建层叠
         上下文，保证 -1 伪元素不落到根自己背景的后面。侧栏与外框不挂纹理。

         **选择器不要求直接子级**：会话 UI 经插槽挂载，centerCol 与 root 之间
         可能有包装层（应用的 ui-slots 会包无类名 div），用 '>' 会整段静默失配
         ——用户实测「看不到底纹」的根因之一。改用**后代 + [data-phase]**：
         data-phase 只出现在 ConversationRoot 上（水印查找器 findConversationRoot
         用的正是这个钩子），比标签后缀更精确。

         **水印共存例外（:not(:has(> [data-endfield-watermark]))）**：水印挂 body
         时（hero 页），隔离根会让整个根子树（含 z:20 的下拉框）变成一个
         z:auto 单元，被 body 级水印按 DOM 顺序压过——水印自己修过的那类 bug
         （见 test/watermark-stacking.test.js 头注）。所以**只在 body 直接挂着
         水印时**不隔离；此时网格/斜纹两个叠加层随之不可见（落在根底色后面），
         波纹/光晕是背景图层、不受影响。水印关闭或在会话内（挂根上）时，
         hero 页也有完整底纹。这是水印 :has 条件隔离同一门派的用法。 */
      body[data-endfield-texture='subtle']:not(:has(> [data-endfield-watermark])) [class$='_centerCol'] [class$='_root'][data-phase],
      body[data-endfield-texture='standard']:not(:has(> [data-endfield-watermark])) [class$='_centerCol'] [class$='_root'][data-phase] {
        position: relative;
        isolation: isolate;
      }

      /* 网格：官方 decoFlag 的复刻。**颜色渐变自己带着那条 180° 淡出**（上半实、
         往下渐透明），SVG 遮罩只负责形状——两层职责分开，就不用碰多遮罩的合成
         语义（mask 列表默认 add=并集，并出来的结果是整面色块，实测过）。 */
      body[data-endfield-texture='subtle']:not(:has(> [data-endfield-watermark])) [class$='_centerCol'] [class$='_root'][data-phase]::before,
      body[data-endfield-texture='standard']:not(:has(> [data-endfield-watermark])) [class$='_centerCol'] [class$='_root'][data-phase]::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background-image: linear-gradient(180deg,
          var(--edge-tex-grid-color) 0, var(--edge-tex-grid-color) 50%,
          transparent 100%);
        -webkit-mask-image: var(--edge-tex-grid-mask);
        mask-image: var(--edge-tex-grid-mask);
        -webkit-mask-size: 12.8125rem 12.8125rem;
        mask-size: 12.8125rem 12.8125rem;
        -webkit-mask-repeat: repeat;
        mask-repeat: repeat;
      }

      /* 斜纹：官方 shallowBg 的复刻——**底部一条带**（32.8125rem 高，窄视口收到
         45%），单一遮罩做 0° 淡出（底边最实、往上渐透明），纹路周期与停靠值照官方。 */
      body[data-endfield-texture='subtle']:not(:has(> [data-endfield-watermark])) [class$='_centerCol'] [class$='_root'][data-phase]::after,
      body[data-endfield-texture='standard']:not(:has(> [data-endfield-watermark])) [class$='_centerCol'] [class$='_root'][data-phase]::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        top: calc(100% - min(32.8125rem, 45%));
        z-index: -1;
        pointer-events: none;
        background-image: repeating-linear-gradient(-45deg,
          transparent 0 13.9512529279%,
          var(--edge-tex-hatch-color) 13.9512529279% 36.0487470721%,
          transparent 36.0487470721% 50%,
          transparent 50% 63.9512529279%,
          var(--edge-tex-hatch-color) 63.9512529279% 86.0487470721%,
          transparent 86.0487470721%);
        background-size: .75rem .75rem;
        -webkit-mask-image: linear-gradient(0deg, rgb(0,0,0) 0, rgb(0,0,0) 50%, rgba(0,0,0,0));
        mask-image: linear-gradient(0deg, rgb(0,0,0) 0, rgb(0,0,0) 50%, rgba(0,0,0,0));
      }

      /* subtle 档到此为止：网格 + 斜纹两个叠加层，列本身不加任何背景图层。 */

      /* standard 档：再叠官方两级波纹与顶部光晕——作为列的背景图层，天然画在
         全部内容之下。波纹钉右上角；波纹带照官方放在中下部，no-repeat、超宽部分
         由列右缘裁掉（官方那条左缘渐隐的 mask 在这里由裁边代替）。 */
      body[data-endfield-texture='standard'] [class$='_centerCol'] [class$='_root'][data-phase] {
        background-image:
          var(--edge-tex-wave),
          /* 波纹带的顶边渐隐：官方给 decoTape 挂的是左缘 90 度 mask（宽列里从右侧
             延伸进来）；DSH 的窄列里图几乎塞满整列，左缘 mask 失效，顶边变成一条
             横贯全列的硬切线（实测行间跳变 11 个灰阶）。遮罩没法只作用于背景图的
             某一层，所以这里用一条「与波纹带同盒、顶部不透明底色、往下 3.5rem
             渐透明」的覆盖层把顶边揉掉——官方 mask 的意图，转了 90 度。 */
          linear-gradient(180deg, var(--dsw-alias-bg-base, #101110) 0, transparent 3.5rem),
          var(--edge-tex-tape),
          radial-gradient(120% 55% at 50% 0%,
            rgba(var(--edge-accent-rgb, 126, 126, 126), var(--edge-glow-light, 0.08)), transparent 70%);
        background-size:
          39.1875rem 26.3125rem,
          59.125rem 13.5rem,
          59.125rem 13.5rem,
          100% 100%;
        background-position:
          100% 0,
          30% 62%,
          30% 62%,
          50% 0;
        background-repeat: no-repeat, no-repeat, no-repeat, no-repeat;
      }
      body[data-ds-dark-theme][data-endfield-texture='standard'] [class$='_centerCol'] [class$='_root'][data-phase] {
        background-image:
          var(--edge-tex-wave),
          linear-gradient(180deg, var(--dsw-alias-bg-base, #101110) 0, transparent 3.5rem),
          var(--edge-tex-tape),
          radial-gradient(120% 55% at 50% 0%,
            rgba(var(--edge-accent-rgb, 126, 126, 126), var(--edge-glow-dark, 0.04)), transparent 70%);
      }

      /* 三色信号线：官方 decoLine。原文是绝对停靠（90deg,#ff00f0 11.25rem,
         #fffa00 0,#fffa00 22.5625rem,#00ffa2 0），挂在 67.5rem 宽的容器上——
         也就是 紫 11.25 : 黄 11.3125 : 绿 44.9375rem，**绿占三分之二**。绝对
         停靠只在那一个宽度下成立：本主题的两条线宽度都随容器伸缩，照抄 rem
         会让三条色带在窄容器上几乎均分（用户实测反馈与官方不符）。所以这里
         换算成官方自己的比例停靠：11.25/67.5 = 16.6667%，22.5625/67.5 =
         33.4259%，绿吃剩余 ——任何宽度下都是官方的紫:黄:绿观感。

         分组标题本身是 'display:flex'（标记块 + 中英文两行），所以这条线不能靠
         ::after 当 flex 子项（会被当成第三段文字挤在一行），必须绝对定位到标题底部
         整宽。类名是 '.endfield-settings-group-title'，不是 '.endfield-group-title'
         ——写错类名会静默不生效，只有截图能看出来。 */
      .endfield-settings .endfield-settings-group-title:has(> span) {
        position: relative;
      }
      .endfield-settings .endfield-settings-group-title:has(> span)::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 2px;
        background-image: linear-gradient(90deg,#ff00f0 16.6667%,#fffa00 0,#fffa00 33.4259%,#00ffa2 0);
      }

      /* 「已编辑 N 个文件」卡片（deliverables 的 ChangedFiles）：底部装饰线。
         官方 decoLine 的分划用法放在这个卡片的底边（用户指定）。选择器无哈希：
         「直接子元素是 _header 的 _card」——该组件的卡片形态（header 是 60px
         的展开按钮）；卡片自带 overflow:hidden，线条被裁进边角（直角模式下
         无圆角可裁）。伪元素无占用（bundle 全量查过）。静态、无动画。 */
      [class$='_card']:has(> [class$='_header']) {
        position: relative;
      }
      [class$='_card']:has(> [class$='_header'])::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 2px;
        pointer-events: none;
        background-image: linear-gradient(90deg,#ff00f0 16.6667%,#fffa00 0,#fffa00 33.4259%,#00ffa2 0);
      }

      /* 降级：要求减少透明/更高对比时整段让位（装饰不与无障碍偏好争）。
         注意伪元素：列上的 background-image:none 只清背景图层，两个叠加层
         （::before 网格 / ::after 斜纹）必须各自 display:none。 */
      @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
        body[data-endfield-texture] [class$='_centerCol'] [class$='_root'][data-phase] {
          background-image: none !important;
        }
        body[data-endfield-texture] [class$='_centerCol'] [class$='_root'][data-phase]::before,
        body[data-endfield-texture] [class$='_centerCol'] [class$='_root'][data-phase]::after {
          display: none !important;
        }
        .endfield-settings .endfield-settings-group-title:has(> span)::after,
        [class$='_card']:has(> [class$='_header'])::after {
          background-image: none !important;
        }
        [class$='_centerCol'] [class$='_tabs'] :is([class$='_tab'],[class$='_tabActive'])::before {
          display: none !important;
        }
      }

      /* The watermark is the Endfield Industries LOGO ALONE as a VECTOR mask
         (Yue-plus/endfield_icons' vectorization of the official Hypergryph
         mark; see scripts/build-emblem.js for provenance and the minimize
         pass). No DOM text, no CSS glyphs — translators have nothing to
         rewrite, and being vector it is crisp at every zoom and pixel ratio
         (the previous pipeline was a raster mask capped at its 755px source).
         DEFAULT mask mode (alpha) is deliberate: the paths' own alpha channel
         IS the shape, so the default black fill paints the mark with
         currentColor and both colour schemes stay automatic. The viewBox is
         square (512x512), hence the 1/1 aspect. */
      [data-endfield-watermark]::after {
        content: '';
        display: block;
        width: 13vw;
        max-width: 240px;
        aspect-ratio: 1 / 1;
        background: currentColor;
        opacity: var(--edge-wm-emblem-alpha, var(--edge-wm-alpha));
        -webkit-mask-image: var(--edge-emblem);
        mask-image: var(--edge-emblem);
        -webkit-mask-size: contain;
        mask-size: contain;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-position: center;
      }
      /* Without mask support the logo cannot paint at all; the watermark
         degrades to nothing rather than to a wrong-looking mark. */
      @supports not ((mask-image: none) or (-webkit-mask-image: none)) {
        [data-endfield-watermark]::after { content: none; }
      }
      /* EMBLEM_MASK_BEGIN (generated by scripts/build-emblem.js — do not edit by hand) */
  /* Vector emblem mask (Yue-plus/endfield_icons vectorization of the official
     Hypergryph mark; see scripts/build-emblem.js for provenance). Minimized
     SVG 22153 bytes / 29KB base64. Alpha mask:
     the paths' own alpha is the shape. Regenerate: node scripts/build-emblem.js */
  body { --edge-emblem: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48Zz48cGF0aCBkPSJNMTA0LjUsMjM5LjJ2NDAuN0g4My4yVjIwM2gyMS43bDI5LjIsNDAuMWwwLjQtMC4xVjIwM2gxLjZjMTEuNiwwLDIzLjItMC4xLDM0LjgsMGMxMS42LDAuMSwyMS41LDQuMSwyOS41LDEyLjUgYzYsNi4yLDkuMSwxMy44LDkuOSwyMi40cy0wLjQsMTUuMS00LjIsMjJjLTUuMywxMC4xLTEzLjksMTYtMjQuOSwxOC43Yy0zLjUsMC44LTcsMS4zLTEwLjYsMS4zYy0xMS43LDAuMS0yMy41LDAuMS0zNS4yLDAuMUgxMzQgbC0yOS4yLTQxTDEwNC41LDIzOS4yIE0xNTYuNSwyNjAuM2M1LjktMC4yLDExLjYsMC40LDE3LjQtMC42YzkuMS0xLjYsMTQuMi03LDE1LTE2LjJjMC42LTYuNy0xLjMtMTIuNS02LjktMTYuNyBjLTMtMi4zLTYuNy0zLjctMTAuNS0zLjljLTQuNy0wLjMtOS4zLTAuMS0xMy45LTAuMmwtMSwwLjJMMTU2LjUsMjYwLjN6Ii8+PHBhdGggZD0iTTM2NC40LDI4MHYtNzYuOWgyMS4ydjU3LjFoMzAuNlYyMDNoMS44YzExLjQsMCwyMi44LTAuMSwzNC4xLDBjMTEuNCwwLjEsMjIuMiw0LjMsMzAuMiwxMy4yYzYsNi43LDksMTQuNiw5LjQsMjMuNSBjMC40LDYuNi0wLjksMTMuMy0zLjcsMTkuM2MtNS4zLDEwLjUtMTQuMSwxNi44LTI1LjQsMTkuN2MtMy41LDAuOS03LDEuMy0xMC42LDEuM2MtMjguNywwLjEtNTcuNSwwLjEtODYuMiwwLjFoLTEuNSBNNDM3LjksMjYwLjUgaDguN2MzLDAsNi0wLjMsOC45LTAuN2M3LjEtMS40LDEyLjQtNS4yLDE0LjItMTIuNmMwLjUtMi4yLDAuNy00LjQsMC41LTYuN2MtMC4zLTcuMi0zLjgtMTIuNC0xMC4zLTE1LjVjLTIuNC0xLjItNS4xLTEuOS03LjktMS45IGMtNC4zLTAuMS04LjUtMC4xLTEyLjgtMC4xbC0xLjMsMC4yVjI2MC41eiIvPjxwYXRoIGQ9Ik00MiwyMjIuOGMwLDAuNy0wLjEsMS4zLTAuMSwxLjl2Ny44aDI2LjJ2MTcuOWgtMjZ2OS45aDM2LjdWMjgwSDIwLjZ2LTc2LjloNTcuNXYxOS43SDQyeiIvPjxwb2x5Z29uIHBvaW50cz0iMzAxLjcsMjc5LjkgMzAxLjcsMjAzIDM1OS4zLDIwMyAzNTkuMywyMjIuNyAzMjMuMywyMjIuNyAzMjMuMywyMzIuNCAzNDkuMiwyMzIuNCAzNDkuMiwyNTAuMyAzMjMuMywyNTAuMyAzMjMuMywyNjAuMyAzNjAsMjYwLjMgMzYwLDI3OS45ICIvPjxwb2x5Z29uIHBvaW50cz0iMjcxLjIsMjIyLjggMjM2LjIsMjIyLjggMjM2LjIsMjM0IDI2My4xLDIzNCAyNjMuMSwyNTMuOSAyMzYuMSwyNTMuOSAyMzYuMSwyODAgMjE0LjgsMjgwIDIxNC44LDIwMy4xIDI3MS4yLDIwMy4xICIvPjxwYXRoIGQ9Ik00NDYuMywxMDQuNGwtMS43LDNsLTEtMC40Yy0xNS41LTkuMy0zMS45LTE2LjgtNDguNC0yNC4yYy05LjYtNC40LTE5LjQtOC4zLTI5LjUtMTEuNmMtNS0xLjYtOS44LTEuNi0xNC4zLDEuNCBjLTAuNywwLjQtMS4zLDAuOS0xLjksMS41Yy01LjYsNC42LTguNSwxMS0xMS4xLDE3LjVjLTMuMiw3LjgtNS40LDE2LjEtNi41LDI0LjVjLTAuMywyLjItMC41LDQuNC0wLjgsNi41IGMtMC43LDYuNCwxLjksMTEuNCw3LjYsMTQuNWM1LjQsMywxMS4yLDUuMSwxNy4yLDYuMmM4LjYsMS44LDE3LjEsMy41LDI1LjcsNS40YzYuOSwxLjYsMTMuNSw0LjcsMTkuMSw5YzMuNCwyLjUsNi43LDUuMiwxMC4xLDcuOSBjLTAuNSwwLjgtMC45LDEuNi0xLjQsMi40Yy0yLjEtMS4zLTQuMS0yLjQtNi0zLjZjLTQuOS0zLjMtMTAuMi02LTE1LjctNy45Yy02LjItMi4xLTEyLjYtMy4zLTE5LjEtMy42IGMtOS41LTAuNS0xOC44LTIuMS0yNy45LTQuOGwtMTEuNi0zLjVjLTUuOS0xLjgtMTEuMi00LjktMTYuMi04LjVjLTIuNi0xLjktMy43LTQuNS0zLjctNy42czEtNi42LDItOS44YzEuOS01LjksMy43LTExLjYsNi42LTE3IGMwLjMtMC43LDAuNi0xLjMsMC44LTEuOWMwLjctMi4zLDIuMS00LjMsMy45LTUuOWMzLjMtMywzLjYtNi44LDEuNC0xMS40YzEuNy04LjgsNC4zLTE3LjQsNy45LTI1LjdIMzY1bDEuOSwxLjQgYzguNSw2LjcsMTcuMiwxMy4xLDI2LjYsMTguOGM0LjEsMi40LDguMyw0LjYsMTIuNiw2LjVjMTMuNCw2LjEsMjYuNCwxMy4xLDM5LjMsMjAuMUw0NDYuMywxMDQuNCIvPjxwYXRoIGQ9Ik0yNDAuNyw0MDcuNWMtNi44LTExLjctMTMuNS0yMy4zLTIwLjEtMzQuOGMxLjQtMTAuMi0xLTE5LjUtNS42LTI4LjRjLTMuNy03LjItOC4yLTEzLjktMTIuNy0yMC44bC0xMC44LTE2LjNsLTAuOS0xLjUgYzEuMS0wLjQsMzEuNy0wLjcsMzQuNC0wLjJjNiw2LjIsMTguOCwyOC42LDIwLjMsMzUuN2MtMi43LDEuNy0zLjEsMy0yLjIsNi4yYzIuMiw2LjcsNC4zLDEzLjQsNi41LDIwYzAuNSwxLjYsMC43LDMuMiwwLjYsNC45IGMtMC42LDcuMi0xLjYsMTQuMy0zLjksMjEuMWMtMS42LDQuNS0zLjQsOC45LTUuMiwxMy4zQzI0MS4xLDQwNi45LDI0MC45LDQwNy4yLDI0MC43LDQwNy41Ii8+PHBhdGggZD0iTTQ0My4xLDEwOS45bC0xLjksMy4zbC0yLTEuMWwtMjEuOC0xMi4yYy02LjUtMy42LTEzLjctNS42LTIxLjEtNi42Yy04LjgtMS4xLTE3LjgsMC0yNi4xLDMuM2MtNS4zLDIuMS0xMC4xLDUuNC0xNCw5LjYgYy0yLDItMy42LDQuNC00LjcsN2MtMi4yLDUuMi0xLjQsMTAsMi4yLDE0LjNjMy42LDQuMyw3LjYsNi4zLDEyLjUsNy43YzUuNCwxLjYsMTEsMi43LDE2LjYsMy4yYzguNywwLjksMTYsNC45LDIxLjcsMTEuNSBjMywzLjYsNiw3LjMsOS4xLDExYy0wLjQsMC43LTAuOCwxLjQtMS4zLDIuM2wtMS41LTFsLTctNS42Yy02LjctNS40LTE0LjQtOC41LTIyLjYtMTAuNmMtNS40LTEuNC0xMS0yLjEtMTYuNS0zLjMgcy05LjUtMi4zLTE0LjItMy42Yy0yLjMtMC42LTQuNS0xLjUtNi44LTIuMmMtMi42LTAuOS00LjktMi40LTYuOC00LjRjLTEuNS0xLjYtMi40LTMuNi0yLjctNS43Yy0wLjgtNi41LDAuMy0xMi44LDIuMi0xOC45IGMxLjktNi4yLDMuOS0xMi44LDYtMTkuMWMxLjgtNS40LDUuMi0xMC4yLDkuOC0xMy42YzMuMS0yLjUsNy4xLTMuMywxMC45LTIuMmM3LjcsMi4yLDE1LjEsNC45LDIyLjMsOC4zYzEzLjIsNiwyNi41LDEyLDM5LjUsMTguMyBjNiwyLjksMTEuNyw2LjUsMTcuNiw5LjhDNDQyLjcsMTA5LjUsNDQyLjksMTA5LjcsNDQzLjEsMTA5LjkiLz48cGF0aCBkPSJNMjA4LjcsMTk2Yy02LjUsMC0xMi44LTAuMi0xOS4yLDAuMWMtMy45LDAuMy03LjgtMC45LTEwLjgtMy4zYy0zLjgtMi43LTcuOC01LjItMTItNy4zYy0xMC4zLTUuNS0xOS4yLTEzLjQtMjUuOC0yMy4xIGMtNC43LTYuNy05LjYtMTMuMS0xNC41LTE5LjdzLTkuNy0xNC41LTEyLjUtMjNjLTIuNi03LjQtNi4zLTE0LjMtMTEuMS0yMC41Yy00LjItNS44LTguOC0xMS4zLTEzLjEtMTcgYy01LjktNy45LTExLjgtMTYtMTcuNy0yMy45bC0wLjgtMS4zaDQuNmwwLjQsMC40YzIuOSwzLjYsNi4zLDYuNSw5LjYsOS42YzYuNSw2LjEsMTEuNywxMy4xLDE2LjUsMjAuNiBjNC43LDcuNSw4LjcsMTcuMiwxMi4xLDI2LjNjMS40LDMuOSwyLjksNy44LDQuNSwxMS42YzIuNCw1LjksNi41LDEwLjcsMTAuOCwxNS40YzUuMyw1LjgsMTEuNCwxMC44LDE3LjIsMTYgYzcuMyw2LjUsMTQuNywxMi44LDIyLDE5LjFjMywyLjYsNi40LDQuNSwxMC40LDVjNCwwLjUsNS4yLTAuOSw1LjQtNC40YzAuMS0zLTAuMS02LTAuNy04LjljLTEtNS0xLjktMTAtMi43LTE1LjEgYy0wLjctMy45LTAuMi03LjksMC40LTExLjZjMi4xLTEzLjUsNC41LTI2LjksOC44LTQwYzAuOC0yLjQsMS42LTQuOCwyLjUtNy4zYzAtMC4xLDAuMS0wLjIsMC4xLTAuMmw1LjYsMy4xIGMtMC4xLDAuNS0wLjIsMC45LTAuNCwxLjNjLTQuMSwxMi43LTcuNCwyNS41LTEwLjEsMzguNmMtMS43LDcuNy0xLjQsMTUuNywwLjcsMjMuM2MyLjEsNi45LDYuMiwxMi4yLDExLjksMTYuNSBjMy45LDIuOCw4LDUuMSwxMi40LDdjOC41LDMuOCwxNyw3LjQsMjUuNSwxMS4xbDEuNywxbC0wLjEsMC40bC0xLjMsMC4xaC0xMS42Yy0xLTAuMS0xLjktMC4zLTIuNy0wLjdjLTMuMS0xLjQtNi40LTIuMS05LjgtMi4xIEMyMTIuNSwxOTMuMiwyMTAuMywxOTMuNywyMDguNywxOTYiLz48cGF0aCBkPSJNNDAxLjcsMTgxLjdsLTguMiwxNC4zbC0yLjMtMC4zbC0xMi43LTEuOGwtMTAuOC0xLjFsLTExLjgtMS4zbC02LjgtMC41bC04LjUtMC43Yy04LjYtMC43LTE3LjEtMS44LTI1LjUtMy4zIGMtOC45LTEuNi0xNy40LTQuNC0yNS45LTcuNmwtMTEuNS00LjVMMjc2LDE3NHYtNi40bDEuOCwwLjVjNywyLjIsMTQuMSw0LjQsMjEuMSw2LjdjMy4yLDEsNi40LDEsOS42LDAuOGwxMy4zLTAuNmwxNi44LTEuMiBjOS42LTAuNywxOS4yLTAuNywyOC44LDBjMTEuNSwxLDIyLjMsNC44LDMzLjQsNy40TDQwMS43LDE4MS43Ii8+PHJlY3QgeD0iMjc1IiB5PSIyMDMuMSIgd2lkdGg9IjIxLjIiIGhlaWdodD0iNzYuOSIvPjxwYXRoIGQ9Ik0yNjkuMiwzNDMuM2wxLjItMC4yYzAtMi4yLTAuMS00LjMsMC4xLTYuNWMwLjEtMi4yLDEtNi4yLDMuNC04LjVjMC42LTAuNywxLjEtMS41LDEuNS0yLjNjMC44LTEuNiwwLjQtMi45LTEuMS0zLjkgYy0xLjEtMC42LTIuMi0xLjEtMy4zLTEuNWwtMTAuMi0zLjJsLTMuNC01LjlsMC4yLTAuNGwxMi43LDQuM2MxLjItMy4yLDAuOC02LjYsMS44LTEwLjFjMC41LDAuMywwLjksMC42LDEuMywxIGM2LjcsOS42LDExLjUsMjAuMiwxMy4yLDMyYzAuNiwzLjMsMC45LDYuNywwLjcsMTBjLTAuMywzLjktMC40LDcuNy0xLjEsMTEuNmMtMi4xLDExLjEtNS4xLDIxLjktOSwzMi41IGMtMy4zLDktNi44LDE3LjctMTEuOCwyNS45Yy0yLjksNC42LTUuNSw5LjQtOC4yLDE0LjFsLTEsMS44Yy0xLjctMy0zLjMtNS43LTQuOS04LjVjMC4zLTAuOCwwLjYtMS42LDEtMi40IGM0LjMtMTAuMiw4LjUtMjAuNSwxMS44LTMxLjJjMi4zLTcuOCw0LjEtMTUuOCw1LjItMjMuOWMwLjYtMy44LDAuNy03LjYsMS4xLTExLjRjMC4xLTAuNiwwLjItMS4zLDAuNC0xLjkgYzAuNC0xLjgsMC41LTMuNS0wLjQtNS4xYy0wLjItMC4xLTAuMy0wLjMtMC4zLTAuNUwyNjkuMiwzNDMuMyIvPjxwYXRoIGQ9Ik00MDguMywxNzAuM2wtMSwxLjVsLTEuNS0wLjVsLTEyLjgtNS41Yy05LjQtNC4zLTE5LjctNi40LTMwLTYuMmMtOC4xLDAuMS0xNi4yLTAuMS0yNC4zLTAuOWMtMi43LTAuMy01LjQtMC45LTgtMS42IGMtNy0yLjEtMTQtNC4yLTIxLTYuNHMtMTMuMS01LjYtMTkuMS05LjZjLTAuNy0wLjUtMS40LTEtMi4xLTEuNmMtNS00LjItNi42LTkuNy00LjUtMTZjMS0yLjgsMi4zLTUuNiwzLjUtOC4zIGMwLjMtMC41LDAuNy0xLDEuMS0xLjNjMy44LTQuMiw4LjMtNy43LDEzLjQtMTAuM2M0LjQtMi4yLDguOS00LDEzLjQtNS45bDEuNS0wLjRjLTAuMiwwLjYtMC40LDEuMi0wLjYsMS44IGMtMS42LDMuNi0zLjMsNy4xLTQuNywxMC44Yy0yLjEsNS4yLTMuNywxMC42LTQuOCwxNi4yYy0wLjYsMi45LDAuNCw1LjUsMS43LDhjMS4zLDIuNCwzLjEsNC40LDUuMyw1LjljNC4zLDMsOC45LDUuMywxMy45LDYuOSBjMTEsNCwyMi40LDYuNiwzNC4xLDhjMywwLjQsNi4yLDAuNCw5LjMsMC43YzkuNCwxLDE4LjUsMy40LDI2LjcsOC4zTDQwOC4zLDE3MC4zIi8+PHBhdGggZD0iTTQzNS44LDEyMi42bC0yLjgsNC45bC0zLjQtMS4zbC05LjUtM2MtNS4yLTEuNi05LjYsMC44LTExLjEsNi4yYy0wLjgsMi41LTAuNCw1LjIsMS4xLDcuM2MxLDEuMywyLjEsMi42LDMsMy45bDYuOCw5LjMgYy0xLDEuOS0yLDMuNi0zLjEsNS41bC0xLjMtMS4zYy0yLjctMy4xLTUuMy02LjMtOC4xLTkuM2MtNS45LTYuNC0xMi44LTEwLjktMjEuNS0xMi41Yy0zLTAuNS02LTAuNy05LjEtMS4xIGMtNS4xLTAuNi05LjktMi40LTE0LjUtNC43bC0xLjctMS4xYy0zLjYtMi43LTQuMi02LTEuNy05LjZjMi45LTQuMyw2LjktNy43LDExLjYtOS43YzExLjQtNC43LDIyLjktNC42LDM0LjQtMC4xIGM0LjIsMS43LDguMywzLjcsMTIuMiw1LjljNS42LDMsMTEsNi4zLDE2LjUsOS41TDQzNS44LDEyMi42IE0zNzguOSwxMDYuOWwtMi40LDAuN2MtNC45LDEtOS4zLDMuMi0xMy42LDUuOSBjLTAuOSwwLjYtMS41LDEuNC0xLjgsMi40Yy0wLjUsMi40LTAuNCw0LjcsMS42LDYuNWMwLjcsMC42LDEuMiwxLjMsMS45LDEuOWMzLjIsMi43LDYuNyw0LjcsMTEsNC4yYzIuMS0wLjMsNC4xLTAuOCw2LTEuNiBjNC4yLTEuMyw1LjMtNi42LDQuMi05LjVzLTEuOC00LjItMi41LTYuNUMzODIuNywxMDguOSwzODEsMTA3LjMsMzc4LjksMTA2LjkiLz48cGF0aCBkPSJNMTI4LjUsMTk1LjhsLTAuOC0xYy0xMS4xLTE1LjEtMjMuMy0yOS41LTM0LjktNDQuMmMtMS0xLjItMS44LTIuNS0yLjYtMy45Yy0xNy0yOS4zLTM0LTU4LjYtNTAuOS04OC4xbC0wLjktMS42IGMwLjctMC41LDEuMi0wLjMsMS42LDAuM2M4LjEsMTEuMiwxNy4zLDIxLjUsMjYuNywzMS41YzguNyw5LjEsMTUuNywxOS43LDIwLjgsMzEuM2M1LjksMTMuNiwxMy4xLDI2LjQsMjEuNywzOC40IGM0LjksNi45LDkuNSwxNC4xLDE0LjUsMjAuOWMzLjksNS4zLDguMiwxMC4yLDEyLjQsMTUuMWwwLjgsMS4xSDEyOC41eiIvPjxwYXRoIGQ9Ik00NDMuMywxNTdoLTNsMTYuOC0yOS4yYzUuNi05LjYsMTEuMi0xOS4zLDE2LjgtMjlsMTYuNy0yOC45bDE3LTI5LjRoLTkuOGw0LjQtNy45aC0zMTBjLTAuMS0wLjktMC4xLTEuNi0wLjEtMi4yIGMxLjMtMC42LDMxMi40LTAuNywzMTQuNS0wLjFjLTEuNCwyLjQtMi43LDQuOC00LjIsNy41TDUxMiwzOEM0ODguOSw3Ny45LDQ2Ni4xLDExNy40LDQ0My4zLDE1NyIvPjxwYXRoIGQ9Ik0yODAuNCwzOTFjMC4xLTAuNCwwLjItMC45LDAuNC0xLjNjNC4yLTExLjcsNy4yLTIzLjgsOC43LTM2LjFjMC42LTQuNCwwLjItOS0wLjMtMTMuNGMtMS4zLTEyLTUuNi0yMy42LTEyLjUtMzMuNSBsLTAuMy0wLjZjLTAuMS0wLjEsMC0wLjIsMC0wLjRoMjIuNmMzLjUsNC4zLDYsOS40LDcuMywxNC44YzEuNyw3LjQsMS4yLDE0LjgtMC40LDIyLjJjLTAuMiwxLjMtMC41LDIuNS0wLjgsMy44IGMtMC45LDMuNy0yLjMsNy4yLTQuMiwxMC41Yy02LjUsMTEtMTIuOCwyMi0xOS4xLDMzbC0wLjksMS40TDI4MC40LDM5MSIvPjxwYXRoIGQ9Ik0xODguNCw1Ni45aDguOWMtMC4zLDAuNy0wLjYsMS4zLTEsMS45Yy00LjksOC41LTkuNCwxNy4zLTEzLjQsMjYuM2MtMy43LDguNC02LDE3LjMtNi44LDI2LjRjLTAuNSw0LjgtMC40LDkuOC0wLjcsMTQuNyBjLTAuMyw2LjktMS43LDEzLjgtNC4yLDIwLjNsLTAuNywxLjZjLTIuNCw0LjgtNi42LDctMTEuOSw2LjFjLTcuNi0xLjMtMTMuNy01LTE4LjYtMTAuN2MtMy42LTQuMi02LjctOC44LTkuMy0xMy43bC0yMC4yLTM4LjMgYy01LjktMTEuMi0xMi4zLTIyLjEtMTkuMi0zMi45Yy0wLjQtMC41LTAuNy0xLjEtMS0xLjdsMS0wLjJIOTRsMS4xLDEuOWMxMC42LDE4LjMsMjEuMSwzNi43LDMwLjgsNTUuNWMxLjMsMi40LDIuMiw1LDMuNSw3LjMgYzEuMywyLjQsMy45LDcsNi4xLDEwLjNjNCw2LDEwLjMsMTAuMSwxNy40LDExLjNjNC43LDAuOCw4LjgtMC44LDEyLTQuMmM0LjItNC42LDYuMi0xMC4yLDYuOC0xNi40YzAuNC00LjEsMS4xLTguMiwxLjYtMTIuMiBjMC4zLTIuOCwwLjctNS42LDAuNy04LjVjMC4yLTUuNywxLjYtMTEuMywyLjktMTYuOGMxLjMtNS42LDMuOC0xMS45LDYuNS0xNy41YzEuNS0zLDIuOC02LDQuMi05TDE4OC40LDU2LjkiLz48cGF0aCBkPSJNOTcsNTYuOGg2LjVsMC45LDIuMWMzLjQsMTAsNy44LDE5LjcsMTIuMywyOS4zczEwLjgsMTguOCwxNy4zLDI3LjVjMy4yLDQuMiw2LjUsOC4yLDkuOCwxMi4zYzIuMSwyLjYsNSw0LjIsOC4zLDQuNyBjNi4xLDAuOCwxNC43LTQuOCwxMy44LTEzYy0wLjQtNC41LTEuMy05LTEuNy0xMy41Yy0wLjYtNi0wLjUtMTEuOSwwLjItMTcuOWMxLjMtMTAuNyw1LjYtMjAuNCw5LjktMzBjMC4yLTAuNSwwLjQtMC45LDAuNy0xLjMgaDkuOWMtMC4yLDAuNi0wLjQsMS4xLTAuNiwxLjZjLTIuMiw1LTQuMyw5LjktNi40LDE0LjhjLTMuOSw5LjQtNiwxOS40LTYuMiwyOS42YzAsMS4yLTAuNSwyLjMtMC43LDMuNWwtMC45LDkuOSBjLTAuNSw0LjMtMSw4LjctMi42LDEyLjhjLTAuNywyLTEuNyw0LTIuOSw1LjhjLTMuMyw1LTcuNSw2LjctMTMuMyw1LjFjLTIuNC0wLjctNC42LTEuNi02LjgtMi43Yy0xLjktMC44LTMuMS0yLjQtNC4zLTMuOSBjLTYuMy04LjQtMTEuMS0xNy43LTE2LTI2LjljLTguNi0xNi4xLTE3LjUtMzIuMS0yNi40LTQ3LjlDOTcuNiw1OC4xLDk3LjQsNTcuNiw5Nyw1Ni44Ii8+PHBhdGggZD0iTTE5NS4zLDgwLjljLTIuNCwwLjktMywxLjYtMi45LDQuN2MwLDIuMy0wLjQsNC42LTEuMyw2LjdjLTQuOCwxMi43LTguMywyNS45LTEwLjMsMzkuNGMtMC41LDMuNS0xLjIsNi45LTEuNiwxMC4zIGMtMC44LDYuMy0wLjUsMTIuNywwLjgsMTguOWMwLjYsMy4yLDEuNiw2LjIsMi4yLDkuM2MwLjMsMiwwLjQsNC4xLDAuMiw2LjFjLTAuMSwxLjctMS4xLDIuNC0yLjcsMi4xYy0xLjYtMC4zLTMuMi0wLjgtNC43LTEuNiBjLTIuMi0xLjMtNC4yLTIuNy02LjItNC4zYy03LTYtMTMuOS0xMi4yLTIwLjktMTguM2wtMC43LTAuN2wwLjEtMC40bDEuOSwwLjZjMi43LDEuNCw1LjYsMi40LDguNiwyLjljNy41LDEuMSwxMi45LTEuOCwxNS44LTguOCBjMi40LTUuOCwzLjgtMTIsNC4yLTE4LjNjMC41LTYuNiwwLjctMTMuMiwxLjMtMTkuOGMwLjktOS4zLDMuNS0xOC40LDcuNi0yNi44YzQuMS04LjUsOC42LTE2LjcsMTMtMjUuMWwwLjctMWg4LjIgQzIwNC4yLDY0LjksMTk5LjgsNzIuNywxOTUuMyw4MC45Ii8+PHBhdGggZD0iTTE0Ny44LDE5NS45aC03bC0xMC4yLTExLjZjLTE0LjItMTYuMi0yNS40LTM0LjMtMzQuOS01My42Yy03LjYtMTUuNS0xNi0zMC41LTI3LjItNDMuN2MtNS4zLTYuMi0xMS0xMi4yLTE2LjMtMTguNSBjLTMtMy4zLTUuNi03LTguMy0xMC42bC0wLjYtMWg4LjlsMC45LDEuMmM2LjYsMTAuNywxNC4xLDIwLjcsMjIuNCwzMC4yYzEuNCwxLjUsMi42LDMuMSwzLjcsNC44YzguNCwxMy4zLDE2LjYsMjYuNiwyNSwzOS45IGM2LjgsMTAuOSwxMy43LDIxLjgsMjAuNiwzMi42YzIuOCw0LjMsNiw4LjMsOS4xLDEyLjNjNC4yLDUuNSw4LjUsMTAuOCwxMi43LDE2LjJDMTQ3LDE5NC42LDE0Ny4zLDE5NS4yLDE0Ny44LDE5NS45Ii8+PHBhdGggZD0iTTQ1Ny44LDg0LjVsLTUuOC0zLjNjLTExLjQtNi41LTIzLjQtMTEuNi0zNS41LTE2LjRjLTQuOC0xLjktOS40LTQuNC0xNC02LjZjLTAuNi0wLjMtMS4yLTAuNi0xLjctMSBjMS4yLTAuNSw1Ny45LTAuOCw2NC41LTAuNGw1LjcsNUw0NTcuOCw4NC41Ii8+PHBhdGggZD0iTTI4My4xLDE1NC40bDEtMS42YzEuMi0yLjIsMC45LTQuMi0xLjItNS42Yy0xLjMtMC45LTIuNy0xLjYtNC4yLTIuMWwtMTYuNC01Yy0xLTAuMy0xLjgtMC45LTIuMy0xLjggYy0xLjMtMS45LTIuMS00LjEtMi41LTYuNGwyMC45LDYuMmMwLjctMy4yLDEuMy02LjMsMS45LTkuNGgwLjRjMC4xLDAuMywwLjIsMC43LDAuMiwxYy0wLjEsMy45LDEuNSw3LDQuMSw5LjggYzMuMiwzLjMsNi44LDYuMSwxMC44LDguMmM3LjMsNC4yLDE1LjIsNi45LDIzLjQsOWM2LjUsMS42LDEzLDMuMSwxOS41LDQuNWMyLjQsMC41LDUsMC40LDcuNCwwLjdjMS40LDAsMi44LDAuMiw0LjIsMC40IGMxOS44LTIuMiwzOC4xLDIuNyw1NS42LDEyLjJjLTAuMywwLjQtMC41LDAuOC0wLjcsMS4ybC04LjgtMi45Yy02LjEtMS44LTEyLjEtMy44LTE4LjMtNS4zYy00LjctMS4yLTkuNS0xLjgtMTQuNC0xLjkgYy0xLjgtMC4xLTMuNi0wLjQtNS40LTAuNGMtMS42LDAtMy4yLDAtNC43LDAuMmwtNi40LDAuNWMtMS4xLDAuMS0yLjMsMC4zLTMuNCwwLjZoLTcuMWMtMTAuOSwwLjItMjEuNy0xLjUtMzItNSBjLTYuNS0yLjQtMTMuMi00LjMtMTkuOC02LjVsLTEuNy0wLjciLz48cGF0aCBkPSJNMjYyLjgsNTYuOWg3LjZjLTMsOC43LTcuOSwxNi0xMy44LDIzLjFoMy4xYzYtNi44LDEwLjQtMTQuNywxMy45LTIzLjFoMTYuM2MtMS41LDguNi00LjcsMTYuOC05LjMsMjQuMWgtMTMuNyBjLTAuOCw0LjMtMS42LDguNS0yLjQsMTIuOGgtMTAuNWMtMC43LTQuMi0xLjYtOC41LTIuMy0xMi44aC00LjVDMjUyLjksNzIuOSwyNTkuNiw2NiwyNjIuOCw1Ni45Ii8+PHBhdGggZD0iTTI1Ni4zLDQ2Mi42bC01LjcsOS40Yy0zMi4xLTU1LjYtNjQtMTEwLjktOTYuMS0xNjYuNWwyLjQtMC44YzcuOSwxMy41LDE1LjcsMjcsMjMuNCw0MC40bDIzLjQsNDAuNWwyMy4zLDQwLjRsMjMuNiw0MC44IGw1LjYtOS4zYzEuOCwzLDMuNSw1LjcsNS4zLDguOGwzMS44LTU0LjlsMi4xLDEuN2wtMzMuOCw1OC40TDI1Ni4zLDQ2Mi42Ii8+PHBhdGggZD0iTTE2Mi43LDE5NS45aC0xMS42bC0xLjUtMS45Yy03LjQtOS45LTE1LjEtMTkuNS0yMi4yLTI5LjZjLTUuOS04LjMtMTEuMy0xNy0xNi43LTI1LjZjLTguNS0xMy42LTE2LjctMjcuNC0yNS4zLTQwLjkgYy0zLjgtNS45LTguMy0xMS40LTEyLjUtMTdjLTUuNi03LjMtMTEuNi0xNC40LTE2LjUtMjIuM2wtMS4xLTEuOWg1LjhjMC4zLDAuNSwwLjcsMSwxLDEuNmM1LjgsOS41LDExLjQsMTkuMSwxOC4xLDI4IGMzLjcsNSw3LjgsOS43LDEyLjIsMTQuMWMzLjIsMy4zLDUuOSw3LjIsNy45LDExLjRjMy4zLDYuNyw2LjMsMTMuNSw5LjksMjBjNy4yLDEyLjgsMTUuMiwyNSwyNC45LDM2LjFjMy42LDQuMiw3LjMsOC40LDExLjIsMTIuMyBjMy45LDMuOSw5LjMsOC44LDE0LDEzLjFsMi40LDJMMTYyLjcsMTk1LjkiLz48cGF0aCBkPSJNNjQuMiw1Ni44aDMuM2MwLjQsMC42LDAuOSwxLjEsMS4zLDEuN2M2LjMsOC41LDEyLjUsMTcuMSwxOC45LDI1LjdjMyw0LjEsNi41LDcuOSw5LjcsMTEuOWM0LjUsNS41LDguMywxMS41LDExLjQsMTggYzAuOSwxLjgsMS42LDMuNywyLjMsNS42YzIuNCw3LjUsNi4xLDE0LjYsMTAuOCwyMWM2LjgsOS4xLDEzLjQsMTguMywyMC4zLDI3LjNjNC45LDYuNSwxMC45LDEyLDE3LjgsMTYuMmwxNi44LDEwLjUgYzAuNSwwLjMsMC45LDAuNywxLjEsMS4yaC0xMC43bC0yLjUtMi4yYy04LjYtNy4yLTE2LjgtMTUuMS0yNC4zLTIzLjVjLTEyLjgtMTQuNC0yMy42LTMwLjQtMzIuMS00Ny43Yy0xLjgtMy43LTMuNi03LjMtNS4zLTExIGMtMi4xLTQuOC01LTkuMi04LjYtMTIuOWMtMTAuOC0xMC44LTE5LjUtMjMtMjYuOS0zNi4zQzY2LjUsNjAuNSw2NS40LDU4LjgsNjQuMiw1Ni44Ii8+PHBhdGggZD0iTTIzNi4zLDE4NS4xbDMuNiw2LjZsLTEtMC4xYy04LjItMy41LTE2LjUtNi44LTI0LjYtMTAuNWMtNi44LTIuOS0xMi45LTcuNC0xNy44LTEzLjFjLTQuNC00LjktNi43LTExLjQtNi41LTE4IGMwLTIuMi0wLjItNC41LDAtNi44YzAuMi0yLjIsMC44LTUuMywxLjMtOGMyLjUtMTIuMyw1LjctMjQuNCw5LjYtMzYuM2MwLjItMC42LDAuNC0xLjEsMC43LTEuOWw0LjcsMS44Yy0wLjEsMC42LTAuMywxLTAuNCwxLjUgYy00LjEsMTIuMi03LjQsMjQuNy05LjksMzcuNGMtMi43LDEzLjYsMS45LDI0LjMsMTIuNiwzMi43YzQuNSwzLjQsOS40LDUuOSwxNC41LDguM0wyMzYuMywxODUuMSIvPjxwYXRoIGQ9Ik0xMDYuNCw1Ni45aDIuNGMwLjIsMC42LDAuNiwxLjMsMC44LDEuOWM1LjUsMTQuNiwxMywyOC40LDIyLjQsNDAuOWMzLjEsNC4xLDYuNiw3LjksOS45LDExLjZjMS4zLDEuNiwzLjEsMi42LDUuMSwzLjEgYzQuNywxLjEsMTAuNi0xLjcsMTIuOC02YzAuNC0xLDAuOS0xLjksMS40LTIuOGgwLjNjMC4xLDEuMSwwLjMsMi4yLDAuNSwzLjNjMC43LDMuOCwxLjYsNy41LDEuNSwxMS40Yy0wLjEsNi4yLTQuOSw5LjMtOS42LDkuOCBjLTMuNiwwLjMtNi42LTEuNy04LjgtNC41cy01LjktNy4zLTguNi0xMS4xYy05LjEtMTIuNS0xNy40LTI1LjQtMjMuMy0zOS44Yy0yLjItNS42LTQuNC0xMS4xLTYuNS0xNi43IEMxMDYuNiw1Ny41LDEwNi41LDU3LjIsMTA2LjQsNTYuOSIvPjxwYXRoIGQ9Ik00MDMuNiwxNzcuOWMwLDAuMiwwLDAuNC0wLjEsMC41Yy0wLjEsMC4zLTAuMywwLjUtMC40LDAuN2wtMS42LTAuM2wtMTQuOS0zLjhjLTUuMy0xLjMtMTAuNi0yLjQtMTYtMy42IGMtMS45LTAuMy0zLjktMC40LTUuOS0wLjRjLTMuMS0wLjItNi4yLTAuNS05LjMtMC42Yy0zLjEtMC4xLTQuMiwwLjItNi4yLDAuM2wtMS45LDAuMmwtMjEuNywxLjNsLTE1LjEsMS4zYy00LjgsMC4zLTkuNS0wLjQtMTQtMiBsLTE4LjgtNi40bC0xLjUtMC42Yy0wLjEtMi43LDEuOC02LDQuNi04LjFsMS45LDAuNmMxMC42LDMuMywyMS4xLDYuOCwzMS44LDkuOWM2LjYsMS45LDEzLjUsMi4zLDIwLjMsMmwxOS42LTAuOCBjMS0wLjEsMi0wLjIsMy0wLjRsMS42LTAuMWMyLjcsMC4xLDUuNCwwLjIsOC4xLDAuNmM2LDEsMTIuMSwxLjgsMTcuOSwzLjZsMTcuNyw1LjZMNDAzLjYsMTc3LjkiLz48cGF0aCBkPSJNMTU4LDU2LjloNC41Yy0wLjIsMC43LTAuNCwxLjMtMC42LDEuOGMtMy42LDkuOS01LDIwLjQtNC4xLDMwLjljMC4xLDIuMywwLjIsNC41LDAuNCw2LjhjMC4xLDEuMSwwLjIsMi4xLDAuNSwzLjIgYzEuMSw0LjItMS4zLDkuNS01LjIsMTEuMmMtMC45LDAuNS0xLjgsMC44LTIuOCwxLjFjLTIuNCwwLjUtNC44LTAuMy02LjUtMi4xQzEzMyw5OC40LDEyMy43LDg1LDExNy4xLDcwLjMgYy0xLjctMy45LTMuMy03LjktNC45LTExLjljLTAuMS0wLjQtMC4yLTAuOS0wLjQtMS41aDIuM2wwLjcsMS4yYzIuMiw0LjUsNC40LDkuMSw2LjgsMTMuNGMzLjksNy4xLDguOCwxMy43LDE0LjUsMTkuNSBjMS40LDEuMywyLjksMi41LDQuNSwzLjZjNC43LDMuNSwxMC41LDEuMSwxMy4yLTEuOWMyLjctMywyLjktNS43LDMuMS04LjljMC4xLTIuNCwwLTQuNy0wLjMtN2MtMC43LTYuNC0wLjMtMTIuOSwxLjItMTkuMiBDMTU3LjgsNTcuNCwxNTcuOSw1Ny4xLDE1OCw1Ni45Ii8+PHBhdGggZD0iTTI0NS4xLDE2OC41YzIuOSwwLjcsNS44LDEuNCw4LjcsMi4ybDIwLjYsNi4xYzAuNywwLjEsMS40LDAuMiwyLjEsMC4yYzAuMS0wLjEsMC4xLTAuMywwLjEtMC40bDE4LjYsNyBjNS45LDIuMiwxMS43LDQuNSwxOCw1LjdsNC41LDAuNmwxNS4yLDJsMS4zLDAuMWMzLjEsMC4yLDYuMiwwLjIsOS4zLDAuOHM3LjEsMC43LDEwLjcsMS4xbDE1LDEuNmwwLjcsMC4xIGMtMC4xLDAuMS0wLjEsMC4yLTAuMSwwLjNoLTU5LjdjLTAuOSwwLTEuOC0wLjItMi42LTAuNWMtMTMuMy01LjQtMjYuNi0xMC44LTM5LjgtMTYuNGMtNi42LTIuOC0xMy4yLTUuOC0xOS43LTguOCBjLTEtMC40LTEuOS0xLTIuOC0xLjRDMjQ0LDE2OC41LDI0NSwxNjguNiwyNDUuMSwxNjguNSIvPjxwYXRoIGQ9Ik0wLDM3LjloOS43bC00LjItNy42YzEuMi0wLjUsMjMuNi0wLjYsMjUuNi0wLjFjMC4xLDAuNiwwLjIsMS4zLDAuNCwyLjJIOS43YzEuNiwyLjcsMi44LDUuMSw0LjQsNy44IGMtMy4zLDAuMi02LjMsMC4xLTkuNiwwLjNjMjcuOCw0OC4yLDU1LjYsOTYuNCw4My40LDE0NC40Yy0yLjIsMC42LTIuOSwwLjMtMy45LTEuNGMtMy4xLTUuMy02LjItMTAuNi05LjItMTZMMSwzOS44IEMwLjcsMzkuNCwwLjUsMzguOCwwLDM3LjkiLz48cGF0aCBkPSJNMjM1LjEsMTc1LjdjLTEuOSwzLjItMS45LDMuMi0xLjIsNS4zbC0xLjMtMC40Yy0yLjgtMS4zLTUuNi0yLjQtOC40LTMuN2MtNy40LTMuNC0xNC4xLTguMS0xOS43LTEzLjkgYy00LjUtNC43LTYuMi0xMC41LTYuNS0xN2MtMC4xLTUuNCwwLjYtMTAuNywyLjItMTUuOWw4LTI4bDAuNy0xLjlsNC43LDIuMmMtMC4zLDAuOC0wLjQsMS42LTAuNywyLjJjLTMuNCw4LjgtNS44LDE3LjktOC4yLDI2LjkgYy0xLjQsNS4xLTEuNSwxMC41LTAuNCwxNS43YzEuNCw2LjEsNC43LDExLjYsOS40LDE1LjdjMy45LDMuNiw4LjQsNi42LDEzLjMsOC44bDYuOCwzLjNMMjM1LjEsMTc1LjciLz48cGF0aCBkPSJNMzk3LjQsMTQwLjVjLTAuOC0wLjMtMS42LTAuNi0yLjMtMWMtNC4yLTIuMi04LjgtMy4xLTEzLjQtMy43Yy02LTAuOC0xMS45LTIuMS0xNy42LTRjLTMuNC0xLjEtNi40LTMuMi04LjgtNS45IGMtMi4yLTIuNS0zLTYtMi05LjNjMS40LTQuNyw0LjItOC44LDguMS0xMS43YzguOS03LDE5LjEtOS41LDMwLjMtOS4yYzUuOSwwLjIsMTEuNiwwLjgsMTcsMy4yYzMuMywxLjQsNi41LDIuNyw5LjYsNC41IGM2LjgsMy44LDEzLjcsNy43LDIwLjQsMTEuNmMwLjQsMC4yLDAuNywwLjQsMSwwLjdsLTIuNyw0LjdsLTEuNi0wLjlsLTE2LjMtOS42Yy02LjItMy42LTEyLjYtNi44LTE5LjctOC4zIGMtMy4zLTAuOC02LjctMS40LTEwLjItMS42Yy0zLjMtMC4xLTYuNiwwLjItOS44LDAuOGMtNy4xLDEuMS0xMy42LDMuOS0xOC45LDguOGMtMiwxLjgtMy43LDQtNC45LDYuNWMtMS44LDMuNi0xLjMsNywxLjUsOS45IGMxLjQsMS4zLDMsMi40LDQuNywzLjNjNC45LDIuNCwxMC4zLDMuNSwxNS43LDQuNWM1LjMsMSw5LjEsMS43LDEzLjYsMi45YzEuOSwwLjQsMy42LDEuNSw1LjQsMi40YzAuNCwwLjMsMC44LDAuNiwxLjIsMSBMMzk3LjQsMTQwLjUiLz48cGF0aCBkPSJNMjM5LjMsMTcyLjVsLTIsMS41Yy0yLjctMS4zLTUuNC0yLjQtNy45LTRjLTQuNC0yLjUtOC42LTUuMi0xMi43LTguMWMtNS44LTQuMS05LjUtMTAuNC0xMC4yLTE3LjQgYy0wLjYtNC42LTAuMi05LjMsMS4yLTEzLjhjMi41LTguNyw1LjMtMTcuMiw4LTI1LjhjMC4xLTAuMywwLjMtMC43LDAuNC0xbDQuMiwyLjdjLTAuMiwwLjYtMC40LDEuMi0wLjYsMS43IGMtMy4xLDcuNy01LjUsMTUuNi03LjMsMjMuN2MtMS44LDguNCwwLjUsMTUuOCw1LjksMjIuMmM0LDQuNyw4LjksOC41LDE0LjQsMTEuNGM3LDMuOCwxNC4yLDcuMywyMS4zLDEwLjhsMS41LDAuOCBjMCwwLjEtMC4xLDAuMi0wLjEsMC40TDIzOS4zLDE3Mi41Ii8+PHBhdGggZD0iTTE1Mi40LDU2LjloMi43Yy0wLjEsMC43LTAuMiwxLjUtMC4zLDIuMmMtMS4xLDQuMi0wLjcsOC42LTAuOCwxMi45YzAsMi4yLTAuMSw0LjMtMC4xLDYuNHMwLjIsMiwwLjMsMyBjMC4xLDAuNywwLjEsMS4zLDAuMSwyYy0wLjEsMS4xLTAuMywyLjItMC40LDMuM2MtMC41LDMuNi0zLDUuNS02LDYuN3MtNS4xLDAuMS03LjEtMS45cy00LjUtNC42LTYuNy03IGMtNy4xLTcuOC0xMi43LTE3LTE2LjMtMjYuOWMtMC4xLTAuMi0wLjEtMC40LTAuMi0wLjhsMi42LTAuMWwxLDEuNmMyLjQsNC4zLDUuMSw4LjUsOC42LDEyLjFjMiwyLjEsNC4xLDQsNi41LDUuNyBjNC43LDMuMywxMiwzLjEsMTUuMS00LjZjMC44LTIuNCwxLjItNSwxLjItNy42QzE1Mi41LDYxLjYsMTUyLjQsNTkuMywxNTIuNCw1Ni45Ii8+PHBhdGggZD0iTTIxNy43LDM2Ny43bC0zNS45LTYyLjJoNS45YzAuNCwwLjQsMC43LDAuOSwxLDEuM2M3LjMsMTEuNiwxNC43LDIzLjEsMjEuOSwzNC42YzMuMiw1LDUuOCwxMC41LDYuOSwxNi4zIGMwLjYsMywwLjUsNiwwLjcsOS4xYzAsMC4zLTAuMSwwLjUtMC4xLDAuN0wyMTcuNywzNjcuNyIvPjxwYXRoIGQ9Ik0zMjksNTYuOWMtNC4zLDcuOC01LjQsMTYuMi03LjMsMjQuM2gtMTYuNWMyLjgtOC4xLDMuOC0xNi4yLDUuNC0yNC4zTDMyOSw1Ni45eiIvPjxwYXRoIGQ9Ik0yNjYuOSwzNjNjMC4xLDAuOCwwLjEsMS43LDAsMi41Yy0wLjgsNS43LTEuOCwxMS40LTMuMSwxNi45Yy0zLjMsMTMuNS04LjIsMjYuMy0xMy43LDM5bC0wLjcsMS4ybC03LTEyLjIgYzUuMi0xMC4yLDguNC0yMS4xLDEwLjUtMzIuM2MxLjksNS4zLDIuOCwxMC45LDQuNSwxNi4zaDEuN2MwLjQtMi4xLDAuOC00LjIsMS4zLTYuMmMxLjMtNi41LDIuNy0xMy4xLDQuMi0xOS43IGMwLjUtMS45LDEuMi0zLjgsMS45LTUuNkwyNjYuOSwzNjN6Ii8+PHBhdGggZD0iTTI4My44LDgwLjljNC43LTcuNiw3LjMtMTUuNiw5LTI0aDE1Yy0xLjIsOC4yLTIuMiwxNi4zLTUuNCwyNEgyODMuOHoiLz48cGF0aCBkPSJNMjM5LjIsMTY1LjlsLTQuNi0yLjZjLTQuOC0yLjctOS42LTUuNy0xMy41LTkuNmMtMy45LTMuOS02LjYtOS4zLTYuNS0xNS41YzAtNC40LDAuNy04LjgsMi4yLTEzYzEuNy00LjgsMy4zLTkuNiw1LTE0LjQgYzAuMy0wLjgsMC42LTEuNiwxLTIuNGwzLjgsMy4zbC0wLjcsMS45Yy0xLjksNC44LTMuOCw5LjYtNC43LDE0LjhjLTAuNywzLjgtMC43LDcuNi0wLjEsMTEuNGMwLjUsMi44LDEuNyw1LjQsMy42LDcuNiBjMy4zLDQuMSw3LjEsNy43LDExLjQsMTAuOGMwLjUsMC4zLDAuOSwwLjcsMS4yLDEuM0MyMzcuOSwxNjEuNSwyMzguNSwxNjMuNiwyMzkuMiwxNjUuOSIvPjxwYXRoIGQ9Ik0zNzAuNCw1Ni45aDYuN2MxLjksMS41LDMuOSwzLjIsNS45LDQuOGM3LjgsNi4yLDE1LjksMTEuNywyNC45LDE2YzExLjQsNS4zLDIyLjksMTAuOCwzNC4yLDE2LjJjMi4yLDEsNC4yLDIuMyw2LjIsMy40IGwxLjUsMWwtMi4yLDMuOGwtMC45LTAuM2wtNDEtMjEuNGMtOC40LTQuMi0xNi4zLTkuMS0yMy44LTE0LjdsLTEwLjMtNy41bC0xLjMtMUMzNzAuNCw1Ny4xLDM3MC40LDU2LjksMzcwLjQsNTYuOSIvPjxwYXRoIGQ9Ik0xNDQuNiw1Ni45aDUuNWMwLjEsMC42LDAuMSwxLjIsMC4xLDEuOGMtMC4zLDMuNi0wLjYsNy4zLTEuMSwxMWMtMC42LDMuMy0zLjMsNS43LTYuNiw2Yy0xLjIsMC4xLTIuMy0wLjEtMy4zLTAuNyBjLTEuNC0wLjktMi43LTEuOS0zLjktM2MtNC4yLTMuNy03LjktOC0xMC44LTEyLjhsLTEuMy0yLjRjMS40LDAuMSwyLjgsMC4xLDQuMiwwYzEuOS0wLjIsMy43LDAuMyw1LjIsMS41IGMxLjMsMS4xLDIuOCwxLjcsNC41LDEuOWMyLjYsMC40LDQuOSwwLDYuNy0yLjFMMTQ0LjYsNTYuOSIvPjxwYXRoIGQ9Ik0zODEuNCw1Ni44aDQuMmw1LjksNC4zYzcuNyw1LjQsMTYsOS45LDI0LjcsMTMuNGM5LjksNC4xLDE5LjksOC40LDI5LjMsMTMuN2w2LjEsMy42bDEuNCwxYy0wLjcsMS4yLTEuMywyLjItMS45LDMuNCBsLTAuOS0wLjRjLTEzLjQtNy44LTI3LjUtMTQuNS00MS43LTIwLjdjLTUuOS0yLjYtMTEuNS01LjktMTYuNy05LjhjLTMuMS0yLjQtNi40LTQuNy05LjYtN2wtMS0wLjkgQzM4MS4zLDU3LDM4MS40LDU2LjksMzgxLjQsNTYuOCIvPjxwYXRoIGQ9Ik00NTYuNCw4Ni45bC0xLjgsMy4xbC0wLjgtMC4zYy0xMi40LTcuMi0yNS4zLTEzLjQtMzguNy0xOC41Yy04LjQtMy40LTE2LjMtNy45LTIzLjYtMTMuNGMtMC4zLTAuMi0wLjYtMC40LTAuOC0wLjcgYzIuMi0wLjIsNC4yLTAuNyw2LjEsMC42YzguMiw1LjMsMTcuMSw5LjIsMjYuMywxMi41YzExLjQsNCwyMi4yLDkuNCwzMi4zLDE2TDQ1Ni40LDg2LjkiLz48cGF0aCBkPSJNNDMxLjcsMTI5LjdjLTMuNSw1LjktNi44LDExLjctMTAuMiwxNy43bC0xLTEuMmMtMi4zLTMtNC41LTYuMS02LjktOWMtMS43LTIuMS0yLjQtNC43LTEuOS03LjNjMC4yLTIuNCwyLjItNC4yLDQuNS00LjIgYzEuNS0wLjEsMy4xLDAuMSw0LjYsMC40YzMuMiwwLjksNi4zLDIsOS41LDNMNDMxLjcsMTI5LjciLz48cGF0aCBkPSJNMjI4LjQsMTEzLjhsMywzLjVjLTAuNiwyLTEuMiw0LTIsNS45Yy0xLjksNC4yLTEuMyw4LjQtMC4xLDEyLjdjMC4xLDAuNiwwLjQsMS4yLDAuNiwxLjlsLTAuNiwxbDQuOCw4IGMxLjUsMi42LDMuMiw1LjEsMy4xLDguM2MtMC4yLDAuMS0wLjMsMC4xLTAuNCwwLjFjLTMuNi0yLjYtNy01LjMtOS44LTguOWMtMy41LTQuNC01LTEwLTQuMi0xNS42IEMyMjMuNywxMjQuOCwyMjYsMTE5LjUsMjI4LjQsMTEzLjgiLz48cGF0aCBkPSJNMzA3LjcsMzQzLjZjMy42LTEzLjQsMy0yNi4zLTUuNy0zOC4xaDUuMmM1LjIsNS45LDguNiwxMywxMS4yLDIwLjZMMzA4LDM0My44TDMwNy43LDM0My42Ii8+PHBhdGggZD0iTTI1NC4zLDEzMC45YzAuOSwyLjUsMS42LDQuOSwyLjUsNy40bC0xLjYtMC40Yy01LTEuMy0xMC4yLTIuNS0xNS4zLTMuOWMtMS43LTAuNS0zLjYtMC4yLTUsMC44bC0yLjQsMS41IGMtMi40LTQuNS0xLjktMTEuNCwwLjgtMTYuMmwxLjIsMS43YzEuNCwyLjQsMy43LDQuMSw2LjQsNC45QzI0NS40LDEyOCwyNDkuOCwxMjkuNiwyNTQuMywxMzAuOSIvPjxwYXRoIGQ9Ik0yMjguNywzMDUuNGgxNC41YzMuMSwxLjMsNS43LDIuNCw4LjQsMy4zYzEsMC4zLDEuOSwxLDIuNCwxLjljMSwxLjgsMi4xLDMuNSwzLDUuMmwtMC4yLDAuM2wtMi40LTAuNmwtOC40LTIgYy0xLjctMC42LTMuNy0wLjMtNS4yLDAuN2wtMi42LDEuNGMxLjQsMy43LDMuNiw3LjEsNC4yLDExLjFMMjI4LjcsMzA1LjQiLz48cGF0aCBkPSJNMjU5LjUsNTYuOWMtMC43LDQuNS05LjQsMTcuNy0xNS44LDI0aC03LjFjMC40LTAuNywwLjYtMS4yLDAuOS0xLjZjMS45LTIuNSwzLjYtNSw1LjUtNy41YzMuMy00LjQsNi4zLTkuMSw4LjgtMTMuOSBsMC42LTFMMjU5LjUsNTYuOXoiLz48cGF0aCBkPSJNMjQyLDU2LjloN2MtNCw4LjktMTAuMiwxNi4yLTE1LjcsMjRoLTYuN2MwLjQtMC43LDAuNi0xLjIsMC45LTEuNmMxLjktMywzLjgtNi4xLDUuNy05LjFDMjM2LjEsNjUuOCwyMzksNjEuNCwyNDIsNTYuOSIgLz48cGF0aCBkPSJNMjMxLjQsNTYuOGg3LjVjLTAuMywwLjYtMC42LDEuMi0xLDEuOEwyMjguMyw3M2MtMS43LDIuNi0zLjIsNS4zLTQuOSw3LjloLTYuM0MyMjEuMSw3Mi41LDIyNS45LDY0LjQsMjMxLjQsNTYuOCIvPjxwYXRoIGQ9Ik0yMjAuOCw1Ni44aDcuNmMtNS4yLDgtMTAuNCwxNS43LTE0LjIsMjQuMUgyMDhDMjExLjMsNzIuMywyMTYsNjQuNSwyMjAuOCw1Ni44Ii8+PHBhdGggZD0iTTIxMS45LDU2LjloNi4yYy00LjksOC05LjcsMTUuNy0xMy4zLDI0aC02LjRDMjAyLjMsNzIuNCwyMDcuMSw2NC43LDIxMS45LDU2LjkiLz48cGF0aCBkPSJNMzUxLjUsMzExLjNsMi4yLDAuOGMtOS43LDE3LTE5LjQsMzMuNy0yOS4yLDUwLjdsLTEuNS0xLjlDMzIzLjIsMzU5LjQsMzUwLjMsMzEyLjUsMzUxLjUsMzExLjMiLz48cGF0aCBkPSJNMTYxLjEsOTUuMmMtMi42LTEzLjItMC4xLTI1LjgsNC4zLTM4LjRoNi44Yy0wLjQsMC45LTAuNiwxLjUtMC45LDIuMWMtMy41LDcuNC02LjYsMTQuOS04LjMsMjNjLTAuOSwzLjktMS40LDgtMS40LDEyIGMwLDAuNCwwLDAuOS0wLjEsMS4zSDE2MS4xIi8+PHBhdGggZD0iTTEwMi45LDI4Ni4xaDMuNmw1LjgsNy4zaDAuMnYtNy4xaDMuNnYxMy4xaC0zLjZsLTUuNi03LjFsLTAuNCwwLjF2N2gtMy42VjI4Ni4xeiIvPjxwYXRoIGQ9Ik0xMDEsMTY0LjljOC44LDkuNywxNi4xLDIwLjUsMjQuMSwzMC42Yy0wLjEsMC4xLTAuMSwwLjMtMC4xLDAuNGgtNi40bC0xNy45LTMwLjlMMTAxLDE2NC45Ii8+PHBhdGggZD0iTTI0OC41LDM0MS43Yy0wLjgtMS45LTEuNi0zLjktMi40LTUuOWwwLjEtMC40bDIwLDYuNWMwLjIsMi4xLDAuNCw0LjIsMC43LDYuNUwyNDguNSwzNDEuNyIvPjxwYXRoIGQ9Ik0xNDguNiwyOTkuM1YyODZjMi40LDAuMSw0LjktMC40LDcuMywwLjRjMi45LDEuMSw0LjcsNCw0LjQsNy4xYy0wLjMsMy0yLjYsNS40LTUuNiw1LjggQzE1Mi43LDI5OS40LDE1MC42LDI5OS40LDE0OC42LDI5OS4zIE0xNTIuMywyOTYuMWMxLjYsMC4zLDIuOS0wLjEsMy42LTEuNmMwLjctMS4yLDAuNy0yLjctMC4xLTMuOWMtMC43LTEuMi0yLjItMS44LTMuNi0xLjMgTDE1Mi4zLDI5Ni4xeiIvPjxwYXRoIGQ9Ik0zMjMuNCwyOTQuMWMxLjMsMS43LDIuNSwzLjMsMy45LDUuM2gtNC41bC0yLjctNGgtMC4zdjMuOWgtMy43di0xMy4xYzIuNCwwLDQuNy0wLjEsNywwLjFjMi4zLDAuMiwyLjUsMS42LDIuNywzLjIgYzAuMiwxLjYtMC4xLDMuMi0xLjcsNC4yTDMyMy40LDI5NC4xIE0zMjAsMjg5djIuN2MxLjMsMC4zLDIuMS0wLjEsMi4zLTEuM0MzMjIuNSwyODkuMSwzMjEuMywyODguNywzMjAsMjg5Ii8+PHBhdGggZD0iTTEzNC43LDE0Mi40Yy0wLjktMC42LTEuNy0xLjMtMi40LTIuMWMtMi43LTMuMi01LjMtNi40LTcuOS05LjZjLTIuNS0zLjMtNC41LTguNS01LjktMTMuMWMtMC45LTMuMS0yLjEtNi4yLTMtOS4zIGMtMC4yLTAuNi0wLjMtMS4xLTAuMy0xLjdsMC40LTAuMmM2LjUsMTEuOSwxMywyMy43LDE5LjUsMzUuNUwxMzQuNywxNDIuNCIvPjxwYXRoIGQ9Ik0xOTEuOSwyODYuMWgzLjZjMC4xLDAuNiwwLjEsMS4xLDAuMSwxLjd2Ni4yYzAuMSwxLjYsMC44LDIuNSwyLjIsMi41czIuMS0wLjksMi4yLTIuNGMwLjEtMS42LDAtNCwwLjEtNS45IGMwLTAuNywwLTEuMywwLjEtMmgzLjVjMC4xLDAuNiwwLjEsMS4xLDAuMSwxLjd2Ni4xYzAsMi4zLTAuOSw0LjItMyw1LjJjLTIuMiwxLjItNSwwLjktNy0wLjZjLTAuNi0wLjUtMS4xLTEuMi0xLjMtMS45IEMxOTEuNiwyOTMuMSwxOTIuMSwyODkuNiwxOTEuOSwyODYuMSIvPjxwYXRoIGQ9Ik0zMjQuNSwzMTUuNGwtNC4yLDcuMkgzMjBjLTIuMi02LTUuNS0xMS42LTkuMi0xNy4xaDcuNkwzMjQuNSwzMTUuNCIvPjxwYXRoIGQ9Ik05NS40LDMyLjRjMC4yLTAuOSwwLjMtMS41LDAuNC0yYzEuNi0wLjcsMzMuNy0wLjcsMzUuMywwYy0wLjIsMC43LTAuMywxLjMtMC40LDJIOTUuNHoiLz48cGF0aCBkPSJNMjQ0LjgsMjg2LjljLTAuNCwwLjktMC45LDEuNy0xLjMsMi42Yy0xLjMtMC4zLTIuNy0xLjYtMy45LDAuNGwxLjQsMWwxLjUsMC41YzIsMC43LDIuOCwxLjgsMi45LDMuNiBjMC4xLDEuOS0xLDMuNy0yLjgsNC41Yy0yLjQsMC45LTUuMiwwLjQtNy4xLTEuM2wxLjMtMi41YzMuOCwxLjUsMy45LDEuNSw0LjgtMC4zYy0wLjQtMC4zLTAuOS0wLjYtMS4zLTAuOWwtMS4zLTAuNCBjLTIuMy0wLjgtMy4xLTEuOS0zLTMuOGMwLTIuMSwxLjQtMy44LDMuNC00LjNDMjQxLjIsMjg1LjQsMjQzLjIsMjg1LjgsMjQ0LjgsMjg2LjkiLz48cGF0aCBkPSJNNDQxLjEsMjg5LjVjLTIuOC0xLTMuMS0xLTMuNiwwLjdjMC43LDAuMywxLjQsMC42LDIuMSwwLjljMi43LDAuOSwzLjYsMi4xLDMuNCw0LjNjLTAuMiwyLjItMS42LDMuOC00LDQuMiBjLTIuMSwwLjQtNC4yLTAuMi01LjktMS41bDEuNC0yLjdjMy42LDEuNiw0LjUsMS42LDQuNi0wLjZsLTIuNi0xYy0yLjMtMC44LTMtMS44LTIuOC00LjJjMC4xLTIsMS43LTMuNiwzLjYtMy45IGMxLjgtMC4zLDMuNywwLjIsNS4yLDEuMkw0NDEuMSwyODkuNSIvPjxwYXRoIGQ9Ik0xMDAuMSw3OS4zYy0wLjQtMC40LTAuNy0wLjgtMS0xLjNjLTIuNC0zLTQuNy02LjEtNy4yLTkuMWMtMS4yLTEuMy0yLjUtMi42LTMuOC0zLjlsLTcuOC03LjNsLTAuNi0wLjlIODcgYzUuNiw2LjcsOS4zLDE0LjUsMTMuNywyMkwxMDAuMSw3OS4zIi8+PHBhdGggZD0iTTM5NC4zLDI5OS4zdi0xMy4yaDcuNnYyLjhsLTMuOSwwLjN2MS44bDMuNiwwLjF2Mi45bC0zLjYsMC4ydjEuOWgzLjl2My4xSDM5NC4zeiIvPjxwYXRoIGQ9Ik0yODEuNCwxOTMuNWMtMC43LTIuNC0xLjMtNC4zLTItNi41bDIxLjksOC42Yy0wLjEsMC4xLTAuMSwwLjItMC4xLDAuM2gtMTIuNmMtMC45LTAuMS0xLjktMC4zLTIuNy0wLjYgQzI4NC4yLDE5NC43LDI4Mi43LDE5NCwyODEuNCwxOTMuNSIvPjxwYXRoIGQ9Ik00OS43LDI5MS4ydjIuNEgyMC40YzAtMC4zLTAuMS0wLjctMC4xLTF2LTEuNEg0OS43eiIvPjxwYXRoIGQ9Ik00NTguNywyOTMuNHYtMi4yaDI5LjRjMCwwLjcsMC4xLDEuNCwwLjEsMi4xQzQ4Ni45LDI5My44LDQ2MC41LDI5My44LDQ1OC43LDI5My40Ii8+PHBhdGggZD0iTTI1MS40LDQ3NC40YzEuNi0yLjYsMy01LDQuNy03LjhsNC42LDcuN2wtNC42LDcuOEwyNTEuNCw0NzQuNCIvPjxwYXRoIGQ9Ik0yNzguNiwyODkuM2wtMi42LTAuNHYtMi45aDkuMXYyLjlsLTIuNywwLjR2MTBoLTMuOFYyODkuM3oiLz48cGF0aCBkPSJNMTUzLjksMzIuNGwtMC40LTIuMmMwLjYtMC4yLDEuMy0wLjMsMS45LTAuM0gxNzZsMS43LDAuMnYyLjJIMTUzLjl6Ii8+PHJlY3QgeD0iMzU4LjQiIHk9IjI4Ni4xIiB3aWR0aD0iMy40IiBoZWlnaHQ9IjEzLjMiLz48cmVjdCB4PSI2Ni45IiB5PSIyODYuMSIgd2lkdGg9IjMuNSIgaGVpZ2h0PSIxMy4yIi8+PHBhdGggZD0iTTMzMC4yLDMwNS41bC00LjIsNy40bC00LjQtNy40SDMzMC4yeiIvPjxwYXRoIGQ9Ik00NzMuNyw1Ni45bC0xLjYsMi43bC0yLjktMi40bDAuMi0wLjRINDczLjd6Ii8+PHBhdGggZD0iTTEzOS43LDU3LjFoLTN2LTAuMmgyLjlDMTM5LjYsNTcsMTM5LjYsNTcsMTM5LjcsNTcuMSIvPjxwYXRoIGQ9Ik0yMTQuNSwxOTUuNmgyLjN2MC4yaC0yLjNWMTk1LjYiLz48cGF0aCBkPSJNMjc3LjgsMTk1LjVjMC4xLTAuMSwwLjMtMC4yLDAuNC0wLjFjMC4xLDAuMSwwLjQsMC4xLDAuNywwLjRsLTAuNywwLjJsLTAuNS0wLjFWMTk1LjUiLz48cGF0aCBkPSJNMzc1LjEsMTI2Yy0yLjcsMC01LjMtMS03LjQtMi43Yy0xLjEtMC45LTIuMi0xLjktMy4xLTNjLTEuMy0xLjQtMS4zLTMuNiwwLjEtNC45YzAuMy0wLjMsMC42LTAuNSwwLjktMC42IGMzLjYtMS45LDcuMy0zLjYsMTEtNS4zYzEuOS0wLjksNC43LDEsNC43LDMuMWMwLjEsMS40LDAuNSwyLjgsMS4zLDQuMWMwLjQsMC44LDAuNywxLjYsMC45LDIuNGMwLjYsMi0wLjIsNC4xLTIuMSw1IEMzNzkuNSwxMjUuMywzNzcuNCwxMjYsMzc1LjEsMTI2Ii8+PC9nPjwvc3ZnPg=="); }
  /* EMBLEM_MASK_END */
      /* Optional bounded frost. No full-window blur, nested filters or animation. */
      body[data-endfield-glass] {
        --edge-glass-fill: 248 247 240;
        --edge-glass-alpha: .8;
        --edge-glass-blur: 14px;
        --edge-glass-edge: rgb(255 255 255 / .65);
        --edge-glass-sheen: rgb(255 255 255 / .35);
      }
      body[data-endfield-glass][data-ds-dark-theme] {
        --edge-glass-fill: 31 36 34;
        --edge-glass-alpha: .76;
        --edge-glass-edge: rgb(255 255 255 / .18);
        --edge-glass-sheen: rgb(255 255 255 / .07);
      }
      body[data-endfield-glass='subtle'] { --edge-glass-alpha: .68; --edge-glass-blur: 8px; }
      body[data-endfield-glass='strong'] { --edge-glass-alpha: .9; --edge-glass-blur: 22px; }
      body[data-endfield-glass='subtle'][data-ds-dark-theme] { --edge-glass-alpha: .64; }
      body[data-endfield-glass='strong'][data-ds-dark-theme] { --edge-glass-alpha: .88; }
      /* Glass is COMPOSER-ONLY. The docked right panel used to share the
         material, and because it spans half the screen the translucent fill
         read as 'half the page is frosted' even without blur — a big slab of
         milky overlay with nothing local to show for it. The panel now keeps
         its native opaque background entirely: no fill, no sheen, no edge.
         The left sidebar keeps a STATIC sheen (no blur, no fill). */
      body[data-endfield-glass] [data-composer-card] {
        background-color: rgb(var(--edge-glass-fill) / var(--edge-glass-alpha)) !important;
        background-image: linear-gradient(145deg, var(--edge-glass-sheen), transparent 58%),
          radial-gradient(ellipse at 0% 0%, color-mix(in srgb, var(--edge-accent) 10%, transparent), transparent 75%) !important;
        -webkit-backdrop-filter: blur(var(--edge-glass-blur)) saturate(1.05);
        backdrop-filter: blur(var(--edge-glass-blur)) saturate(1.05);
        --dsw-elevation-stroke-color: var(--edge-glass-edge);
      }
      body[data-endfield-glass] [data-slot='sidebar'] > div {
        background-image: linear-gradient(145deg, var(--edge-glass-sheen), transparent 58%),
          radial-gradient(ellipse at 0% 0%, color-mix(in srgb, var(--edge-accent) 8%, transparent), transparent 75%);
        box-shadow: inset -1px 0 0 var(--edge-glass-edge);
      }
      @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
        body[data-endfield-glass] [data-composer-card] {
          background-color: rgb(var(--edge-glass-fill) / .96) !important;
        }
      }
      @media (prefers-reduced-transparency: reduce) {
        body[data-endfield-glass] [data-composer-card] {
          background-color: rgb(var(--edge-glass-fill)) !important;
          -webkit-backdrop-filter: none; backdrop-filter: none;
        }
      }
      /* ---------- selection + caret: the official interaction GRAYS ----------
         Measured from the official site's own CSS: hover and selection surfaces
         are a gray scale there (#d9d9d9/#f0f0f0 light, #484848/#626262 dark)
         while the accent stays a rare SIGNAL. Text selection is the most
         repeated interaction in this UI, so it follows the official grammar in
         EVERY palette — a yellow selection reads as a highlighter and was
         reported as exactly that. These tokens are scheme-only: no palette
         class ever overrides them. Pairs stay AA:
           light #d9d9d9 + ink 13.41:1 · dark #6a6a6a + white 5.41:1 */
      body {
        --edge-select-fill: #d9d9d9;
        --edge-select-ink: #101110;
        --edge-caret: #666666;
      }
      body[data-ds-dark-theme] {
        --edge-select-fill: #6a6a6a;
        --edge-select-ink: #ffffff;
        --edge-caret: #d9d9d9;
      }
      ::selection {
        color: var(--edge-select-ink, #000);
        background: var(--edge-select-fill, #d9d9d9);
      }
      /* ================= 按钮交互动效（六套方案，data-endfield-motion 切换） =======

         每套方案是「一种动效母题 × 不同按钮角色」，切换只动 <body> 上的一个
         data-* 值；下面所有规则都以该属性为前缀，互斥生效。

         方案A signal（默认）：官网签名复刻
           · 全局 .2s 颜色过渡（hover 不再瞬变）
           · :active 按下 = 底色暗一档
           · 主 CTA / 新会话按钮：信号色箭头自左侧滑入

         方案B silent：极简克制
           · 仅全局 .2s 颜色过渡 + :active 暗一档
           · 无箭头、无角标、无位移——零视觉噪音

         方案C impact：冲压反馈
           · 全局 .2s 颜色过渡 + :active 暗一档
           · 硬阴影位移（常态 4px → 按下 2px，模拟被压入页面）
           · 左侧信号色边条：常态透明占位，悬停只改颜色（不加边框，避免重排）

         方案D clamp：工程标注（角标母题）
           · 四角 12px L 形角标常态存在、悬停淡入（.18s）——工程图纸的
             「框选/定位」语法；圆形图标按钮被排除在外
           · 主 CTA：左缘 3px 信号边条 + 文字横移 2px（像被标注框对齐）
           · 颜色过渡与 :active 沿用共通段；无整体位移、无缩放

         方案E meter：仪表读数（计量母题）
           · 图形按钮（类名以 _iconButton 结尾、且未被恢复成圆的那个）：
             悬停四角出现准星刻度，按下 scale(.92)——仪表按钮被按下
           · 主 CTA：底部读数条 6% → 100% 展开（用 accent-ink 色，因为它压在
           强调色实心底上——同色会消失），按下变为满条
           · 列表行/菜单项：左缘信号色指示条淡入（工业面板的「选中通道」语法）
           · 零位移：所有变化都是 line/scale，不推挤相邻元素

         方案F stamp：冲压盖章（落印母题）
           · 批准 / 运行类按钮：按下时 -1.5° 落印 + 硬阴影收紧 + 180ms
             keyframes（放大 1.06 → 回落 1），像把印章砸在纸上
           · 拒绝 / 停止类按钮（同一母题的反向）：按下水平抖一下再归位
           · 装饰性按钮（iconButton / actionButton）：按下缩到 .88
           · 悬停时四角信号色框（outline，不占布局）

         off：完全关闭，回到无动效的瞬变状态。

         官网实测数据支撑（动效部分见 docs/notes/endfield-motion-research.md）：
         · 时长全部 ≤.3s；无弹跳/无回弹（keyframes 的 cubic-bezier y ≤ 1）
         · 变形优先于位移；颜色就是状态（hover亮/active暗）
         · 零 JS 动画库，纯 CSS transition

         色彩取值分两类，**不要混**：
         · 画在纸/面板上的（角标、准星、指示条、左边条亮色档）走 --edge-accent-onpaper；
         · 画在**强调色实心底**上的只有读数条，它走 --edge-accent-ink——因为按钮自己的底
           就是 --edge-accent（悬停/按下 --edge-accent-deep），同色叠同色会 1.00:1，
           而 onpaper 在亮黄/亮青里**等于** accent（1.00–1.51:1）。这两个反例都真的
           上线过，最后被像素断言抓住。
         两处配对都由 test/palette-contrast.test.js 第 12 节断言（ink × accent/deep，
         各配色 5.41–16.50:1）。

         prefers-reduced-motion：A–F 的位移动画全部关掉，保留颜色过渡，见本节末尾。 */

      /* ---------- 共通（六套方案）：全局颜色过渡 ----------
         只过渡「颜色类」属性。两个实测/证词都指向同一条：过渡属性越少越省。
         · box-shadow / filter / width 在悬停按下时是**一次性**变化，本来不需要
           过渡，写进 transition 只会让每次悬停多跑一遍栅格化或重排；
         · border-radius 尤其贵——浏览器把它当「可触发重排」的属性处理，在长列表
           上悬停会造成整屏布局失效（实测：把 border-radius 留在通用过渡里，
           300 行扫描的 LayoutDuration 从 0 涨到 20ms/s）。所以它只在方案 A
           这一条规则里单独过渡，不进通用规则。 */
      body[data-endfield-motion] button,
      body[data-endfield-motion] [role='button'],
      body[data-endfield-motion] [role='tab'],
      body[data-endfield-motion] [role='menuitem'],
      body[data-endfield-motion] [role='option'],
      body[data-endfield-motion] a {
        transition: background-color .2s ease, color .2s ease, border-color .2s ease;
      }

      /* ---------- 共通（六套方案）：:active 按下暗一档 ---------- */
      body[data-endfield-motion] button:active:not(:disabled),
      body[data-endfield-motion] [role='button']:active:not(:disabled) {
        filter: brightness(.85);
      }

      /* ================= 方案A signal：官网签名复刻 ================= */

      /* A-1.（已删除）悬停圆角软化。
         官网确实在 hover 里动圆角（2px→6px，调研 §4.2 原文），这里曾照做过一条
         「直角模式下按钮悬停 border-radius:6px」。撤掉的原因是用户实测反馈定的
         准则：**圆角全局恒定，不随状态变化**——悬停瞬间方角变圆角，再叠加排除
         清单（图标/走纸/发送按钮不参与），呈现为「部分按钮、悬停时才变的不一致
         倒角」。直角模式一律 0；圆角模式（theme-endfield-round）保持上游原样；
         两种模式各自恒定。附带收益：border-radius 被浏览器按「可能触发重排」
         处理，悬停改圆角在长列表上有实测成本（见性能段）。 */
      /* A-2. 主 CTA 箭头动效（新会话 / 审批 / 发送）。
         不做 clip-path 变形——两个 polygon 之间的点位插值在过渡期间产生
         自交形状（蝶形），视觉上闪烁扭曲。改为：形状固定为右指三角，
         仅动画 transform + opacity（合成器级，零 paint，零重排）。
         悬停时箭头从左侧滑入并放大到位。 */
      body[data-endfield-motion='signal'] [class$='_newSession'] {
        position: relative;
      }
      body[data-endfield-motion='signal'] [class$='_newSession']::after {
        content: '';
        position: absolute;
        left: 6px;
        top: 50%;
        width: 12px;
        height: 60%;
        background-color: var(--edge-accent-ink, #101110);
        clip-path: polygon(0 15%, 100% 50%, 0 85%);
        opacity: 0;
        transform: translateY(-50%) translateX(-14px) scale(.4);
        transition: opacity .2s ease, transform .2s cubic-bezier(.16, 1, .3, 1);
        pointer-events: none;
        z-index: 1;
      }
      body[data-endfield-motion='signal'] [class$='_newSession']:hover::after {
        opacity: 1;
        transform: translateY(-50%) translateX(0) scale(1);
      }

      /* A-3. 审批按钮：同款箭头滑入 */
      body[data-endfield-motion='signal'] [data-cordis-approve] {
        position: relative;
      }
      body[data-endfield-motion='signal'] [data-cordis-approve]::after {
        content: '';
        position: absolute;
        left: 6px;
        top: 50%;
        width: 10px;
        height: 55%;
        background-color: currentColor;
        clip-path: polygon(0 15%, 100% 50%, 0 85%);
        opacity: 0;
        transform: translateY(-50%) translateX(-12px) scale(.4);
        transition: opacity .2s ease, transform .2s cubic-bezier(.16, 1, .3, 1);
        pointer-events: none;
      }
      body[data-endfield-motion='signal'] [data-cordis-approve]:hover::after {
        opacity: 1;
        transform: translateY(-50%) translateX(0) scale(1);
      }

      /* A-4. 发送/停止按钮（输入区 _primary）**不做动效**。
         这里曾经是一个「信号色箭头自左侧滑入」的伪元素。取消它的理由有两条：
         · 官方 /operator 右侧那列圆形按钮（切换干员）只有 .3s 的 transform 与
           background-color .2s 两种过渡，**没有任何形变式动效**——它的状态靠
           颜色与 2px 黄边表达（选中 '#fffa00'、悬停 '#626262'、按下 '#282828'）。
           发送按钮上挂一个滑入箭头，比参考对象本身更吵；也不符合设计语言
           「强调色只做信号、不做装饰」。
         · 发送是高频动作，箭头在每一次悬停都重放，属于噪音。
         现在发送按钮只保留全局的颜色过渡（背景/文字/边框），与其它按钮一致。 */

      /* A-5. Sidebar session/search rows + table rows (+ settings buttons):
         left signal border on hover. Uses --edge-accent-onpaper (a DARK step
         that reads on both paper and panel) because --edge-accent alone is
         #d9d9d9 in the default gray palette — invisible on cream hover tints.

         The border is declared at REST as 3px solid transparent and only its
         colour changes on hover. Adding the border on hover instead would make
         every hovered row lay out again: measured over a 300-row sweep, the
         hover-created border cost 11.6ms/s of LayoutDuration against 0.00ms/s
         for the always-present version (the same reason the meter/menu rules
         pre-paint their geometry).

         菜单/列表框条目（[role='menuitem'] / [role='option']）**已移出**这条处理：
         它们原生 border:none，在紧凑弹层里挂一条悬停才显色的左边框读起来是
         「没闭合的边框」（用户实测反馈），且常态的 3px 透明预声明会把条目内容
         右推 3px。弹层里的选中反馈交给应用自己的底色高亮。**设置页按钮同理
         移出**：它们原生带整圈 1px 边框（内联样式），把左边压成 3px 透明条会把
         那圈边框「打开」——上下边到左缘断掉（02 背景/03 动画组实测反馈），悬停
         色条也与 1px 边框不协调。左边框只属于原生无边框的「行」：侧栏会话行、
         表格行。 */
      body[data-endfield-motion='signal'] [class$='_sidebarCol'] [class$='_sessionRow'],
      body[data-endfield-motion='signal'] [class$='_sidebarCol'] [class$='_searchResultRow'],
      body[data-endfield-motion='signal'] tbody tr {
        border-left: 3px solid transparent !important;
      }
      body[data-endfield-motion='signal'] [class$='_sidebarCol'] [class$='_sessionRow']:hover {
        border-left: 3px solid var(--edge-accent-onpaper, var(--edge-accent)) !important;
      }
      body[data-endfield-motion='signal'] [class$='_sidebarCol'] [class$='_searchResultRow']:hover {
        border-left: 3px solid var(--edge-accent-onpaper, var(--edge-accent)) !important;
      }
      /* Table row hover: same left border as sidebar rows. */
      body[data-endfield-motion='signal'] tbody tr:hover {
        border-left: 3px solid var(--edge-accent-onpaper, var(--edge-accent)) !important;
      }

      /* ================= 方案C impact：冲压反馈 ================= */

      /* C-1. 悬停硬阴影收紧（4px→2px：被压向页面） */
      body[data-endfield-motion='impact'] button:not(:disabled),
      body[data-endfield-motion='impact'] [role='button']:not(:disabled) {
        box-shadow: 4px 4px 0 rgba(16, 17, 16, 0.2);
      }
      body[data-endfield-motion='impact'] button:active:not(:disabled),
      body[data-endfield-motion='impact'] [role='button']:active:not(:disabled) {
        box-shadow: 2px 2px 0 rgba(16, 17, 16, 0.25);
        transform: translate(2px, 2px);
      }

      /* C-2. 悬停左侧信号色边条 */
      body[data-endfield-motion='impact'] button:not(:disabled),
      body[data-endfield-motion='impact'] [role='button']:not(:disabled) {
        border-left: 3px solid transparent;
      }
      body[data-endfield-motion='impact'] button:hover:not(:disabled),
      body[data-endfield-motion='impact'] [role='button']:hover:not(:disabled) {
        border-left-color: var(--edge-accent, currentColor);
      }

      /* ================= 方案D clamp：工程标注（角标母题） ================= */

      /* D-1. 四角 L 形角标：两个 12px 方块伪元素，各自用一条 SVG 遮罩切出 L。
         mask 的坑（实测，不是推测）：遮罩图按自身宽高比缩放——把 24×24 的图
         mask-size 写成 100% 100% 时，它保持 1:1 并居中，角标会跑到按钮中间去。
         所以伪元素本身就是 12×12 方块、mask 按内容尺寸使用；两个角分放
         ::before / ::after（::after 只画右下角），保证不互相覆盖——半透明遮罩
         叠加会加深那一角，L 的两条臂就不再等宽。
         排除条件是必要的，不是装饰：圆角恢复规则把 [class*='actionButton' i] 与
         不带该子串的 [class$='_iconButton'] 都变回圆形，而带 'actionButton'
         子串的图标按钮变体（走纸/危险态）同样是圆的——圆形按钮上放角标是错的。
         命中 4n+3 个类名：':not()' 自身不增加特异性，净特异性 = 元素 + 4 属性 +
         伪元素，高于应用的同名 hover 规则。 */
      /* 圆角模式的守卫 + 圆形控件的排除，两者都是必需的：
         · '.theme-endfield-round' 下上游所有圆角都保留，方括号会贴不上任何一条边；
         · '_iconButton' 与带 actionButton 子串的变体被圆角恢复规则变回圆形，
           '[role='tab']' 在本应用里虽然都是方角（cordis 的 sourceTab / schedule 的
           detailTab），但它是**结构性角色**，将来可能出现圆角 tab，一并排除更稳。
         排除写全后，命中的是真正方角的 button/role=button/menuitem/option。 */
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) button:not(.actionButton):not([class*='actionButton' i]):not([class$='_iconButton']),
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='button']:not(.actionButton):not([class*='actionButton' i]):not([class$='_iconButton']),
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='menuitem'],
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='option'] {
        position: relative;
      }
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) button:not(.actionButton):not([class*='actionButton' i]):not([class$='_iconButton'])::before,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) button:not(.actionButton):not([class*='actionButton' i]):not([class$='_iconButton'])::after,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='button']:not(.actionButton):not([class*='actionButton' i]):not([class$='_iconButton'])::before,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='button']:not(.actionButton):not([class*='actionButton' i]):not([class$='_iconButton'])::after,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='menuitem']::before,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='menuitem']::after,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='option']::before,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='option']::after {
        /* 盒子常态就存在（content/几何/颜色都在常态规则里），显隐只切 opacity。
           三版实现里只有这一版同时做到「可见」与「0 重排」，实测：
             · content 只写在 hover 规则里（悬停才生成盒子）→ 布局失效 29.2ms/s；
             · content 在悬停、几何在常态 → 同样 29.2ms/s：代价来自「伪元素在常态
               是否已存在」，不是 content 写在哪；
             · 常态生成 + 只切 opacity → 0.00ms/s（见 test/perf-motion.test.js）。
           入场用 @keyframes 而不是 transition：本仓库已实测 transition 在部分渲染
           路径上根本不触发（见启动屏注释），而关键帧 + fill-mode:both 的终点是
           确定的；opacity 单属性动画让浏览器只栅格化一次、之后每帧只合成。 */
        content: '';
        position: absolute;
        width: 12px;
        height: 12px;
        pointer-events: none;
        z-index: 2;
        /* 两条渐变的边 = 一个 L。**不用 mask**：隔离页实测同一个 12px 方块上的
           SVG 遮罩在 DPR 1 下整条不落笔、DPR 2/3 正常——选择器与计算样式全都对，
           只有跨 DPR 截图才能发现。渐变边没有任何遮罩/位图依赖，DPR 1/2/3 都正常。 */
        background-image:
          linear-gradient(var(--edge-accent-onpaper, var(--edge-accent)), var(--edge-accent-onpaper, var(--edge-accent))),
          linear-gradient(var(--edge-accent-onpaper, var(--edge-accent)), var(--edge-accent-onpaper, var(--edge-accent)));
        background-size: 12px 2px, 2px 12px;
        background-repeat: no-repeat;
        opacity: 0;
      }
      @keyframes endfield-clamp-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) button:not(.actionButton):not([class*='actionButton' i]):not([class$='_iconButton'])::before,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='button']:not(.actionButton):not([class*='actionButton' i]):not([class$='_iconButton'])::before,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='menuitem']::before,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='option']::before {
        left: 1px;
        top: 1px;
        background-position: left top, left top;
      }
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) button:not(.actionButton):not([class*='actionButton' i]):not([class$='_iconButton'])::after,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='button']:not(.actionButton):not([class*='actionButton' i]):not([class$='_iconButton'])::after,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='menuitem']::after,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='option']::after {
        right: 1px;
        bottom: 1px;
        background-position: right bottom, right bottom;
      }
      /* 显隐切换必须排在基础规则之后：两条规则特异性相同，靠源码顺序决胜。
         （这一条一度被排到基础 opacity:0 之前，于是角标永远不亮——而且只有
         像素断言会发现，计算样式与选择器看起来都对。） */
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) button:hover:not(:disabled)::before,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) button:hover:not(:disabled)::after,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='button']:hover:not(:disabled)::before,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='button']:hover:not(:disabled)::after,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='menuitem']:hover::before,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='menuitem']:hover::after,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='option']:hover::before,
      body[data-endfield-motion='clamp']:not(.theme-endfield-round) [role='option']:hover::after {
        animation: endfield-clamp-in .18s ease 1 both;
      }

      /* D-2. 主 CTA：左缘边条 + 文字横移 2px（被标注框对齐）。
         列容器用 flex 布局，子元素整体右移 2px 不会被文字节点吃掉。 */
      body[data-endfield-motion='clamp'] [class$='_newSession'] {
        border-left: 3px solid transparent !important;
      }
      body[data-endfield-motion='clamp'] [class$='_newSession']:hover:not(:disabled) {
        border-left-color: var(--edge-accent-onpaper, var(--edge-accent)) !important;
      }
      body[data-endfield-motion='clamp'] [class$='_newSession'] > *,
      body[data-endfield-motion='clamp'] [class$='_newSession']:hover:not(:disabled) > * {
        transition: transform .2s cubic-bezier(.16, 1, .3, 1);
      }
      body[data-endfield-motion='clamp'] [class$='_newSession']:hover:not(:disabled) > * {
        transform: translateX(2px);
      }

      /* ================= 方案E meter：仪表读数（计量母题） ================= */

      /* E-1. 图形按钮：悬停四角准星刻度。只命中「类名以 _iconButton 结尾且
         没被圆角恢复规则改成圆」的那个角色——圆形按钮上放角标是错的。 */
      body[data-endfield-motion='meter'] [class$='_iconButton']:not([class*='actionButton' i]) {
        position: relative;
      }
      body[data-endfield-motion='meter'] [class$='_iconButton']:not([class*='actionButton' i]):hover:not(:disabled)::before {
        content: '';
        position: absolute;
        inset: 3px;
        pointer-events: none;
        z-index: 2;
        background-image:
          linear-gradient(var(--edge-accent-onpaper, var(--edge-accent)), var(--edge-accent-onpaper, var(--edge-accent))),
          linear-gradient(var(--edge-accent-onpaper, var(--edge-accent)), var(--edge-accent-onpaper, var(--edge-accent))),
          linear-gradient(var(--edge-accent-onpaper, var(--edge-accent)), var(--edge-accent-onpaper, var(--edge-accent))),
          linear-gradient(var(--edge-accent-onpaper, var(--edge-accent)), var(--edge-accent-onpaper, var(--edge-accent))),
          linear-gradient(var(--edge-accent-onpaper, var(--edge-accent)), var(--edge-accent-onpaper, var(--edge-accent))),
          linear-gradient(var(--edge-accent-onpaper, var(--edge-accent)), var(--edge-accent-onpaper, var(--edge-accent))),
          linear-gradient(var(--edge-accent-onpaper, var(--edge-accent)), var(--edge-accent-onpaper, var(--edge-accent))),
          linear-gradient(var(--edge-accent-onpaper, var(--edge-accent)), var(--edge-accent-onpaper, var(--edge-accent)));
        background-repeat: no-repeat;
        background-size: 7px 2px, 2px 7px, 7px 2px, 2px 7px, 7px 2px, 2px 7px, 7px 2px, 2px 7px;
        background-position: left top, left top, right top, right top,
          left bottom, left bottom, right bottom, right bottom;
      }
      body[data-endfield-motion='meter'] button[class$='_iconButton']:not([class*='actionButton' i]):active:not(:disabled),
      body[data-endfield-motion='meter'] [role='button'][class$='_iconButton']:not([class*='actionButton' i]):active:not(:disabled) {
        transform: scale(.92);
        filter: none;
      }

      /* E-2. 主 CTA：底部读数条 6% → 100%。用 scaleX 而不是 width——官网自己的
         黄条揭示就是 transform-origin:left + scaleX(0→1)，并明确不写 width：
         合成器能直接对已栅格化的图层做横向拉伸，width 则每帧都要重排重绘。
         元素本身按 100% 宽静态存在（只栅格化一次），初始视觉宽度由 scaleX(.06) 给出。

         颜色必须是 --edge-accent-ink，**不能**用 --edge-accent、也不能用
         --edge-accent-onpaper：这个按钮的底就是 --edge-accent（悬停
         --edge-accent-deep，见下方 New session 段），而 onpaper 在亮黄/亮青
         两套配色里**等于** accent（1.00–1.51:1）——读数条会彻底消失。
         accent-ink 是「与强调实心底配对」的那一档（题字、::selection、选中行
         用的就是它），既有对比度测试覆盖，又随亮暗模式正确翻转：
         亮色墨字压亮底 13.4–16.5:1，暗色白字压灰底 10.1:1。 */
      body[data-endfield-motion='meter'] [class$='_newSession'] {
        position: relative;
      }
      body[data-endfield-motion='meter'] [class$='_newSession']::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        height: 3px;
        background-color: var(--edge-accent-ink, #101110);
        transform-origin: left center;
        transform: scaleX(.06);
        transition: transform .22s cubic-bezier(.16, 1, .3, 1), background-color .12s linear;
        pointer-events: none;
      }
      body[data-endfield-motion='meter'] [class$='_newSession']:hover:not(:disabled)::after,
      body[data-endfield-motion='meter'] [class$='_newSession']:focus-visible:not(:disabled)::after {
        transform: scaleX(1);
      }
      /* 按下时按钮自己的底是 --edge-accent-deep（:hover 规则），所以条与标签都必须
         继续用 --edge-accent-ink——换成 onpaper 会在三套配色里同时失去对比度：
         谷地黄 1.25:1 / 武陵青 1.28:1 / 终末地灰亮 3.58:1 / 灰暗 1.86:1。
         ink 对 deep 是 7.72–16.50:1。这是同一类错误的第三次：**角色必须对它
         实际压着的那个底配对**，而 :active 的底与常态/悬停都不一样。 */
      body[data-endfield-motion='meter'] [class$='_newSession']:active:not(:disabled)::after {
        transform: scaleX(1);
        background-color: var(--edge-accent-ink, #101110);
      }
      body[data-endfield-motion='meter'] [class$='_newSession']:active:not(:disabled),
      body[data-endfield-motion='meter'] [class$='_newSession']:active:not(:disabled) * {
        color: var(--edge-accent-ink, #101110) !important;
      }

      /* E-3. 列表行 / 菜单项：悬停时左缘出现信号色细条（淡入）。
         细条走纯 background-image 的既存渐变，画在 ::before 里。两个避免点：
         早先用 content:'[' / ']' 生成方括号，会让浏览器在悬停时**生成文本节点**
         （文字布局）；早先把缩进做成 padding-left 过渡，则让悬停**触发行重排**。
         现在行内边距是静态值，细条落在既有内边距里，悬停只引起一次重绘。 */
      body[data-endfield-motion='meter'] [role='menuitem'],
      body[data-endfield-motion='meter'] [role='option'] {
        position: relative;
      }
      body[data-endfield-motion='meter'] [role='menuitem']::before,
      body[data-endfield-motion='meter'] [role='option']::before {
        content: '';
        position: absolute;
        left: 3px;
        top: 50%;
        width: 2px;
        height: 60%;
        background-image: linear-gradient(var(--edge-accent-onpaper, var(--edge-accent)), var(--edge-accent-onpaper, var(--edge-accent)));
        transform: translateY(-50%);
        opacity: 0;
        transition: opacity .18s ease;
        pointer-events: none;
      }
      body[data-endfield-motion='meter'] [role='menuitem']:hover::before,
      body[data-endfield-motion='meter'] [role='option']:hover::before {
        opacity: 1;
      }

      /* ================= 方案F stamp：冲压盖章（落印母题） ================= */

      /* F-1. 批准 / 运行类：按下落印。transform 先转 -1.5°，动画在旋转基准上
         做一次 1.06 → 1 的缩放回落；硬阴影同步收紧，视觉上「压进纸面」。 */
      @keyframes endfield-stamp {
        0% { transform: rotate(-1.5deg) scale(1.06); }
        55% { transform: rotate(-1.5deg) scale(.99); }
        100% { transform: rotate(-1.5deg) scale(1); }
      }
      body[data-endfield-motion='stamp'] [data-cordis-approve]:active:not(:disabled),
      body[data-endfield-motion='stamp'] [data-cordis-approve-plugin]:active:not(:disabled),
      body[data-endfield-motion='stamp'] [class*='_primary']:active:not(:disabled) {
        animation: endfield-stamp 180ms cubic-bezier(.2, .9, .25, 1) 1 both;
        filter: none;
        box-shadow: 0 0 0 2px var(--edge-accent-onpaper, var(--edge-accent));
      }

      /* F-2. 拒绝 / 停止类：同一母题的反向——水平抖一下再归位（0.18s，无回弹） */
      @keyframes endfield-stamp-refuse {
        0% { transform: translateX(0); }
        25% { transform: translateX(-2px); }
        60% { transform: translateX(2px); }
        100% { transform: translateX(0); }
      }
      body[data-endfield-motion='stamp'] [data-cordis-decline]:active:not(:disabled),
      body[data-endfield-motion='stamp'] [class*='_stopButton']:active:not(:disabled),
      body[data-endfield-motion='stamp'] [class*='_danger']:active:not(:disabled) {
        animation: endfield-stamp-refuse 180ms linear 1 both;
        filter: none;
      }

      /* F-3. 装饰性按钮（圆形图标按钮 / 走纸按钮）：按下缩进去 */
      body[data-endfield-motion='stamp'] [class$='_iconButton']:active:not(:disabled),
      body[data-endfield-motion='stamp'] [class*='actionButton' i]:active:not(:disabled) {
        transform: scale(.88);
        filter: none;
      }

      /* F-4. 普通按钮：悬停四角信号色细框（outline 不参与布局，零位移） */
      body[data-endfield-motion='stamp'] button:not(.actionButton):not([class*='actionButton' i]):hover:not(:disabled),
      body[data-endfield-motion='stamp'] [role='button']:not(.actionButton):not([class*='actionButton' i]):hover:not(:disabled) {
        outline: 2px solid var(--edge-accent-onpaper, var(--edge-accent));
        outline-offset: -2px;
      }

      /* 输入区发送/停止按钮：所有方案下都不做动效（见 A-4 的理由）。
         一条显式取消规则比在每个方案里加 :not() 更清楚，也不改变任何既有
         选择器的特异性——它在源码顺序上更靠后，且带 !important。 */
      body[data-endfield-motion] button[class*='_primary']:is([class$='_composerSeat'] *, [class$='_composerHero'] *),
      body[data-endfield-motion] :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary'] {
        animation: none !important;
        transform: none !important;
      }

      /* ---------- 方案B silent 无额外规则（仅共通的过渡 + active） ---------- */

      /* ---------- 尊重「减少动态效果」：D–F 的位移/动画/揭示全部关掉，只留颜色 ---------- */
      @media (prefers-reduced-motion: reduce) {
        body[data-endfield-motion] button,
        body[data-endfield-motion] [role='button'],
        body[data-endfield-motion] [role='tab'],
        body[data-endfield-motion] [role='menuitem'],
        body[data-endfield-motion] [role='option'] {
          animation: none !important;
          transform: none !important;
          box-shadow: none !important;
          /* Colour IS the state, so the colour feedback stays: only the stamps
             whose outline is the whole effect lose it. outline-color rather than
             the shorthand, so the app's focus ring keeps its width and style. */
          outline-color: transparent !important;
        }
        /* The dim-on-press half of the shared feedback is a colour change, not
           motion: keep it even though the stamp schemes above blank the filter. */
        body[data-endfield-motion] button:active:not(:disabled),
        body[data-endfield-motion] [role='button']:active:not(:disabled) {
          filter: brightness(.85) !important;
        }
        body[data-endfield-motion='clamp'] [class$='_newSession'] > *,
        body[data-endfield-motion='clamp'] [class$='_newSession']:hover > * {
          transition: none !important;
          transform: none !important;
        }
        /* No sliding bar, no appearing brackets: the reveal IS the motion.
           The shared transform:none rule above already returns the readout bar to
           its 6% scale; this keeps its colour meaning static too. */
        body[data-endfield-motion='meter'] [class$='_newSession']::after {
          transition: none !important;
          transform: scaleX(.06) !important;
        }
        /* EVERY decorative pseudo-element, on every role the schemes paint, and on
           both corners: a scheme that only kills ::after leaves the ::before corner
           painted (measured — the clamp top-left bracket survived 'reduce' until
           this list included it). [role='tab'] is in here for the same reason. */
        body[data-endfield-motion='clamp'] button::before,
        body[data-endfield-motion='clamp'] button::after,
        body[data-endfield-motion='clamp'] [role='button']::before,
        body[data-endfield-motion='clamp'] [role='button']::after,
        body[data-endfield-motion='clamp'] [role='tab']::before,
        body[data-endfield-motion='clamp'] [role='tab']::after,
        body[data-endfield-motion='clamp'] [role='menuitem']::before,
        body[data-endfield-motion='clamp'] [role='menuitem']::after,
        body[data-endfield-motion='clamp'] [role='option']::before,
        body[data-endfield-motion='clamp'] [role='option']::after,
        body[data-endfield-motion='signal'] [class$='_newSession']::after,
        body[data-endfield-motion='signal'] [data-cordis-approve]::after,
        body[data-endfield-motion='meter'] [class$='_iconButton']::before,
        body[data-endfield-motion='meter'] [role='menuitem']::before,
        body[data-endfield-motion='meter'] [role='option']::before {
          content: none !important;
        }
      }

      /* Square corners (default): zero EVERY classed element, then restore circles/pills below.
         body.theme-endfield-round disables all of this and restores app-native rounding. */
      body:not(.theme-endfield-round) button,
      body:not(.theme-endfield-round) input,
      body:not(.theme-endfield-round) textarea,
      body:not(.theme-endfield-round) select,
      body:not(.theme-endfield-round) [role='button'],
      body:not(.theme-endfield-round) [role='dialog'],
      body:not(.theme-endfield-round) [role='menu'],
      body:not(.theme-endfield-round) [role='tooltip'],
      body:not(.theme-endfield-round) [role='tab'] {
        border-radius: 0 !important;
      }
      body:not(.theme-endfield-round) [class] {
        border-radius: 0 !important;
      }
      body:not(.theme-endfield-round) [class*='avatar'],
      body:not(.theme-endfield-round) [class*='Avatar'],
      body:not(.theme-endfield-round) [class*='spinner'],
      body:not(.theme-endfield-round) [class*='Spinner'],
      body:not(.theme-endfield-round) [class*='dot'],
      body:not(.theme-endfield-round) [class*='Dot'],
      body:not(.theme-endfield-round) [class*='actionButton' i],
      body:not(.theme-endfield-round) [class$='_iconButton'] {
        border-radius: 50% !important;
      }
      /* Hover feedback should track the pointer immediately; the app's broad
         transition rule otherwise makes colour changes feel delayed. */
      button,
      [role='button'] {
        transition: none !important;
      }
      body:not(.theme-endfield-round) [class*='scrollbar'],
      body:not(.theme-endfield-round) [class*='Scrollbar'] {
        border-radius: 0 !important;
      }
      * {
        scrollbar-width: thin;
        scrollbar-color: var(--edge-line) transparent;
      }
      /* ---------- Light mode: deepen tertiary/secondary labels for icon visibility ---------- */
      body:not([data-ds-dark-theme]) {
        --dsw-alias-label-tertiary: #6a6d68;
        --dsw-alias-label-caption: #5a5d58;
        --dsw-alias-label-dimmed: #9a9d98;
        --edge-btn-muted: #dcddd6;
      }
      /* ---------- Neutralize remaining DeepSeek brand blues ---------- */
      body {
        --dsw-static-deepseek-50: #dcddd6;
        --dsw-static-deepseek-100: #dcddd6;
        --dsw-static-deepseek-200: #d8d9d5;
        --dsw-static-deepseek-300: #c8cac5;
        --dsw-static-deepseek-400: #757874;
        --dsw-static-deepseek-450: var(--edge-accent-onpaper);
        --dsw-static-deepseek-500: #101110;
        --dsw-static-deepseek-600: #101110;
        --dsw-static-deepseek-800: #3a3c38;
        --dsw-static-deepseek-900: #2a2c2a;
        --dsw-static-blue-900: #101110;
        --dsw-alias-button-info-fill: #101110;
        --dsw-alias-button-info-hover: #2a2b28;
        --dsw-alias-state-business-primary: #101110;
        --dsw-alias-state-business-tertiary: rgba(var(--edge-accent-rgb), 0.14);
        --dsw-alias-brand-primary-new-colorprimary-new-color: #101110;
        --dsw-alias-label-primary-bluish: #101110;
        --dsw-specific-bubble: #f2f2ec;
        --dsw-specific-bubble-highlight: #dcddd6;
        --dsw-specific-sidebar-nav-item-active-accent: #101110;
        --dsw-alias-interactive-bg-hover-accent: rgba(var(--edge-accent-rgb), 0.14);
        --dsw-alias-border-l3: #b6b8b3;
        --dsw-alias-border-l4: #9a9d98;
      }
      body[data-ds-dark-theme] {
        --dsw-static-deepseek-50: #242624;
        --dsw-static-deepseek-100: #242624;
        --dsw-static-deepseek-200: #2f312e;
        --dsw-static-deepseek-300: #3a3c38;
        --dsw-static-deepseek-400: #898d89;
        --dsw-static-deepseek-450: var(--edge-accent);
        --dsw-static-deepseek-500: #f5f5f0;
        --dsw-static-deepseek-600: #d8d9d5;
        --dsw-static-deepseek-800: #343633;
        --dsw-static-deepseek-900: #242624;
        --dsw-static-blue-900: #f5f5f0;
        --dsw-alias-button-info-fill: var(--edge-accent);
        --dsw-alias-button-info-hover: var(--edge-accent);
        --dsw-alias-state-business-primary: var(--edge-accent);
        --dsw-alias-state-business-tertiary: rgba(var(--edge-accent-rgb), 0.22);
        --dsw-alias-brand-primary-new-colorprimary-new-color: var(--edge-status-dark, var(--edge-accent));
        --dsw-alias-label-primary-bluish: #f5f5f0;
        --dsw-specific-bubble: #181a18;
        --dsw-specific-bubble-highlight: #242624;
        --dsw-specific-sidebar-nav-item-active-accent: var(--edge-accent);
        --dsw-alias-interactive-bg-hover-accent: rgba(var(--edge-accent-rgb), 0.22);
        --dsw-alias-border-l3: #4f534f;
        --dsw-alias-border-l4: #5f6460;
        --edge-btn-muted: #3a3c38;
      }
      /* ---------- Signal yellow everywhere (light: visible but soft) ---------- */
      body {
        --dsw-alias-interactive-bg-hover: rgba(var(--edge-accent-rgb), 0.16);
        --dsw-alias-interactive-bg-active: rgba(var(--edge-accent-rgb), 0.26);
        --dsw-alias-interactive-bg-hover-solid: var(--edge-accent);
        --dsw-alias-bg-multi-select: rgba(var(--edge-accent-rgb), 0.16);
        --dsw-alias-bg-skeleton: rgba(var(--edge-accent-rgb), 0.12);
        --dsw-alias-markdown-citation: rgba(var(--edge-accent-rgb), 0.16);
        --dsw-alias-markdown-code-block-banner: rgba(var(--edge-accent-rgb), 0.10);
        --dsw-alias-markdown-code-segment-selected: rgba(var(--edge-accent-rgb), 0.22);
        --dsw-alias-markdown-code-segment-unselected: rgba(var(--edge-accent-rgb), 0.06);
        --dsw-alias-markdown-inline-code: rgba(var(--edge-accent-rgb), 0.14);
        --dsw-alias-markdown-tag: rgba(var(--edge-accent-rgb), 0.18);
        --dsw-alias-scrollbar-bg-l1: transparent;
        --dsw-alias-scrollbar-bg-l2: transparent;
        --dsw-alias-scrollbar-hover-l1: var(--edge-accent);
        --dsw-alias-scrollbar-hover-l2: var(--edge-accent);
        --dsw-specific-sidebar-nav-item-active: rgba(var(--edge-accent-rgb), 0.16);
        --dsw-specific-sidebar-nav-item-hover: rgba(var(--edge-accent-rgb), 0.12);
      }
      body[data-ds-dark-theme] {
        --dsw-alias-interactive-bg-hover: rgba(var(--edge-accent-rgb), 0.18);
        --dsw-alias-interactive-bg-active: rgba(var(--edge-accent-rgb), 0.28);
        --dsw-alias-interactive-bg-hover-solid: var(--edge-accent);
        --dsw-alias-bg-multi-select: rgba(var(--edge-accent-rgb), 0.18);
        --dsw-alias-bg-skeleton: rgba(var(--edge-accent-rgb), 0.14);
        --dsw-alias-markdown-citation: rgba(var(--edge-accent-rgb), 0.20);
        --dsw-alias-markdown-code-block-banner: rgba(var(--edge-accent-rgb), 0.12);
        --dsw-alias-markdown-code-segment-selected: rgba(var(--edge-accent-rgb), 0.26);
        --dsw-alias-markdown-code-segment-unselected: rgba(var(--edge-accent-rgb), 0.08);
        --dsw-alias-markdown-inline-code: rgba(var(--edge-accent-rgb), 0.18);
        --dsw-alias-markdown-tag: rgba(var(--edge-accent-rgb), 0.22);
        --dsw-alias-scrollbar-bg-l1: transparent;
        --dsw-alias-scrollbar-bg-l2: transparent;
        --dsw-alias-scrollbar-hover-l1: var(--edge-accent);
        --dsw-alias-scrollbar-hover-l2: var(--edge-accent);
        --dsw-specific-sidebar-nav-item-active: rgba(var(--edge-accent-rgb), 0.20);
        --dsw-specific-sidebar-nav-item-hover: rgba(var(--edge-accent-rgb), 0.16);
      }
      /* The caret follows the same scheme-gray rule as selection (see the
         selection block above): light #666666 on paper, dark #d9d9d9 on ink —
         always visible (4.67:1 / 13.41:1), never the accent (yellow on cream
         was 1.07:1, i.e. invisible). */
      input, textarea, [contenteditable='true'] {
        caret-color: var(--edge-caret, #666666);
      }
      :focus-visible {
        outline: 2px solid var(--edge-accent) !important;
        outline-offset: 1px;
      }
      a {
        text-decoration-thickness: 1px;
      }
      a:hover {
        text-decoration-color: var(--edge-accent);
      }
      /* Reads the STATUS token, not the accent: 终末地灰's dark fill gray is
         AA under white text but too dim as text itself (3.04:1); the bright
         palettes define status-dark == accent, so only gray changes. */
      body[data-ds-dark-theme] a:hover {
        color: var(--edge-status-dark, var(--edge-accent));
      }
      ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      ::-webkit-scrollbar-thumb {
        border-radius: 0;
        background: var(--edge-line);
      }
      ::-webkit-scrollbar-thumb:hover {
        background: var(--edge-accent) !important;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      /* ---------- Hover text contrast (reference page inversion) ---------- */
      /* Note: plain buttons are excluded — their own fill/text color must survive hover
         (e.g. yellow toggle button keeps black text; white-on-dark send button stays white). */
      :is([role='tab'], [role='menuitem'], [role='option'], [role='link'], [role='treeitem'], [role='checkbox'], [role='switch'], [role='radio'], [role='combobox'], [class*='nav-item' i], [class*='menu-item' i], [class*='list-item' i], [class*='session-item' i], [class*='workspace-item' i], [class*='search-result' i], [class*='item' i], [class*='tab' i], [class*='card' i], [class*='row' i], [class*='tool' i], [class*='composer' i]):hover {
        color: var(--dsw-alias-label-primary) !important;
      }
      /* 对话/轨迹 标签（_tabs/_tab，在 header 里）。注意复合类名：选中标签的
         class 是 'wSkVaW_tab wSkVaW_tabActive'——[class$='_tab'] 要求整个 class
         串以 _tab 结尾，选中标签不满足（评审 element.matches 实测三条规则全部
         落空，原生墨条逐像素存活）。必须 :is([class$='_tab'],[class$='_tabActive'])
         两种后缀都列，与类序无关。
         历经四版选中表达——纯墨条
         （截断分划线）、三色线（24px 里读不出三段、相位断缝，定量评审否决）、
         短划上移（用户仍觉不好看）——最终照官方 /news 页的悬停语言重做：

         · **去掉底线**（tab:after 置空）：分划线整行连续，选中/悬停不再与它
           发生几何关系；
         · **悬停 = 官方遮罩渐显（仅亮色）**：/news 的 imageWrapper 配方原样
           照搬——::before 常态预建、rgba(0,0,0,.25) 遮罩、opacity 0、
           transition: opacity .2s ease（官网时长/ease 对）、悬停只切 opacity。
           官方有 @media(any-hover:hover) 守卫，本主题**有意不设**——这是仓库
           已登记的分歧（官网 28 处守卫全部不设）：无头测试环境无法仿真
           any-hover（setEmulatedMedia 不覆盖，matchMedia 恒 false），设了守卫
           悬停行为就无法被像素测试钉住；触屏粘滞悬停作为已知代价接受。
           bottom:5px（而非官方 inset:0）是有意的失真：实测它让遮罩盒止于
           分划线上方，不盖整行三色线。
           **暗色不用遮罩**：白 12% 对墨面只有 1.39:1（评审实测，调到 18% 也
           才 1.71:1）——结构性不可见；暗色的悬停信号由既有的「文字提亮一档」
           规则承担（17.3:1），这正是主题自己的暗色悬停语法。
           伪元素自持 transition——应用的 button{transition:none} 管不到它；
         · **选中 = 纯文字层级**：亮色沿用应用原生的强调文字色；暗色下原生
           选中文字（gray 调色板 3.49:1）反而比未选中（5.62:1）暗——评审实测
           指出的既有缺陷，这里强制提为 label-primary。轨迹页自己的
           detailTab（大写 T 结尾）不受影响。 */
      [class$='_centerCol'] [class$='_tabs'] :is([class$='_tab'],[class$='_tabActive'])::after {
        background: 0 0;
      }
      [class$='_centerCol'] [class$='_tabs'] :is([class$='_tab'],[class$='_tabActive'])::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 5px;
        background-color: rgba(0, 0, 0, 0.25);
        opacity: 0;
        transition: opacity .2s ease;
        pointer-events: none;
      }
      [class$='_centerCol'] [class$='_tabs'] :is([class$='_tab'],[class$='_tabActive']):hover::before {
        opacity: 1;
      }
      /* 暗色无遮罩：白 12% 对墨面 1.39:1 结构性不可见（评审实测），黑 25% 更弱；
         暗色的悬停信号 = 既有「文字提亮一档」规则。display:none 连盒子都不画。 */
      body[data-ds-dark-theme] [class$='_centerCol'] [class$='_tabs'] :is([class$='_tab'],[class$='_tabActive'])::before {
        display: none;
      }
      body[data-ds-dark-theme] [class$='_centerCol'] [class$='_tabs'] [class$='_tabActive'] {
        color: var(--dsw-alias-label-primary, #f5f5f0);
      }

      /* ---------- Workspace browser rows (ui-sidebar) ---------- */
      /* Hash-free rebuild of the old .YDXeBa_* rules: those class names are
         '<hash>_suffix' CSS-module exports and 0.1.2-rc.1 rehashed every module,
         killing all 33 pinned hashes. Matching survives on the SEMANTIC suffix
         ('_sessionRow' etc.), scoped to the sidebar column — '_slot'/'_row' style
         suffixes are too generic to match bare, but the sidebar column suffix is
         unique to the layout frame (same hook findAppFrame()
         already rely on). Compound states match on substrings, NOT [class$=]: a
         suffix match needs the WHOLE class attribute to end with the string, so
         'x_sessionRow x_selected' would silently miss the second condition.
         '_unselected' is safe against '_selected' here — the leading underscore
         breaks the substring. */
      [class$='_sidebarCol'] [class*='_slot'] {
        color: var(--dsw-alias-brand-primary) !important;
      }
      [class$='_sidebarCol'] [class*='_projectRow']:hover,
      [class$='_sidebarCol'] [class*='_sessionRow']:hover,
      [class$='_sidebarCol'] [class*='_sessionRow'][class*='_selected'],
      [class$='_sidebarCol'] [class*='_searchResultRow']:hover,
      [class$='_sidebarCol'] [class*='_searchResultRow'][class*='_selected'] {
        background: rgba(var(--edge-accent-rgb), 0.22) !important;
      }
      [class$='_sidebarCol'] [class*='_projectRow']:hover *,
      [class$='_sidebarCol'] [class*='_sessionRow']:hover *,
      [class$='_sidebarCol'] [class*='_sessionRow'][class*='_selected'] *,
      [class$='_sidebarCol'] [class*='_searchResultRow']:hover *,
      [class$='_sidebarCol'] [class*='_searchResultRow'][class*='_selected'] * {
        color: var(--edge-accent-ink, #000) !important;
      }
      /* ---------- Light mode: workspace folder / icon buttons ink ---------- */
      body:not([data-ds-dark-theme]) [class$='_sidebarCol'] [class*='_folder'],
      body:not([data-ds-dark-theme]) [class$='_sidebarCol'] [class*='_chevron'],
      body:not([data-ds-dark-theme]) [class$='_sidebarCol'] [class*='_arrow'],
      body:not([data-ds-dark-theme]) [class$='_sidebarCol'] [class*='_iconButton'],
      body:not([data-ds-dark-theme]) [class$='_sidebarCol'] [class*='_searchButton'],
      body:not([data-ds-dark-theme]) [class$='_sidebarCol'] [class*='_clearButton'] {
        color: var(--edge-accent-ink, #101110) !important;
      }
      /* ---------- Dark mode: solid signal-yellow inversions ---------- */
      body[data-ds-dark-theme] [class$='_sidebarCol'] [class*='_projectRow']:hover,
      body[data-ds-dark-theme] [class$='_sidebarCol'] [class*='_sessionRow']:hover,
      body[data-ds-dark-theme] [class$='_sidebarCol'] [class*='_sessionRow'][class*='_selected'],
      body[data-ds-dark-theme] [class$='_sidebarCol'] [class*='_searchResultRow']:hover,
      body[data-ds-dark-theme] [class$='_sidebarCol'] [class*='_searchResultRow'][class*='_selected'] {
        background: var(--edge-accent) !important;
      }
      body[data-ds-dark-theme] [class*='badge' i]:hover,
      body[data-ds-dark-theme] [class*='badge' i][data-active] {
        background: var(--edge-accent) !important;
      }
      /* ---------- Dark mode: icon buttons (plus / ellipsis / stop / actions) ---------- */
      /* The cordis approval trio is EXCLUDED here. Those three buttons carry their own
         solid fill (signal yellow for approve, error red for decline) from the approval
         block below, so a signal-yellow glyph renders yellow-on-yellow — an invisible
         check. A 'body[data-ds-dark-theme] [attr]' selector (0,2,1) also outranks the
         plain '[data-cordis-approve]' (0,1,0) rules below, so source order cannot undo it:
         the exclusion has to happen in this selector. Their ink is set below. */
      body[data-ds-dark-theme] [class$='_iconButton'],
      body[data-ds-dark-theme] [data-cordis-switch],
      body[data-ds-dark-theme] [class*='actionButton' i]:not([data-cordis-approve]):not([data-cordis-approve-plugin]):not([data-cordis-decline]) {
        color: var(--edge-status-dark, var(--edge-accent)) !important;
      }
      body[data-ds-dark-theme] [class$='_iconButton']:hover:not(:disabled),
      body[data-ds-dark-theme] [data-cordis-switch]:hover:not(:disabled),
      body[data-ds-dark-theme] [class*='actionButton' i]:not([data-cordis-approve]):not([data-cordis-approve-plugin]):not([data-cordis-decline]):hover:not(:disabled) {
        color: var(--edge-accent-ink, #000) !important;
        background: var(--edge-accent) !important;
      }
      /* ---------- Cordis approval buttons (allow once / allow plugin / decline) ---------- */
      /* Each button is a solid chip, so its glyph must contrast with its OWN fill:
         black check on signal yellow, white X on error red. The icons are
         fill="currentColor" svg paths, so 'color' alone drives the glyph — but the
         svg/path are also targeted explicitly, because any inherited-color rule that
         wins on a descendant would otherwise repaint the glyph and hide it again. */
      [data-cordis-approve],
      [data-cordis-approve-plugin],
      [data-cordis-approve] svg,
      [data-cordis-approve-plugin] svg,
      [data-cordis-approve] svg path,
      [data-cordis-approve-plugin] svg path {
        color: var(--edge-accent-ink, #101110) !important;
        fill: currentColor !important;
      }
      [data-cordis-approve],
      [data-cordis-approve-plugin] {
        background: var(--edge-accent) !important;
      }
      [data-cordis-decline],
      [data-cordis-decline] svg,
      [data-cordis-decline] svg path {
        color: #fff !important;
        fill: currentColor !important;
      }
      [data-cordis-decline] {
        background: var(--dsw-alias-state-error-primary) !important;
      }
      /* The second check of the double-check icon is dimmed to .7 opacity by the panel's
         own stylesheet; on the solid chip keep both strokes at full ink. */
      [data-cordis-approve-plugin] [class$='_doubleCheck'] svg {
        opacity: 1 !important;
      }
      [data-cordis-approve]:hover:not(:disabled),
      [data-cordis-approve-plugin]:hover:not(:disabled) {
        background: var(--edge-accent-deep) !important;
      }
      [data-cordis-decline]:hover:not(:disabled) {
        background: #d6281d !important;
      }
      /* ---------- Tables: bright signal-yellow hover (reference .data-table) ---------- */
      [class*='tableScroll' i] th,
      [class*='table' i] th {
        background: var(--edge-soft) !important;
        border-bottom-color: var(--edge-line) !important;
      }
      [class*='tableScroll' i] td,
      [class*='table' i] td {
        border-bottom-color: var(--edge-line) !important;
      }
      tbody tr:hover,
      tbody tr:hover *,
      [class*='table' i] tbody tr:hover,
      [class*='table' i] tbody tr:hover *,
      [class*='tableScroll' i] tbody tr:hover,
      [class*='tableScroll' i] tbody tr:hover * {
        color: var(--dsw-alias-label-primary) !important;
        background: color-mix(in srgb, var(--edge-accent) 15%, var(--dsw-alias-bg-base)) !important;
      }
      /* Row hover keeps the accent tint; ::selection is scheme-gray in every
         palette (see the selection block), so the two stay distinct by texture. */
      /* ---------- New session button (sidebar) ---------- */
      [class$='_newSession'] {
        color: var(--edge-accent-ink, #000) !important;
        background: var(--edge-accent) !important;
        border-color: var(--edge-accent) !important;
      }
      body:not(.theme-endfield-round) [class$='_newSession'] {
        border-radius: 0 !important;
      }
      [class$='_newSession']:hover,
      [class$='_newSession']:focus-visible {
        color: var(--edge-accent-ink, #000) !important;
        background: var(--edge-accent-deep) !important;
        border-color: var(--edge-accent-deep) !important;
      }
      [class$='_newSession'] svg {
        color: var(--edge-accent-ink, #000) !important;
      }
      [class$='_newSessionLabel'] {
        color: var(--edge-accent-ink, #000) !important;
      }
      /* ---------- Badge hover: signal-yellow inversion (reference .kpi:hover) ---------- */
      [class*='badge' i]:hover,
      [class*='badge' i]:hover *,
      [class*='badge' i][data-active],
      [class*='badge' i][data-active] * {
        color: var(--edge-accent-ink, #000) !important;
      }
      /* ---------- Cordis action buttons (run/stop) ---------- */
      /* Approval chips excluded again: they already own a solid fill, and this blanket
         hover would repaint the decline chip yellow and re-tint the approve glyphs. */
      [data-cordis-switch]:hover:not(:disabled),
      [class*='actionButton' i]:not([data-cordis-approve]):not([data-cordis-approve-plugin]):not([data-cordis-decline]):hover:not(:disabled) {
        color: var(--edge-accent-ink, #000) !important;
        background: var(--edge-accent) !important;
      }
      body:not(.theme-endfield-round) [data-cordis-switch],
      body:not(.theme-endfield-round) [class*='actionButton' i] {
        border-radius: 999px !important;
      }
      /* ---------- Session header actions (agent preset / subagent / jobs) ---------- */
      [class$='_trigger']:hover:not(:disabled),
      [class$='_trigger'][aria-expanded='true'],
      [class$='_trigger']:focus-visible {
        color: var(--edge-accent-ink, #000) !important;
        background: var(--edge-accent) !important;
      }
      /* ---------- Agent-preset header chip: accent fill, stock geometry ---------- */
      /* Hash-free scope for the old .SVAs4q_label: the chip is the preset label the
         agent-preset plugin registers into the "conversation.session.header.actions"
         slot. A bare [class*='_label'] is PROHIBITED here: it was tried first and it
         yellowed plain list labels (产物 / settings / jobs names), which is why this
         was hash-pinned in the first place.

         DOM measured off the running 0.1.5-rc.2 GUI (not inferred):

           div.pI_x6G_centerCol
             > header.wSkVaW_header
                 > div.wSkVaW_titleRow
                   > div.wSkVaW_titleCluster
                     > div.wSkVaW_headerActions
                       > div                  <- the slot's own entry wrapper.
                         > span.SVAs4q_label     It has NO class at all, so it
                           > svg.SVAs4q_icon     cannot be named either.

         Two silent-failure lessons are baked in here — a selector that matches
         nothing reports nothing, so both cost a shipped bug:
           1. The chip is NOT a child of _header; it is four levels down. Every '>'
              between the header and the chip encodes how many wrappers upstream
              happens to render, and upstream has now added wrappers twice.
           2. The chip's own parent is a class-less wrapper, so the depth cannot be
              collapsed onto a named container either.
         The scope therefore STOPS at the actions container and the chip is picked
         out by a property of the chip itself: it is the only _label in that slot
         carrying an icon. The jobs rows render text-only _label spans and the
         schedule module declares no _label local at all, so the scope still does
         exactly what it exists for. */
      [class$='_centerCol'] [class$='_header'] [class$='_headerActions'] [class*='_label']:has(> svg) {
        color: var(--edge-accent-ink, #000) !important;
        background: var(--edge-accent) !important;
        padding: 0 12px !important;
      }
      body:not(.theme-endfield-round) [class$='_centerCol'] [class$='_header'] [class$='_headerActions'] [class*='_label']:has(> svg) {
        border-radius: 0 !important;
      }
      [class$='_centerCol'] [class$='_header'] [class$='_headerActions'] [class*='_label']:has(> svg) svg,
      [class$='_centerCol'] [class$='_header'] [class$='_headerActions'] [class*='_label']:has(> svg) [class*='_icon'] {
        opacity: 1 !important;
        color: var(--edge-accent-ink, #000) !important;
      }
      /* DELIBERATELY NOT STRETCHED. This rule used to carry flex:1 1 auto and
         max-width:none, and an earlier attempt of this fix also flattened the slot
         wrapper (display:contents) and grew _headerActions, to reproduce the old
         "chip fills the action row" look. On the real 0.1.5-rc.2 header that turns
         the chip into a full-width yellow BAR across the top of the conversation
         (measured: 923px of a 976px row) — nothing like the stock chip it is
         replacing, and reported straight back as "现在变成一个长条了".
         The theme's job here is the ACCENT, not the geometry: the chip keeps its
         stock size/hit area (height, 180px cap and ellipsis included) and only its
         colours change. Everything that made it grow is gone — do not reintroduce
         flex/max-width/display overrides without looking at it on the real page. */
      /* ================= dark compaction notice + residual blues ================= */
      /* Dark mode: warm label grays (compaction notice title/summary/sep used bluish defaults) */
      body[data-ds-dark-theme] {
        --dsw-alias-label-tertiary: #9a9d98;
        --dsw-alias-label-caption: #a4a6a1;
        --dsw-alias-label-dimmed: #70736f;
        --dsw-alias-label-primary-dimmed: #d8d9d5;
        --dsw-alias-label-primary-inverted: #101110;
      }
      /* Preset menu descriptions readable without hover in dark */
      body[data-ds-dark-theme] [class$='_itemDesc'] {
        color: #c5c7c2 !important;
      }
      /* Light + dark: warm the remaining bluish-gray surfaces / buttons / code blocks */
      body {
        --dsw-alias-bg-layer-3: #dcddd6;
        --dsw-alias-bg-module-platform: #f2f2ec;
        --dsw-alias-markdown-code-block: #ecece6;
        --dsw-alias-button-elevated-fill: #f2f2ec;
        --dsw-alias-button-floating-fill: #f2f2ec;
        --dsw-alias-button-floating-hover: #e8e8e2;
        --dsw-alias-button-ghost-active-fill: #dcddd6;
        --dsw-alias-button-ghost-active-hover: #d8d9d5;
        --dsw-alias-button-ghost-active-border: #b6b8b3;
        --dsw-alias-button-primary-hover: #2a2b28;
        --dsw-alias-button-contrast-fill: #3a3c38;
        --dsw-alias-tooltip-bg: #2a2b28;
        --dsw-specific-input-major: #f2f2ec;
        --dsw-specific-selector: #e8e8e2;
        --dsw-specific-tip: #e8e8e2;
        --dsw-static-blue-400: #757874;
        --dsw-static-blue-450: var(--edge-accent);
        --dsw-static-blue-500: #101110;
        --dsw-alias-label-quaternary: #6a6d68;
        --dsw-alias-label-error: #ff3b30;
        --dsw-alias-label-inverse: #101110;
        --dsw-alias-line-secondary: #d8d9d5;
        --dsw-alias-separator-primary: #9a9d98;
        --dsw-alias-border-secondary: #b6b8b3;
        --dsw-alias-bg-primary: #f2f2ec;
        --dsw-alias-interactive-bg-primary: var(--edge-accent);
        --dsw-alias-fill-l2: #dcddd6;
        --dsw-alias-fill-tsp-secondary: #dcddd6;
      }
      body[data-ds-dark-theme] {
        --dsw-alias-bg-layer-3: #2c2e2a;
        --dsw-alias-bg-module-platform: #2c2e2a;
        --dsw-alias-bg-layer-2: #1e201d;
        --dsw-alias-markdown-code-block: #181a18;
        --dsw-alias-button-elevated-fill: #3a3c38;
        --dsw-alias-button-floating-fill: #343633;
        --dsw-alias-button-floating-hover: #3a3c38;
        --dsw-alias-button-ghost-active-fill: #343633;
        --dsw-alias-button-ghost-active-hover: #3f413d;
        --dsw-alias-button-ghost-active-border: #5f6460;
        --dsw-alias-button-primary-hover: var(--edge-accent-deep);
        --dsw-alias-button-contrast-fill: #f5f5f0;
        --dsw-alias-tooltip-bg: #2a2b28;
        --dsw-specific-input-major: #202220;
        --dsw-specific-selector: #2c2e2a;
        --dsw-specific-tip: #2c2e2a;
        --dsw-static-blue-400: #9a9d98;
        --dsw-static-blue-450: var(--edge-accent);
        --dsw-static-blue-500: #f5f5f0;
        --dsw-alias-label-quaternary: #9a9d98;
        --dsw-alias-label-error: #ff6b61;
        --dsw-alias-label-inverse: #101110;
        --dsw-alias-line-secondary: #343633;
        --dsw-alias-separator-primary: #70736f;
        --dsw-alias-border-secondary: #4a4d49;
        --dsw-alias-bg-primary: #181a18;
        --dsw-alias-interactive-bg-primary: var(--edge-accent);
        --dsw-alias-fill-l2: #242624;
        --dsw-alias-fill-tsp-secondary: #242624;
      }
      /* Token meter: messages segment signal yellow, system warm gray (tools keeps purple)
         Both suffixes are unique to the ContextMeter component, so a bare substring
         match is safe (hash-pinned .JObwrW_* died in the 0.1.2-rc.1 rehash). */
      [class*='_colorMessages'] {
        --meter-tint: var(--edge-accent) !important;
      }
      [class*='_colorSystem'] {
        --meter-tint: #9a9d98 !important;
      }
      /* Appearance theme cube selected border: warm.
         '_selected' as a bare substring is safe-ish BECAUSE the rule only sets
         border-color: an element without a border is untouched, and any bordered
         selected element gets the warm line colour — which is the theme's
         de-blue-ing goal everywhere anyway. In dark mode the broad accent rule
         further down (0,2,0 specificity) outranks this and keeps its own colour. */
      [class*='_selected'] {
        border-color: var(--dsw-alias-border-l2) !important;
      }
      /* Hero preview badge: solid signal-yellow + black (reference accent chip).
         '_previewBadge' is unique to the hero shell (HeroShell on 0.1.2-rc.1). */
      [class*='_previewBadge'] {
        color: var(--edge-accent-ink, #101110) !important;
        background: var(--edge-accent) !important;
        border-color: var(--edge-accent) !important;
      }
      /* ---------- Hero backdrop glow: brand blue -> signal yellow ----------
         The empty-conversation hero paints one large blurred ellipse behind the
         composer card (ConversationRoot's <HeroGlow>, class *_heroGlow, figma
         313:14109; feGaussianBlur stdDeviation 50, ellipse 135% of the column
         width centred 92px above its bottom edge).
         Its colour is an SVG PRESENTATION ATTRIBUTE — fill="#6187D8"
         fill-opacity="0.08" — not a token, so the whole "neutralize remaining
         DeepSeek brand blues" variable block above could never reach it: a soft
         periwinkle haze survived the theme on that one page. A presentation
         attribute loses to ANY author CSS declaration, so restyling the ellipse
         here is sufficient and no app source is touched.

         Opacity is per scheme, and the two values are MEASURED, not picked: the
         app's exact glow svg was rendered headless over each --dsw-alias-bg-base
         and the ellipse core sampled, so the replacement can be matched to the
         presence of the glow it replaces (Y = 0.2126R+0.7152G+0.0722B):
           light #e8e8e2 (Y 231.5): 8% #6187D8 -> #DDE0E1 (Y 223.3, -8.2)
                                    8% #fff500 -> #E9E8D0 (Y 230.4, -1.1)
           dark  #101110 (Y  16.8): 8% #6187D8 -> #161A1F (Y  25.0, +8.2)
                                    5% #fff500 -> #1C1C0F (Y  27.1, +10.3)
         Light keeps 8%: yellow there is almost luminance-NEUTRAL and shifts only
         chroma (blue channel -18), i.e. a warm breath on the paper rather than
         the blue's grey-blue darkening — gentler than what it replaces, not
         louder. Dark had to come down from 8%/7%: over near-black, added
         luminance reads far more readily than subtracted blue does over cream
         (7% measured #20200E, Y +13.4 — about 1.6x the blue's lift), and 5%
         lands within ~2 Y of the original glow. So the hero keeps exactly the
         depth it had, in the theme's own accent.
         Matched on the '_heroGlow' CSS-module suffix, never on a build hash.
         NOTE: 0.1.2-rc.1 removed the glow SVG entirely (the hero was merged into
         ConversationRoot with no <HeroGlow>), so these rules match nothing there;
         they are kept as a self-healing hook in case upstream restores it. */
      [class*='_heroGlow'] ellipse {
        fill: var(--edge-signal, var(--edge-accent)) !important;
        fill-opacity: var(--edge-glow-light) !important;
      }
      body[data-ds-dark-theme] [class*='_heroGlow'] ellipse {
        fill-opacity: var(--edge-glow-dark) !important;
      }
      /* Brand wordmark HARNESS chip: signal-yellow box + black letters (both modes) */
      body {
        --dsw-alias-label-primary-inverted: var(--edge-accent-ink, #101110);
      }
      [class*='brand'] svg rect,
      [class$='_newSession'] svg rect {
        fill: var(--edge-accent) !important;
      }
      /* Compaction notice row: soft yellow wash + accent in dark, hover = solid inversion */
      body[data-ds-dark-theme] [class$='_compactionRow'] {
        background: rgba(var(--edge-accent-rgb), 0.08) !important;
        border-left: 2px solid rgba(var(--edge-accent-rgb), 0.55) !important;
      }
      body[data-ds-dark-theme] [class$='_compactionButton']:hover:not(:disabled),
      body[data-ds-dark-theme] [class$='_compactionButton']:focus-visible {
        background: var(--edge-accent) !important;
      }
      body[data-ds-dark-theme] [class$='_compactionButton']:hover *,
      body[data-ds-dark-theme] [class$='_compactionButton']:focus-visible * {
        color: var(--edge-accent-ink, #000) !important;
      }
      body[data-ds-dark-theme] [class$='_compactionButton']:hover [class$='_compactionSep'],
      body[data-ds-dark-theme] [class$='_compactionButton']:focus-visible [class$='_compactionSep'] {
        background: var(--edge-accent-ink, #000) !important;
      }
      /* ================= composer add (+) button hover inversion ================= */
      /* Dark: + icon signal yellow at rest; on hover solid yellow bg + black icon.

         SCOPED TO THE COMPOSER, like the '_arrow' rule below and for the same
         reason: the hook is a bare SUBSTRING ('_add'), so every upstream class that
         merely CONTAINS it was painted too. Audited against the installed bundles
         (0.1.7-era), the collision set is:
           RlGAzG_add             composer + button                    <- the target
           _3nPmjq_addActions     settings > 模型 add-block WRAPPER   <- the report
           _3nPmjq_addBlock / _addCard / _addModes / _addPanel / _addModelButton
           _0SbxAa_add            deliverables file-diff ADDED line
           LFNH1G_added / kuvljq_added / pFy1Ka_diffAdded /
           haSm5q_promptDiffLineadded
           qWvkEq_address*        sidebar-browser address bar
           fO69Vq_addButton / _3nPmjq_addButton   (what the old ':not()' excluded)

         The reported screenshot is the WRAPPER. '_addActions' is a plain <div>
         around 添加模型提供商, so ':disabled' never applies and pointing at the
         BUTTON hovers the wrapper as well. The theme filled the wrapper with the
         SOLID accent while the button kept upstream's translucent wash
         (rgba(255,245,0,.18)) plus color: label-primary — #f5f5f0 on #fff500 =
         1.05:1, an invisible label. The button's dashed border kept drawing over
         the fill, which is exactly what the report shows. Measured on the running
         build (not inferred): rest -> wrapper transparent, hover -> wrapper
         rgb(255,245,0) under a button at rgb(245,245,240).

         ':not([class*='_addButton'])' could not have caught it — the wrapper is not
         the button — and every '*_add*' container upstream adds would have had to be
         appended to that exclusion list one bug report at a time. Scoping fixes the
         whole family at once, the same way '_arrow' was fixed.

         The scope is the pair the composer '_primary' / '_arrow' rules already use,
         so the + keeps its inversion. '[data-composer-seat]' is included because the
         seat declares it upstream ('data-composer-seat', an e2e anchor): a
         '[class$=]' hook dies silently the moment upstream appends a second class to
         that element, which is the failure mode this file has already paid for.

         Note the + is the ONLY composer element whose class contains '_add'; the
         scope cannot reach the settings wrappers, the diff lines or the address bar.
         Verified by test/hover-check.js against real hovered pixels in both
         palettes and both schemes. */
      body[data-ds-dark-theme] :is([data-composer-seat], [class$='_composerSeat'], [class$='_composerHero']) [class*='_add'] {
        color: var(--edge-status-dark, var(--edge-accent)) !important;
      }
      body[data-ds-dark-theme] :is([data-composer-seat], [class$='_composerSeat'], [class$='_composerHero']) [class*='_add']:hover:not(:disabled),
      body[data-ds-dark-theme] :is([data-composer-seat], [class$='_composerSeat'], [class$='_composerHero']) [class*='_add']:focus-visible {
        color: var(--edge-accent-ink, #000) !important;
        background: var(--edge-accent) !important;
      }
      /* ================= composer primary send/stop button ================= */
      /* Dark: hardcoded #fff icon on yellow info-fill -> black icon; hover deeper yellow.
         Scoped to the composer (the seat band in a live conversation, the hero
         wrapper on the empty state) and to <button>: '_primary' as a bare suffix is
         too generic to trust with a colour flip anywhere else. */
      body[data-ds-dark-theme] :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary'] {
        color: var(--edge-accent-ink, #101110) !important;
      }
      body[data-ds-dark-theme] :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary']:hover:not(:disabled) {
        color: var(--edge-accent-ink, #101110) !important;
        background: var(--edge-accent-deep) !important;
      }
      /* ================= light-mode white-on-dark buttons keep white icon ================= */
      /* Generic hover inversion would make the white send icon black on the dark fill.
         (The old list also had .zGbnIq_primaryButton from settings › 模型; upstream
         removed that class in 0.1.2-rc.1. If a replacement appears, name it here
         explicitly rather than widening the composer scope.) */
      body:not([data-ds-dark-theme]) :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary'],
      body:not([data-ds-dark-theme]) :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary']:hover:not(:disabled) {
        color: #fff !important;
      }
      /* ================= buttons the theme fills with the SOLID accent =================
         Settings > 模型 draws its row actions with a '<hash>_secondaryButton'
         class (zGbnIq_ in the 0.1.1 bundles), whose upstream rule is:
             color:      var(--dsw-alias-label-primary)
             background: var(--dsw-alias-interactive-bg-hover-solid)   (on :hover)
         This theme maps that background token to the solid accent but upstream keeps
         owning the foreground — so in dark mode the label stayed label-primary
         (#f5f5f0) on signal yellow. Measured from a real screenshot of the 编辑
         button: 63 px of #f5f5f0 sitting on #fff500 = 1.05:1, i.e. the word was
         invisible. On 武陵青 the same pairing is 2.61:1 — still failing, just less
         obviously, which is how it stayed hidden.

         Why the existing hover-inversion rule did not already cover it: that
         selector deliberately EXCLUDES plain buttons, because a button's own fill
         and text must survive hover (the yellow toggle keeps black text, the
         white-on-dark send button keeps white). This button is the case where the
         fill comes from the THEME and the text from the APP, so it has to be named.

         Scoped to the accent-filled states only, so the resting transparent button
         keeps label-primary and stays correct in both schemes (measured 16.00:1
         dark / 16.84:1 light). Guarded by test/settings-buttons.test.js.

         .HOVERPROBE is included deliberately: a screenshot/computed-style test
         cannot trigger :hover, so the test swaps in that class, which has the same
         0,1,0 specificity as the pseudo-class and therefore the same cascade
         outcome. Naming it here keeps the rule the test verifies identical to the
         rule that ships, instead of testing a near-copy. It never matches in the
         real app, since nothing renders that class.

         The class list is not just the reported button. Auditing the installed
         bundles for elements whose hover background is that token found SIX, and
         three of them additionally re-assert color:label-primary in the same rule
         (so they would fight a token-level fix):
           *_secondaryButton   settings > 模型 row actions           <- reported
           *_inspectButton     inspect panels (cordis / skill / tool —
                               three modules, one semantic suffix)
           *_arrow             attachment carousel arrow
           *_add               composer + (already handled above)
         All are the same defect on different screens, so they are fixed together
         rather than one bug report at a time.

         MATCHING IS HASH-FREE and matched on the SUBSTRING, not [class$=...]: an
         attribute-suffix match requires the WHOLE class attribute to end with the
         string, so it silently misses any element that carries a second class
         after it (measured: [class$='_inspectButton'] failed on
         class="gNWCoW_inspectButton HOVERPROBE"). Upstream composes class lists
         freely AND rehashes modules between releases (0.1.2-rc.1 killed all 33
         pinned hashes), so the semantic token embedded in the class is the only
         durable hook — '_secondaryButton' / '_inspectButton' are specific enough
         that no other component uses them.

         '_arrow' is the one exception that needs SCOPING, not a bare match: two
         other components (trajectory, workspace) also carry *_arrow classes and
         take NO hover fill, so a bare match would force ink onto elements that
         keep their normal background — black-on-near-black in dark mode,
         inventing a new contrast bug while fixing this one. The attachment
         carousel lives inside the composer, so the composer wrappers scope it;
         if a hover-filled arrow ever renders elsewhere, add its scope here. */
      :is([class*='_secondaryButton'], [class*='_inspectButton']):hover:not(:disabled),
      :is([class*='_secondaryButton'], [class*='_inspectButton']):hover:not(:disabled) svg,
      :is([class*='_secondaryButton'], [class*='_inspectButton']):hover:not(:disabled) svg path,
      :is([class*='_secondaryButton'], [class*='_inspectButton']).HOVERPROBE:not(:disabled),
      :is([class*='_secondaryButton'], [class*='_inspectButton']).HOVERPROBE:not(:disabled) svg,
      :is([class*='_secondaryButton'], [class*='_inspectButton']).HOVERPROBE:not(:disabled) svg path,
      :is([class$='_composerSeat'], [class$='_composerHero']) [class*='_arrow']:hover:not(:disabled),
      :is([class$='_composerSeat'], [class$='_composerHero']) [class*='_arrow']:hover:not(:disabled) svg,
      :is([class$='_composerSeat'], [class$='_composerHero']) [class*='_arrow']:hover:not(:disabled) svg path,
      :is([class$='_composerSeat'], [class$='_composerHero']) [class*='_arrow'].HOVERPROBE:not(:disabled),
      :is([class$='_composerSeat'], [class$='_composerHero']) [class*='_arrow'].HOVERPROBE:not(:disabled) svg,
      :is([class$='_composerSeat'], [class$='_composerHero']) [class*='_arrow'].HOVERPROBE:not(:disabled) svg path {
        /* Accent-ink on accent: 16.50:1 on 谷地黄, 6.62:1 on 武陵青, white on
           终末地灰's #626262 6.10:1 — all AA through --edge-accent-ink. */
        color: var(--edge-accent-ink, #101110) !important;
        fill: currentColor !important;
      }
      /* ---------- light mode: the danger (移除) button needs a darker red ----------
         Not part of the accent work, but measured by the same test and failing:
         --dsw-alias-state-error-primary is #ff3b30, which on the settings panel
         (#f2f2ec) is only 3.16:1 — below AA for the 12px label it paints. iOS-style
         reds are tuned for white-on-red fills, not red-on-paper text. Darkening the
         TEXT colour alone (the token keeps its value for fills/dots elsewhere)
         brings it to 5.12:1 while staying unmistakably red.
         (0.1.2-rc.1 removed the old zGbnIq_dangerButton class; the semantic suffix
         is kept so the rule re-arms itself if the button returns under the same
         name, and no-ops harmlessly until then.) */
      body:not([data-ds-dark-theme]) [class*='_dangerButton'] {
        color: #c62016 !important;
      }
      /* ================= dark mode: selected rows = solid signal-yellow + black text ================= */
      /* The translucent yellow wash makes white text look muddy olive; the reference
         inverts to black-on-signal-yellow, so selected rows get the full inversion. */
      body[data-ds-dark-theme] [class*='selected' i]:not([class*='unselected' i]) {
        color: var(--edge-accent-ink, #000) !important;
        background: var(--edge-accent) !important;
        border-color: var(--edge-accent) !important;
      }
      body[data-ds-dark-theme] [class*='selected' i]:not([class*='unselected' i]) *:not(svg):not(path) {
        color: var(--edge-accent-ink, #000) !important;
      }
      /* ================= ask_user_question option chips ================= */
      /* Two contrast collisions in the question card (@deepseek-ai/dsh-client-ui-user-questions),
         both measured on a real card rather than guessed.

         1) The recommended chip. Upstream paints it with
              color: var(--dsw-alias-button-info-fill)
              background: var(--dsw-specific-sidebar-nav-item-active-accent)
            i.e. it uses info-fill as a FOREGROUND. This theme maps that token and the
            nav accent to the SAME value in both modes (#101110 light / #fff500 dark),
            so the label painted itself onto its own fill and the chip measured as a
            single flat colour with ZERO glyph pixels. Broken in BOTH modes, not just
            dark. Pin the pair explicitly instead of retuning either token, because
            both are consumed as real background fills elsewhere. */
      :is([role='radio'], [role='checkbox']) [class*='badge' i] {
        color: var(--edge-accent-ink, #101110) !important;
        background: var(--edge-accent) !important;
      }
      /* On a selected row the row itself is already solid signal yellow, so the chip
         inverts to keep its edge instead of dissolving into the row. */
      body[data-ds-dark-theme] [class*='selected' i]:not([class*='unselected' i]) [class*='badge' i] {
        color: var(--edge-status-dark, var(--edge-accent)) !important;
        background: #101110 !important;
      }
      /* 2) The option number ("1", "2", ...). The blanket dark inversion above
            recolours descendant TEXT to black but cannot touch a descendant's own
            background, so this chip kept its overlay fill
            (--dsw-alias-bg-overlay = #1c1e1c) and rendered a black digit on
            near-black: measured 1.25:1, i.e. the numbering vanished on the selected
            row. Wash the chip rather than filling it, so the digit reads on yellow
            and the chip still looks like a chip. */
      body[data-ds-dark-theme] [class*='selected' i]:not([class*='unselected' i]) [class*='number' i] {
        color: var(--edge-accent-ink, #101110) !important;
        background: color-mix(in srgb, var(--edge-accent-ink, #101110) 14%, transparent) !important;
      }
      /* ---------- Turn-status label ("Deep diving...") ----------
         Owner: @deepseek-ai/dsh-client-ui-conversation, class Md3f7G_turnStatus.

         This label is GRADIENT TEXT, not coloured text. Upstream paints a
         linear-gradient background, sets -webkit-text-fill-color: transparent plus
         background-clip: text, and animates background-position to shimmer:

           background: linear-gradient(90deg,
             var(--dsw-static-deepseek-500) 0%   40%,
             var(--dsw-static-deepseek-200) 50%,
             var(--dsw-static-deepseek-500) 60% 100%);
           color: #0000; -webkit-text-fill-color: transparent;

         Two consequences drive the rules below:
           1. A plain 'color:' CANNOT recolour this label — the transparent text
              fill wins, so the glyphs would stay whatever the gradient paints. The
              recolour therefore has to go through the gradient itself.
           2. Retinting the shared --dsw-static-deepseek-* tokens is the wrong lever:
              --dsw-static-deepseek-500/200 also back --dsw-alias-button-info-fill,
              --dsw-alias-state-business-primary and --dsw-specific-bubble-highlight
              (verified in dsh-client-ui-theme/styles/design-platform.css), so the
              theme already maps them to ink/paper on purpose. Only
              background-image is overridden here, which leaves upstream's
              background-size, background-position and shimmer animation untouched.

         COLOUR CHOICE IS MEASURED, NOT PICKED BY EYE. Every gradient stop must
         clear WCAG AA 4.5:1 against BOTH backgrounds the label can sit on in its
         mode (bg-base and bg-layer-1), because the mid-band sweeps through the
         glyphs — and under prefers-reduced-motion upstream pins background-size to
         100%, leaving that mid-band permanently inside the text. Measured:
           light bg #e8e8e2 / #f2f2ec —  #fff500 scores 1.02:1 (invisible; the naive
             "just make it yellow" reading of this request), #8f7c00 3.38, #7d6c00
             4.25, and #6b5d00 5.35 is the FIRST gold that clears AA;
           dark  bg #101110 / #181a18 —  #fff500 15.26, #a08a00 5.11, while #8f7c00
             falls to 4.21 and fails.
         Hence the sweep DIPS deeper in both modes instead of lifting brighter:
         in light mode no gold above #6b5d00 can clear AA, and in dark mode a pale
         lift band desaturates to near-white and loses the yellow entirely.
         Light mode is a deep gold rather than signal yellow for the same reason the
         watermark and rail are not: on cream, #fff500 is not a colour choice, it is
         an erasure. */
      body [class*='turnStatus']:not([class*='turnStatusClock']) {
        background-image: linear-gradient(90deg,
          var(--edge-status-light) 0%, var(--edge-status-light) 40%, var(--edge-status-light-mid) 50%, var(--edge-status-light) 60%, var(--edge-status-light) 100%) !important;
      }
      body[data-ds-dark-theme] [class*='turnStatus']:not([class*='turnStatusClock']) {
        background-image: linear-gradient(90deg,
          var(--edge-status-dark) 0%, var(--edge-status-dark) 40%, var(--edge-status-dark-mid) 50%, var(--edge-status-dark) 60%, var(--edge-status-dark) 100%) !important;
      }
      /* ================= boot loading screen ================= */
      /* Fixed plate above everything, including the shell overlay layer. It exists
         only while the boot animation plays and is removed afterwards, so none of
         these rules match during normal use. Measurements come from the reference
         frame (1340x731) expressed as ratios so they scale with the viewport. */
      [data-endfield-loader] {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        background: #101110;
        /* Not inherited from the app: the plate can paint before tokens resolve,
           and since the theme stopped overriding the root font token it must not
           depend on inheritance for its face either. Both the family and the
           openType features are declared here rather than globally. */
        color: #f5f5f0;
        font-family: var(--edge-font);
        font-feature-settings: "tnum" 1, "ss01" 1;
        overflow: hidden;
        /* Never trap the user: even mid-animation the app underneath stays usable. */
        pointer-events: none;
        opacity: 1;
        /* No opacity transition: the fade is driven from JS (see finish()) because a
           CSS transition proved not to run in every renderer this plate targets.
           finish() also sets inline transition:none so nothing can fight it. */
      }
      /* Kept as a state hook (and a fallback for a renderer that never runs the JS
         fade) — the inline opacity written by finish() is what actually animates. */
      [data-endfield-loader][data-endfield-loader-exit] {
        opacity: 0;
      }
      /* Faint industrial grid, matching the reference backdrop texture. */
      [data-endfield-loader-tex] {
        position: absolute;
        inset: 0;
        opacity: 0.55;
        background-image:
          repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.014) 0 1px, transparent 1px 4px),
          repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.010) 0 1px, transparent 1px 120px);
      }
      /* 8px rail: dim track full height, signal-yellow fill from the top down. */
      /* 10px rail, measured from the reference (10/1184 of the width). */
      [data-endfield-loader-track] {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 10px;
        background: rgba(var(--edge-accent-rgb), 0.10);
      }
      [data-endfield-loader-fill] {
        position: absolute;
        left: 0;
        top: 0;
        width: 10px;
        height: 0%;
        background: var(--edge-accent);
      }
      /* Meter RIDES THE FILL END: its top offset is set per frame from the same eased
         progress value that drives the fill height (see step()), so the readout
         descends with the bar. The exact offset and the clamping are done in JS,
         where the group's real height is known — a pure CSS percentage would let the
         readout hang off the bottom of the screen as the fill approaches 100%.
         Deliberately no CSS transition on the top offset: it is already updated every
         frame, and a transition would make the readout visibly lag the bar. */
      [data-endfield-loader-meter] {
        position: absolute;
        left: 26px;
        top: 0;
        will-change: top;
      }
      [data-endfield-loader][data-endfield-loader-complete] [data-endfield-loader-meter] {
        position: fixed !important;
        left: 26px !important;
        top: auto !important;
        bottom: 64px !important;
      }
      /* ---- completion flourish: yellow sweep to the right, then fade ----
         Starts as the rail itself (same 10px width, same colour, same left edge) and
         widens to cover the viewport, so the sweep reads as the finished bar flooding
         the screen rather than a new element appearing.
         Width and opacity are animated from JS (see finish()), deliberately NOT by a
         CSS transition: measured in the verification renderer, a transition declared
         here never started — no transitionrun/start/end events fired and the computed
         width stayed at 10px well past its duration — which would leave a thin stub
         instead of a sweep. These rules therefore only describe the resting state and
         must not declare a width/opacity transition that would fight the JS. */
      [data-endfield-loader-wipe] {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 10px;
        background: var(--edge-accent);
        opacity: 0;
      }
      [data-endfield-loader-tick] {
        display: block;
        width: 4px;
        height: 15px;
        background: var(--edge-accent);
      }
      [data-endfield-loader-pct] {
        display: block;
        margin-top: 7px;
        color: var(--edge-status-dark, var(--edge-accent));
        font-size: 39px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.01em;
        font-variant-numeric: tabular-nums;
      }
      [data-endfield-loader-status] {
        display: block;
        margin-top: 12px;
        color: #666;
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 0.02em;
      }
      /* ---- Poster brand block --------------------------------------------------
         Measured from the supplied key-art (1184x685) by scanning its pixels, not
         estimated — the ink bands on the right half of the reference are:
           block left ink edge  x=868  -> 868/1184 = 73.3% of the width
           right-most ink       x=1098 -> right gap 86px = 7.3% of the width
           kicker band          y 258..260   h=3    (ratio to cap 0.10)
           END band             y 265..293   h=29   -> cap 4.23% of plate height
           FIELD band           y 297..325   h=29   -> line pitch 32px, 32/29 = 1.10
           chevron band         y 498..506   x=841  -> outdent 868-841 = 27px
           tagline band         y 543..551   h=9, run width 231px
         The block is LEFT-aligned internally (all rows share x=868) but placed on
         the right — that combination is what gives the reference its look; a
         right-aligned (ragged-left) block reads completely differently.

         GEOMETRY MODEL — the block is anchored by its RIGHT margin, not by a left
         percentage. That is deliberate and is what fixes two measured faults:
           1. A left percentage (the old --edge-rail: 73%) sets where the block
              STARTS and lets its width run toward the right edge, so the margin
              that a viewer actually reads as "too far right" was never controlled.
              Anchoring 'right' makes that margin the declared quantity, and the
              rhythm line falls out of the widest row instead of being guessed.
           2. Sizing purely in vh made the wordmark shrink on a wide-but-short
              window and, at the old 4.2vh, rendered the cap at 3.01% of plate
              height against the reference's 4.23% — measurably ~70% of reference,
              which is why it read as too small.
         --edge-word is therefore clamp(26px, min(5.2vh, 4.8vw), 64px):
           min(5.2vh, 4.8vw)  scales with the SMALLER axis, so neither a short nor
                              a narrow window can push the block into the rail;
           26px floor         keeps the sub-rows legible on a tiny plate;
           64px ceiling       measured: without it, cap-height fell to 2.69% of H
                              at 2560x1440 (the block visibly shrank on a large
                              display); 64px holds it at ~3.2% and up.
         Verified across 13 viewports from 520x900 to 2560x1440: cap-height stays
         within 3.1-3.9% of plate height (reference 4.23%, intentionally a touch
         under — see below) with no overflow past any edge and >=150px clearance
         from the progress rail and its meter.
         The block still renders slightly under reference scale on purpose: the
         key-art is a full-bleed poster, whereas this plate flashes over an app.
         Every row is a ratio of --edge-word, so this one value rescales the whole
         block without disturbing the measured proportions above. The small rows
         additionally carry a px floor — see the max() calls below. */
      [data-endfield-loader] {
        --edge-word: clamp(26px, min(5.2vh, 4.8vw), 64px);
        /* Distance from the plate's right edge to the block's right edge. The %
           term keeps it proportional on a wide display; the px term stops it
           collapsing on a narrow one. */
        --edge-gap: max(64px, 12%);
      }
      [data-endfield-loader-brand] {
        position: absolute;
        right: var(--edge-gap);
        top: 50%;
        transform: translateY(-50%);
        /* No max-width: every row sets white-space: nowrap, so a width cap cannot
           wrap them — it only clips. The block moves instead (see the --edge-gap
           media queries) so the longest row always fits. */
      }
      /* Anchor to --edge-word like every other row. Without this the em below
         resolves against the inherited root font-size (16px), which rendered the
         kicker at 2.25x its reference size and bloated the whole block. */
      [data-endfield-loader-kicker] {
        display: block;
        font-size: var(--edge-word);
      }
      [data-endfield-loader-kicker]::before {
        content: 'DEEPSEEK HARNESS';
        display: block;
        margin-bottom: 0.5em;
        color: #f5f5f0;
        /* max() floor: the reference ratio alone (0.135em of the wordmark) computes
           to ~4px on a short plate, which renders as an illegible grey smudge
           rather than text. 9px is the smallest size this still reads at. */
        font-size: max(9px, 0.155em);
        font-weight: 600;
        letter-spacing: 0.26em;
        white-space: nowrap;
        opacity: 0.95;
      }
      /* Both rows: the negative margin cancels Arial's left side bearing so the
         INK edge lands on the rhythm line, not the glyph box edge. */
      [data-endfield-loader-word] {
        display: block;
        margin-left: -0.055em;
        color: #f5f5f0;
        font-size: var(--edge-word);
        font-weight: 900;
        /* 0.80, not 1.10: the reference pitch/cap of 1.10 is measured between
           INK tops, while line-height spans the full em box (ascender+descender),
           which for Arial-900 is ~1.38x the cap height. 1.10 as a line-height
           renders a visibly loose 1.52 ink pitch. */
        line-height: 0.80;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }
      [data-endfield-loader-word1]::before { content: 'END'; }
      [data-endfield-loader-word2]::before { content: 'FIELD'; }
      /* ---- detail cluster: chevron outdented into the left margin ---- */
      [data-endfield-loader-detail] {
        display: block;
        position: relative;
        margin-top: 1.9em;
        font-size: var(--edge-word);
      }
      [data-endfield-loader-chev] {
        position: absolute;
        left: -0.26em;
        top: 0.02em;
        width: 0.12em;
        height: 0.24em;
      }
      /* Two stacked chevrons drawn from borders — no glyph, no font dependency. */
      [data-endfield-loader-chev]::before,
      [data-endfield-loader-chev]::after {
        content: '';
        position: absolute;
        left: 0;
        width: 0.10em;
        height: 0.10em;
        border-left: 0.028em solid var(--edge-accent);
        border-bottom: 0.028em solid var(--edge-accent);
        transform: rotate(-45deg);
      }
      [data-endfield-loader-chev]::before { top: 0; }
      [data-endfield-loader-chev]::after { top: 0.09em; }
      [data-endfield-loader-sub]::before {
        content: 'EDGE INTELLIGENCE THEME';
        display: block;
        color: #8a8d88;
        /* Same legibility floor as the kicker: measured, the bare ratio rendered
           this row 3px tall — visible as a blur, not readable as words. */
        font-size: max(9px, 0.135em);
        font-weight: 500;
        letter-spacing: 0.12em;
        white-space: nowrap;
      }
      [data-endfield-loader-seq]::before {
        content: 'TERRA RESEARCH COMMISSION / BOOT SEQUENCE';
        display: block;
        margin-top: 0.4em;
        color: #6a6d64;
        font-size: max(8px, 0.125em);
        font-weight: 500;
        letter-spacing: 0.10em;
        white-space: nowrap;
      }
      [data-endfield-loader-squares] {
        display: grid;
        grid-template-columns: repeat(6, 0.115em);
        gap: 0.04em;
        margin-top: 0.30em;
      }
      [data-endfield-loader-squares] i {
        display: block;
        height: 0.05em;
        background: #2e302d;
      }
      [data-endfield-loader-squares] i[data-on] {
        background: var(--edge-accent);
      }
      /* Tagline closes the block on the same rhythm line.
         Reference: cap 11px across 232px, i.e. cap/width 0.38 — unreachable in
         Arial, where an 11px-cap run of this string measures 299px (340px at the
         reference's tracking). The source art uses a condensed face, and probing
         the renderer showed Arial Narrow genuinely resolves here (245px vs Arial's
         299px on the same probe), so it is used with Arial as the fallback: on a
         host without it the run simply sets wider in Arial and still fits, because
         the size below is a ratio of the wordmark rather than a fixed px. */
      [data-endfield-loader-tag]::before {
        content: 'OVER THE FRONTIER / INTO THE FRONT';
        display: block;
        margin-top: 1.05em;
        color: #f5f5f0;
        font-family: "Arial Narrow", Arial, sans-serif;
        font-size: max(10px, 0.34em);
        font-weight: 500;
        letter-spacing: 0.06em;
        white-space: nowrap;
      }
      [data-endfield-loader-tag] {
        display: block;
        font-size: var(--edge-word);
      }
      /* Narrow windows: pull the block toward the right edge so the measured ratios
         survive instead of the text clipping. Only the margin changes — --edge-word
         already scales itself off the smaller viewport axis, so the wordmark needs
         no per-breakpoint override. */
      @media (max-width: 1100px) {
        [data-endfield-loader] { --edge-gap: max(48px, 9%); }
      }
      @media (max-width: 760px) {
        [data-endfield-loader] { --edge-gap: max(28px, 5%); }
      }
      /* Reduced motion is handled in finish(), which skips the sweep/fade entirely
         and removes the plate outright; nothing here needs to disable a transition,
         since the plate no longer declares one. */
      /* Settings page root (the settings.section slot's own wrapper div, the one
         element of that panel this theme gets to name). Declaring the theme face
         here means every row, hint and button inside it inherits it BY
         CONSTRUCTION, without touching the app's root font token. The class is
         stable and additive, so it is safe to target. It also carries no colours:
         the panel keeps taking its ink and surfaces from app tokens, which is
         what keeps it readable on both schemes and with the theme switched off
         (see test/settings-off.test.js). */
      .endfield-settings {
        font-family: var(--edge-font);
      }
      /* Settings page group headers (rendered by the settings.section slot).
         The label is accent ink that stays AA on both surfaces: light mode uses
         the darkened accent stops (--edge-status-light: #6b5d00 / #006a6a),
         dark mode the bright ones (--edge-status-dark: #fff500 / #14d0d0) — the
         same measured pairs the turn-status shimmer uses. The palette class
         flips both variables, so the header follows the palette for free. */
      .endfield-settings-group-title {
        color: var(--edge-status-light);
      }
      body[data-ds-dark-theme] .endfield-settings-group-title {
        color: var(--edge-status-dark);
      }
      /* ================= 雷霆大字 (娱乐模式) =================
         The task-boundary announcement. Fixed, centred, above the shell overlay
         layer and the app's own dialogs but BELOW the boot plate (2147483000), so
         a boot animation still wins the screen it owns.

         WHITE, EXPLICITLY. The request asks for white text, and white is the one
         thing this theme's own tokens cannot promise: --dsw-alias-label-primary is
         INK (#101110) in light mode, so inheriting it would print the word in near
         black on cream. The glyph colour is therefore a literal #fff in both
         schemes, and legibility over unknown page content is bought by the plate's
         own scrim plus a dark text shadow rather than by the page background.

         THE SCRIM ALPHA IS MEASURED, NOT PICKED BY EYE — and the first value was
         WRONG. Shipping 0.28 looked fine in dark mode (18.92:1) and was almost
         invisible in light: white on ink-over-cream measured 2.29:1 on bg-base and
         2.11:1 on bg-layer-1, i.e. the same "on cream, #fff500 is not a colour
         choice, it is an erasure" failure this theme already documents for the
         watermark and the turn-status label — except here it was pure white. Caught
         by rendering the plate and measuring the pixels (test/thunder-shot.js), not
         by reading the CSS.

         Measured white-vs-scrimmed-surface, ink #101110 over each light surface:
             alpha   bg-base #e8e8e2   bg-layer-1 #f2f2ec   dark #101110
             0.28         2.29:1            2.11:1            18.92:1
             0.40         3.13:1            2.90:1            18.92:1
             0.50         4.17:1            3.89:1            18.92:1
             0.55         4.85:1            4.55:1            18.92:1
         0.55 is the first step where BOTH light surfaces clear 4.5:1 — the AA bar
         for ordinary body text, which is deliberate headroom for a word whose own
         bar is only the 3:1 large-text floor. Dark mode is unaffected either way
         (ink over near-black is the same colour), so the light surfaces are what
         set this number.

         pointer-events:none on both layers keeps every click, selection and scroll
         underneath working while the word is up — the plate is a caption, not a
         modal. Click-to-dismiss does NOT change that: the listener lives on the
         DOCUMENT in the capture phase (see showThunder), so a press both clears the
         word and reaches whatever the user aimed at. Giving this layer
         'pointer-events: auto' to catch the click itself would turn it into a
         full-screen click-eater for 3 seconds — verified by injecting exactly that
         and watching test/thunder-dismiss.test.js fail on hit-testing. */
      [data-endfield-thunder] {
        position: fixed;
        inset: 0;
        z-index: 2147482000;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        background: rgba(16, 17, 16, 0.55);
        animation: endfield-thunder-plate 3000ms linear 1 both;
      }
      [data-endfield-thunder-word] {
        /* 大字: heavy, oversized, and scaled off the viewport so it stays a
           screen-filling statement at any window size rather than a fixed 48px that
           looks large on a phone and small on a 4K panel. Same clamp discipline as
           --edge-word on the boot plate. */
        font-family: "Arial Black", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: clamp(44px, 13vw, 176px);
        font-weight: 900;
        line-height: 1;
        letter-spacing: 0.12em;
        /* The trailing letter-spacing would otherwise push the word off-centre. */
        text-indent: 0.12em;
        color: #fff;
        white-space: nowrap;
        text-align: center;
        /* Ink halo: what makes white type survive on cream paper, where a pure
           white glyph would otherwise have almost no edge. */
        text-shadow:
          0 0 2px rgba(16, 17, 16, 0.55),
          0 4px 18px rgba(16, 17, 16, 0.65),
          0 0 46px rgba(var(--edge-accent-rgb), 0.45);
        animation: endfield-thunder-word 3000ms cubic-bezier(0.16, 1, 0.3, 1) 1 both;
      }
      /* The slam: overshoot in, hold, then fade. Keyframe percentages are the 3s
         hold expressed as one timeline, so a single animation covers entry, hold and
         exit and nothing has to be re-timed in JS. */
      @keyframes endfield-thunder-word {
        0%   { opacity: 0; transform: scale(2.4); }
        7%   { opacity: 1; transform: scale(0.94); }
        12%  { transform: scale(1); }
        80%  { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.06); }
      }
      @keyframes endfield-thunder-plate {
        0%   { opacity: 0; }
        5%   { opacity: 1; }
        80%  { opacity: 1; }
        100% { opacity: 0; }
      }
      /* The STATIC path: the word appears at full size and opacity, holds its 3s,
         then the JS timer removes it. Two independent reasons reach this attribute
         (see showThunder): the 动画 sub-switch being off — which is the DEFAULT — and
         the OS asking for reduced motion. Driving it from an attribute rather than a
         media query alone is what makes the default state testable in a browser that
         cannot toggle the OS preference from script.

         'opacity: 1' is load-bearing, not redundant: the animated rules start at
         'opacity: 0' and rely on the keyframes to bring the word in, so cancelling
         only 'animation' would leave a permanently invisible plate. */
      [data-endfield-thunder][data-endfield-thunder-still],
      [data-endfield-thunder][data-endfield-thunder-still] [data-endfield-thunder-word] {
        animation: none;
        opacity: 1;
        transform: none;
      }
      /* Belt-and-braces for reduced motion: the attribute above already covers it,
         but this keeps the guarantee in CSS even if a future edit reaches the DOM
         without going through showThunder(). */
      @media (prefers-reduced-motion: reduce) {
        [data-endfield-thunder],
        [data-endfield-thunder] [data-endfield-thunder-word] {
          animation: none;
          opacity: 1;
          transform: none;
        }
      }
      /* ================= 终末地工业风通知 =================
         The toast stack: bottom-right column of square industrial cards.
         Design language: paper fill, 2px ink border, ZERO radius, a signal-colour
         left rail (the accent as a 6px stripe — the same rail grammar as the boot
         plate), barcode-style head row. Attention kinds carry their own dismiss
         button; the done receipt does not (it auto-dismisses). */
      [data-endfield-notify-stack] {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147481000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        /* Above the app's own chrome but below the thunder plate; the stack is
           interactive (dismiss buttons), so it must not be pointer-events:none. */
        pointer-events: none;
        max-width: min(340px, calc(100vw - 32px));
      }
      [data-endfield-notify] {
        pointer-events: auto;
        position: relative;
        display: flex;
        align-items: stretch;
        background: var(--dsw-alias-bg-layer-1);
        border: 2px solid var(--dsw-alias-label-primary);
        border-radius: 0;
        box-shadow: 4px 4px 0 rgba(16, 17, 16, 0.35);
        overflow: hidden;
        animation: endfield-notify-in 220ms cubic-bezier(0.16, 1, 0.3, 1) 1 both;
      }
      [data-endfield-notify-rail] {
        flex: 0 0 6px;
        background: var(--edge-accent);
      }
      /* Attention kinds keep the ink border; the receipt swaps the rail for a
         thinner one so urgency is readable at a glance. */
      [data-endfield-notify='done'] [data-endfield-notify-rail] {
        flex-basis: 4px;
        background: var(--edge-accent-onpaper, var(--edge-accent));
      }
      [data-endfield-notify-main] {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 12px;
        min-width: 0;
      }
      [data-endfield-notify-head] {
        font-family: "Arial Black", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
        font-weight: 900;
        font-size: 12px;
        letter-spacing: 0.14em;
        color: var(--dsw-alias-label-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      [data-endfield-notify-body] {
        font-size: 12px;
        line-height: 1.5;
        color: var(--dsw-alias-label-secondary);
      }
      [data-endfield-notify-close] {
        flex: 0 0 auto;
        align-self: flex-start;
        margin: 6px 6px auto 0;
        width: 22px;
        height: 22px;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 0;
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
      }
      [data-endfield-notify-close]:hover {
        background: var(--dsw-alias-label-primary);
        color: var(--dsw-alias-bg-layer-1);
      }
      @keyframes endfield-notify-in {
        from { opacity: 0; transform: translateX(24px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        [data-endfield-notify] { animation: none; }
      }
    `)
      syncRadiusMode()
      syncMotion()
      syncGlass()
      syncTexture()
      syncPaletteClass()
    }
    const unmount = () => {
      if (!mounted) return
      mounted = false
      disposeToken()
      disposeStyles()
      disposeToken = () => {}
      disposeStyles = () => {}
      // Guarded like every other body touch: an unload race must not throw here.
      if (typeof document !== 'undefined' && document.body !== null) {
        document.body.classList.remove('theme-endfield-round')
        /* The palette classes must go with the stylesheet that gives them
           meaning: left behind each would be a class nothing defines, and it
           would make isPalette() report a palette the page is no longer using.
           The stored preference is untouched, so re-enabling restores it. */
        for (const cls of Object.values(PALETTE_CLASSES)) document.body.classList.remove(cls)
        document.body.removeAttribute?.('data-endfield-glass')
      }
      // The plate is styled by the theme stylesheet just torn down — an orphaned
      // plate would sit there as an unstyled black-less div, so drop it too.
      destroyLoader()
            /* The announcement plate is styled entirely by that stylesheet too, so an
         in-flight word would become an unstyled, un-positioned block of text in the
         document flow. Stop watching as well: with the theme off there is nothing to
         announce into. */
      thunderStopWatch()
      destroyThunder()
      /* The watermark must go with the stylesheet too, and it cannot wait for
         syncWatermarkVisibility(): with the sheet torn down its
         `opacity: var(--edge-wm-alpha)` computes invalid and falls back to 1,
         so an orphaned mark sits on the page as a fully opaque logo stamp.
         This path also runs when the switch is turned off from ANOTHER window
         (reconcileFromPrefs -> unmount), where nothing else removes the node —
         the local toggle path only looked covered because toggleTheme happened
         to call syncWatermarkVisibility() itself. */
      if (watermarkRaf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(watermarkRaf)
      watermarkRaf = null
      if (watermarkEl !== null && watermarkEl.parentNode) watermarkEl.parentNode.removeChild(watermarkEl)
      watermarkEl = null
      watermarkHost = null
      // The attention poll belongs to the themed, audio-enabled page; leaving it
      // running would keep reporting confirmations for a theme that is off.
      stopAudioAttentionWatch()
    }

    if (isEnabled()) {
      mount()
      syncWatermarkVisibility()
      // Boot animation: only on a real page load, only when switched on, and only
      // after the stylesheet above exists (mount() inserted it).
      if (isLoaderOn()) runLoader()
      // Task announcements: subscribes only while switched on, and the first value
      // it reads is a baseline, so enabling mid-turn stays silent.
      syncThunder()
      // 需要你回应: starts only while the theme and the audio feature are both on.
      syncAudioAttentionWatch()
    }

    /* Live preference reconciler. The namespace scope subscription in the store
       block near the top of apply() calls this every time an authoritative
       section change lands (our own committed writes echo back, another window /
       device edits the same profile's settings document
       (<profile>/cordis.patch.yml on 0.1.7, <dshHome>/settings.yaml before it),
       or the host reverts a value). It mirrors the initial mount block above so a
       runtime change re-paints exactly the live surfaces it can: the master switch mounts/unmounts
       the token + stylesheet layers, then radius/palette/watermark/
       thunder re-derive from the new value. The boot loader is deliberately not
       replayed here: it is a once-per-page-load plate, so a mid-session section
       change must not slam a startup animation over a running app. The one thing
       that DOES start it outside apply() is the first authoritative settle
       (onPrefsSettled) — that is the same page-load moment, not a later edit — plus
       the plate's own toggle and 预览 button. Every layer entry point is idempotent
       (mount() and unmount() guard on `mounted`), so repeated echoes are cheap
       and safe. */
    reconcileFromPrefs = () => {
      const enabledNext = isEnabled()
      const enabledNow = mounted
      if (enabledNext && !enabledNow) mount()
      else if (!enabledNext && enabledNow) unmount()
      if (enabledNext) {
        // These sync helpers read the store on each call, so no snapshot passing.
        syncRadiusMode()
        syncMotion()
        syncGlass()
        syncTexture()
        syncPaletteClass()
        syncWatermarkVisibility()
        syncThunder()
        // Same reason: it re-reads both switches and starts or stops the poll.
        syncAudioAttentionWatch()
      } else {
        // Switched off mid-session: the watcher must not keep polling a page the
        // theme no longer owns.
        stopAudioAttentionWatch()
      }
    }

    /* ---------- Settings page copy: zh / en dictionaries ----------
       The panel followed DSH's language setting for nothing before this: every
       label was a hardcoded Chinese literal, so an English UI showed a wholly
       Chinese settings page.

       The texts go through the app's own `locale` service (@deepseek-ai/dsh-client-
       locale) rather than a private language guess: it already owns the user's
       preference, its own durable storage and the re-render channel, and reading
       navigator.language here would drift from the setting the user actually chose.

       zh is the source of truth for the key set (this repo's convention) and en is
       kept complete against it — a key present in one and missing in the other would
       silently fall back to the raw key string in the UI, which is why the test suite
       compares the two key sets rather than trusting review.

       Naming: keys are grouped by row (`theme*`, `palette*`, `thunder*`) so a row's
       copy stays discoverable next to its switch. */
    const ENDFIELD_NS = 'settings.theme-endfield'
    const LOCALE_ZH = {
      nav: '终末地主题设置',
      /* The separator between a row label and its value. It is a DICTIONARY KEY, not
         a literal: Chinese uses the full-width '：' with no trailing space, English
         the ASCII ': '. Hardcoding the full-width form (as the first version did) put
         a Chinese colon into every English row — subtle, but exactly the kind of
         thing that makes a localized page feel machine-translated. */
      sep: '：',
      on: '开启',
      off: '关闭',
      groupTheme: '主题',
      groupBg: '背景',
      groupAnim: '动画',
      groupFun: '娱乐',
      groupNotify: '通知',
      themeRow: '终末地主题',
      themeOn: '开启主题',
      themeOff: '关闭主题',
      paletteRow: '主题配色',
      paletteGray: '终末地灰',
      paletteValley: '谷地黄',
      paletteWuling: '武陵青',
      paletteHintGray: '官网工业灰：悬停/选中用灰阶（亮 #d9d9d9 · 暗 #6a6a6a），默认',
      paletteHintValley: '信号黄 #fff500（终末地官网强调色）',
      paletteHintWuling: '青碧色强调 #14d0d0，用于按钮、悬停与选中行',
      radiusRow: '主题圆角',
      radiusRound: '圆角',
      radiusSquare: '直角',
      watermarkRow: '背景水印',
      watermarkOn: '开启水印',
      watermarkOff: '关闭水印',
      wmPersistRow: '水印保持显示',
      wmPersistOn: '保持显示',
      wmPersistOff: '仅新建页',
      wmPersistHintOn: '在对话等非新建会话页面也显示水印（置于正文之下）',
      wmPersistHintOff: '仅在新建会话页显示水印',
      wmPersistNeedWm: '请先开启背景水印',
      loaderRow: '启动加载动画',
      loaderOn: '开启动画',
      loaderOff: '关闭动画',
      loaderHintOn: '刷新页面时播放 ENDFIELD 启动加载屏（左侧进度轨 + 百分比，跟随当前配色）',
      loaderHintOff: '默认关闭；开启后每次刷新页面播放一次',
      loaderNeed: '请先开启启动加载动画',
      preview: '预览',
      thunderRow: '雷霆大字',
      thunderOn: '开启大字',
      thunderOff: '关闭大字',
      thunderHintOn: '任务开始/结束时，在屏幕中央用白色粗体大字显示「任务开始」/「任务完成」，3 秒后自动隐藏；点击屏幕任意处可立即关闭',
      thunderHintOff: '默认关闭；开启后任务开始/结束时在屏幕中央显示「任务开始」/「任务完成」白色大字，3 秒后自动隐藏，点击任意处可立即关闭',
      thunderNeed: '请先开启雷霆大字',
      thunderAnimRow: '大字入场动画',
      thunderAnimOn: '开启动画',
      thunderAnimOff: '关闭动画',
      thunderAnimHintOn: '大字由大缩小砸入并淡出（关闭后为直接显示，仍保持 3 秒）',
      thunderAnimHintOff: '默认关闭；大字直接出现、3 秒后消失，不做缩放与淡入淡出',
      textureRow: '工业底纹',
      textureHint: '官网 /operator 的背景（只作用于主内容列）：上半网格渐隐 + 底部斜纹带 + 两级波纹',
      textureOff: '关闭（纯色）',
      textureSubtle: '轻（网格 + 斜纹）',
      textureStandard: '完整（官网默认）',
      motionRow: '按钮动效',
      motionHint: '六套母题，作用于不同按钮角色：A 信号（官网签名）· B 静默（极简）· C 冲压（激进）· D 角标（工程标注）· E 读数（仪表计量）· F 盖章（落印）',
      motionSignal: '方案A · 信号（官网签名）',
      motionSilent: '方案B · 静默（极简）',
      motionImpact: '方案C · 冲压（激进）',
      motionClamp: '方案D · 角标（工程标注）',
      motionMeter: '方案E · 读数（仪表计量）',
      motionStamp: '方案F · 盖章（落印）',
      motionOff: '关闭（无动效）',
      notifyRow: '工业风通知',
      notifyOn: '开启通知',
      notifyOff: '关闭通知',
      notifyHintOn: '任务完成自动消失；提问/索权常驻直到处理完成；音效跟随「音频通知」开关',
      notifyHintOff: '默认开启；右下角工业风卡片通知',
      notifyNeed: '请先开启通知',
      notifyDoneRow: '任务完成通知',
      notifyDoneOn: '开启',
      notifyDoneOff: '关闭',
      notifyDoneHint: '回合结束时弹出回执卡片，6 秒后自动消失',
      notifyQuestionRow: '提问通知',
      notifyQuestionOn: '开启',
      notifyQuestionOff: '关闭',
      notifyQuestionHint: '助手提问时弹出常驻卡片，回答后自动消失',
      notifyApproveRow: '索权通知',
      notifyApproveOn: '开启',
      notifyApproveOff: '关闭',
      notifyApproveHint: '操作授权与方案审阅时弹出常驻卡片，处理完自动消失',
      thunderAnimHintReduced: '系统已开启「减少动态效果」，当前直接显示',
      /* 音频通知：播放发生在宿主进程（lib/audio.js），所以这里的每一行都在
         说明「什么时候响」而不是「怎么响」；试听按钮走宿主真实播放链路。 */
      groupAudio: '音频',
      audioRow: '音频通知',
      audioOn: '开启提示音',
      audioOff: '关闭提示音',
      audioHintOn: '由宿主进程播放，页面最小化或切到别的应用时同样能听到',
      audioHintOff: '默认关闭；开启后按下面的开关出声（也可以只留想要的几个）',
      audioBootRow: '启动加载动画音',
      audioBootOn: '开启',
      audioBootOff: '关闭',
      audioBootHint: '播放 ENDFIELD 加载板时响一次；只认真正的页面加载，点「预览」重播不会响',
      audioStartRow: '任务开始音',
      audioStartOn: '开启',
      audioStartOff: '关闭',
      audioStartHint: '只在你从会话框提交指令后播放（后台唤醒、目标续跑不计）',
      audioDoneRow: '任务结束音',
      audioDoneOn: '开启',
      audioDoneOff: '关闭',
      audioDoneHint: '只在我产出最终结果后播放；中途报错或等待审批时不出声',
      audioVolumeRow: '音量',
      audioVolumeHint: '只缩放提示音本身，不改系统音量',
      audioSlotStart: '开始',
      audioSlotDone: '结束',
      audioSlotBoot: '开机',
      audioSlotAttention: '待回应',
      audioSlotFail: '出错',
      audioSlotQuestion: '提问',
      audioSlotApproval: '审批',
      audioSlotUi: '界面',
      audioAttentionRow: '需要你回应',
      audioTurnFailRow: '出错提示音',
      audioReservedHint: '审批请求、我的提问、计划求批都会响',
      audioReservedNeed: '无事件接线：不需要人工干预的错误保持静音',
      audioSoundDirRow: '自定义音效目录',
      audioSoundDirHint: '把 turn-start.wav / turn-done.wav 放进该目录即可覆盖内置音；留空则查工作区与桌面',
      audioSoundDirDefault: '未设置（用桌面 / 工作区 / 内置音）',
      audioFileRow: '当前音源',
      audioFileBundled: '内置合成音',
      audioFileOwn: '自定义文件',
      audioFileMissing: '未找到文件',
      audioHumanOnlyRow: '开始音仅认会话框',
      audioHumanOnlyOn: '仅会话框',
      audioHumanOnlyOff: '宽松模式',
      audioHumanOnlyHintOn: '只认带提交凭据的用户消息，最不容易误触发',
      audioHumanOnlyHintOff: '任何用户来源消息都算（调试用，后台唤醒可能误响）',
      audioDiagRow: '诊断日志',
      audioDiagOn: '开启',
      audioDiagOff: '关闭',
      audioDiagHint: '在宿主控制台与 /theme-endfield/audio/state 记录每次事件判定',
      audioTest: '试听',
      audioTestPlaying: '播放中…',
      audioTestOk: '已交由宿主播放',
      audioTestFail: '宿主未播放',
      audioTestOff: '请先开启音频通知',
      audioNeedOn: '请先开启音频通知',
      audioRefresh: '刷新状态',
    }
    const LOCALE_EN = {
      nav: 'Endfield Theme',
      sep: ': ',
      /* Capitalised: these are VALUES in a "Label: Value" readout, not sentence
         fragments, and the screenshot showed lowercase reading like a typo there. */
      on: 'On',
      off: 'Off',
      groupTheme: 'THEME',
      groupBg: 'BACKGROUND',
      groupAnim: 'ANIMATION',
      groupFun: 'ENTERTAINMENT',
      groupNotify: 'NOTIFY',
      themeRow: 'Endfield theme',
      themeOn: 'Turn on',
      themeOff: 'Turn off',
      paletteRow: 'Accent palette',
      paletteGray: 'Endfield Gray',
      paletteValley: 'Valley Yellow',
      paletteWuling: 'Wuling Cyan',
      paletteHintGray: 'Official industrial gray for hover/selection (light #d9d9d9, dark #6a6a6a); default',
      paletteHintValley: 'Signal yellow #fff500 (the Endfield site accent)',
      paletteHintWuling: 'Teal-cyan accent #14d0d0 for buttons, hover and selected rows',
      radiusRow: 'Corners',
      radiusRound: 'Rounded',
      radiusSquare: 'Square',
      watermarkRow: 'Background wordmark',
      watermarkOn: 'Turn on',
      watermarkOff: 'Turn off',
      wmPersistRow: 'Keep wordmark visible',
      wmPersistOn: 'Keep visible',
      wmPersistOff: 'New session only',
      wmPersistHintOn: 'Also shown on conversations and other pages, behind the text',
      wmPersistHintOff: 'Shown only on the new-session screen',
      wmPersistNeedWm: 'Turn on the background wordmark first',
      loaderRow: 'Boot animation',
      loaderOn: 'Turn on',
      loaderOff: 'Turn off',
      loaderHintOn: 'Plays the ENDFIELD boot screen on reload (progress rail + percentage, following the palette)',
      loaderHintOff: 'Off by default; plays once on every page reload when enabled',
      loaderNeed: 'Turn on the boot animation first',
      preview: 'Preview',
      thunderRow: 'Task announcement',
      thunderOn: 'Turn on',
      thunderOff: 'Turn off',
      thunderHintOn: 'Slams 任务开始 / 任务完成 across the screen centre in heavy white type for 3s; click anywhere to dismiss',
      thunderHintOff: 'Off by default; shows 任务开始 / 任务完成 in heavy white type at the screen centre for 3s, dismissable by clicking anywhere',
      thunderNeed: 'Turn on the task announcement first',
      thunderAnimRow: 'Announcement entry animation',
      thunderAnimOn: 'Animate',
      thunderAnimOff: 'Turn off',
      thunderAnimHintOn: 'The word punches in from oversized and fades out (appears instantly when off, still held 3s)',
      thunderAnimHintOff: 'Off by default; the word appears instantly and leaves after 3s, with no scaling or fading',
      textureRow: 'Industrial texture',
      textureHint: 'The official /operator backdrop (main column only): top-fading grid, bottom hatch band, two wave layers',
      textureOff: 'Off (flat colour)',
      textureSubtle: 'Light (grid + hatch)',
      textureStandard: 'Full (official default)',
      motionRow: 'Button motion',
      motionHint: 'Six motifs, each aimed at different button roles: A Signal (official) · B Silent (minimal) · C Impact (aggressive) · D Clamp (corner brackets) · E Meter (instrument) · F Stamp (imprint)',
      motionSignal: 'A · Signal (official)',
      motionSilent: 'B · Silent (minimal)',
      motionImpact: 'C · Impact (aggressive)',
      motionClamp: 'D · Clamp (corner brackets)',
      motionMeter: 'E · Meter (instrument)',
      motionStamp: 'F · Stamp (imprint)',
      motionOff: 'Off (no animation)',
      notifyRow: 'Industrial notify',
      notifyOn: 'Turn on',
      notifyOff: 'Turn off',
      notifyHintOn: 'Task-done auto-dismisses; question/approval stay until resolved; sound follows the audio switches',
      notifyHintOff: 'On by default; industrial toast cards in the bottom-right corner',
      notifyNeed: 'Turn notifications on first',
      notifyDoneRow: 'Task done',
      notifyDoneOn: 'Turn on',
      notifyDoneOff: 'Turn off',
      notifyDoneHint: 'A receipt card on turn end; auto-dismisses after 6s',
      notifyQuestionRow: 'Question',
      notifyQuestionOn: 'Turn on',
      notifyQuestionOff: 'Turn off',
      notifyQuestionHint: 'A sticky card when the assistant asks; clears when answered',
      notifyApproveRow: 'Approval',
      notifyApproveOn: 'Turn on',
      notifyApproveOff: 'Turn off',
      notifyApproveHint: 'A sticky card for approvals and plan reviews; clears when decided',
      thunderAnimHintReduced: 'Your system asks for reduced motion, so it appears instantly',
      groupAudio: 'AUDIO',
      audioRow: 'Audio notifications',
      audioOn: 'Turn on',
      audioOff: 'Turn off',
      audioHintOn: 'Played by the host process, so a minimized page or another app in front still gets the sound',
      audioHintOff: 'Off by default; turning it on enables the slots below (keep only the ones you want)',
      audioBootRow: 'Boot animation sound',
      audioBootOn: 'Turn on',
      audioBootOff: 'Turn off',
      audioBootHint: 'Rings once when the ENDFIELD boot plate plays; a real page load only — the Preview button replays it silently',
      audioStartRow: 'Task-start sound',
      audioStartOn: 'Turn on',
      audioStartOff: 'Turn off',
      audioStartHint: 'Plays only after you submit from the composer (wakeups and goal continuations do not count)',
      audioDoneRow: 'Task-end sound',
      audioDoneOn: 'Turn on',
      audioDoneOff: 'Turn off',
      audioDoneHint: 'Plays only after the final answer; interrupted turns and approval waits stay silent',
      audioVolumeRow: 'Volume',
      audioVolumeHint: 'Rescales only the notification sound, never the system volume',
      audioSlotStart: 'Start',
      audioSlotDone: 'Done',
      audioSlotBoot: 'Boot',
      audioSlotAttention: 'Attention',
      audioSlotFail: 'Error',
      audioSlotQuestion: 'Questions',
      audioSlotApproval: 'Approvals',
      audioSlotUi: 'Seen',
      audioAttentionRow: 'Needs your response',
      audioTurnFailRow: 'Error sound',
      audioReservedHint: 'Fires on approval requests, my questions and plan reviews',
      audioReservedNeed: 'Not wired by design: an error needing no human decision stays silent',
      audioSoundDirRow: 'Custom sound directory',
      audioSoundDirHint: 'Drop turn-start.wav / turn-done.wav there to override the built-in tone; blank falls back to the workspace and the Desktop',
      audioSoundDirDefault: 'Not set (Desktop / workspace / bundled)',
      audioFileRow: 'Current source',
      audioFileBundled: 'Bundled synthesized tone',
      audioFileOwn: 'Your own file',
      audioFileMissing: 'No file found',
      audioHumanOnlyRow: 'Start sound: composer only',
      audioHumanOnlyOn: 'Composer only',
      audioHumanOnlyOff: 'Loose mode',
      audioHumanOnlyHintOn: 'Requires the submission credential a real prompt carries — least likely to misfire',
      audioHumanOnlyHintOff: 'Any user-source message counts (debugging; background wakeups may misfire)',
      audioDiagRow: 'Diagnostics',
      audioDiagOn: 'Turn on',
      audioDiagOff: 'Turn off',
      audioDiagHint: 'Logs every event verdict to the host console and /theme-endfield/audio/state',
      audioTest: 'Preview',
      audioTestPlaying: 'Playing…',
      audioTestOk: 'Handed to the host',
      audioTestFail: 'The host did not play it',
      audioTestOff: 'Turn audio notifications on first',
      audioNeedOn: 'Turn audio notifications on first',
      audioRefresh: 'Refresh state',
    }

    /* The locale service is optional, exactly like `theme` and `sessions`: the
       in-process settings tests mount this theme with a ctx carrying only
       theme/slots, and a composition without the locale plugin must still get a
       working (Chinese) settings page rather than a crash. `t` therefore falls back
       to the zh dictionary, and only the key itself as a last resort — a visible
       key beats a blank row. */
    const locale = ctx.get('locale')
    let t = (key) => (Object.prototype.hasOwnProperty.call(LOCALE_ZH, key) ? LOCALE_ZH[key] : key)
    let localeReady = false
    if (locale !== undefined && typeof locale.register === 'function' && typeof locale.bind === 'function') {
      /* Registered through ctx.effect so the dictionaries retire with the run;
         re-applying the bundle would otherwise throw on the duplicate (ns, locale)
         the service rejects by design. */
      ctx.effect(() => locale.register(ENDFIELD_NS, { zh: LOCALE_ZH, en: LOCALE_EN }))
      const bound = locale.bind(ENDFIELD_NS)
      if (typeof bound === 'function') {
        t = bound
        localeReady = true
      }
    }

    /* ---------- Settings page: 主题 (own settings.section) ---------- */
    const slots = ctx.get('slots')
    const disposeRows = []
    let disposeSettings = () => { disposeRows.forEach((d) => d()) }
    if (slots !== undefined) {
      slots.inject('settings.section', () => {
        const d = slots.register(
        /* `label` is a THUNK, not a string: the slot contract re-evaluates it per
           read, so the nav row follows a language switch with no re-registration.

           `locale` is declared ONLY when a locale service actually exists. It is not
           what drives the re-render — ui-renderer's useLocaleRevision subscribes
           EVERY outlet to the locale revision, so this panel re-renders on a language
           switch either way, and the body reads `t` from the apply closure rather than
           from the injected seat. What declaring it buys is the framework's own
           re-derivation of that seat; what it COSTS when the service is missing is a
           hard failure — ui-renderer throws SlotAssemblyError ("entry declares locale
           namespace ... but no locale face is installed") for an entry declaring a
           namespace with no installed face. Declaring it unconditionally would turn a
           composition without the locale plugin from "settings page in Chinese" into
           "settings page crashes", so the key is spread in only when present. */
        Object.assign(
          { name: 'settings.section', id: 'theme-endfield', order: 35, label: () => t('nav') },
          localeReady ? { locale: ENDFIELD_NS } : {}
        ),
        () => {
          const R = (typeof React !== 'undefined') ? React : ((typeof require === 'function') ? require('react') : null)
          if (!R) return null
          const [enabled, setEnabled] = R.useState(isEnabled())
          const [wmOn, setWmOn] = R.useState(isWatermarkOn())
          const [wmPersist, setWmPersist] = R.useState(isWatermarkPersistOn())
          const [loaderOn, setLoaderOn] = R.useState(isLoaderOn())
          const [thunderOn, setThunderOn] = R.useState(isThunderOn())
          const [thunderAnim, setThunderAnim] = R.useState(isThunderAnimOn())
          const [palette, setPalette] = R.useState(readPalette())
          const [glass, setGlass] = R.useState(readGlass())
          const [texture, setTexture] = R.useState(readTexture())
          const [mode, setMode] = R.useState(prefsGet(RADIUS_KEY) || 'square')
          const [motion, setMotion] = R.useState(readMotion())
          /* 音频通知 is a HOST feature: the browser only owns its switches and
             the preview buttons. `hostState` mirrors what the host half reports
             over /theme-endfield/audio/state (which file each slot actually
             resolved to), so the panel can show the truth instead of assuming
             the bundled tone is in use. */
          const [audioOn, setAudioOn] = R.useState(isAudioOn())
          const [audioBoot, setAudioBoot] = R.useState(isAudioBootOn())
          const [audioStart, setAudioStart] = R.useState(isAudioStartOn())
          const [audioDone, setAudioDone] = R.useState(isAudioDoneOn())
          const [audioVolume, setAudioVolume] = R.useState(readAudioVolume())
          const [audioHumanOnly, setAudioHumanOnly] = R.useState(isAudioHumanOnly())
          const [audioDiag, setAudioDiag] = R.useState(isAudioDiagOn())
          const [hostState, setHostState] = R.useState(null)
          const [previewNote, setPreviewNote] = R.useState('')
          const [notifyOn, setNotifyOn] = R.useState(isNotifyOn())
          const [notifyDone, setNotifyDone] = R.useState(isNotifyDoneOn())
          const [notifyQuestion, setNotifyQuestion] = R.useState(isNotifyQuestionOn())
          const [notifyApprove, setNotifyApprove] = R.useState(isNotifyApproveOn())
          const refreshHostState = () => {
            if (typeof fetch !== 'function') return
            fetch(AUDIO_STATE_URL, { headers: { accept: 'application/json' } })
              .then((res) => (res.ok ? res.json() : null))
              .then((json) => { if (json) setHostState(json) })
              .catch(() => { /* host bridge absent: the rows simply show no source */ })
          }
          /* Re-sync the panel onto the settings section when it finally arrives.
             Every useState above seeded itself from prefsGet() during the FIRST
             render — which, on a real page load, happens while the Host is still
             sending the section, so each read fell back to the schema default.
             Without this effect the switches stayed frozen at those defaults for
             the whole session (the theme's own surfaces recovered, because
             reconcileFromPrefs re-derives them, but the panel's React state had
             no such path): the user sees their settings "reset after refresh"
             even though the values were on disk and the theme was applying them.

             Subscribing to the store rather than using the one-shot
             onPrefsSettled hook is deliberate — that slot is already claimed by
             the boot loader, and a subscription additionally keeps the panel
             honest when the Host or another surface changes a value mid-session.
             prefsEmit runs on every transport snapshot and on every local edit, so
             this simply re-derives the same reads the initializers used; React
             bails out of the re-render when a value is unchanged.

             `useEffect` is feature-detected the way the rest of this panel
             feature-detects React: it must render on a host (or test double)
             whose React face does not expose the hook rather than throwing
             during render. Losing the effect only costs the live re-sync, which
             is no worse than the behaviour before this fix. */
          if (typeof R.useEffect === 'function') {
            panelMounted = true
            /* Re-derive every switch from the store. Kept as one named function so
               the mount pass and every later subscription event run identical
               reads — a switch can never be re-synced from a different source
               than the one the initializers used. */
            const resyncPanelFromPrefs = () => {
              setEnabled(isEnabled())
              setWmOn(isWatermarkOn())
              setWmPersist(isWatermarkPersistOn())
              setLoaderOn(isLoaderOn())
              setThunderOn(isThunderOn())
              setThunderAnim(isThunderAnimOn())
              setNotifyOn(isNotifyOn())
              setNotifyDone(isNotifyDoneOn())
              setNotifyQuestion(isNotifyQuestionOn())
              setNotifyApprove(isNotifyApproveOn())
              setPalette(readPalette())
              setGlass(readGlass())
              setMode(prefsGet(RADIUS_KEY) || 'square')
              setMotion(readMotion())
              /* The 音频 rows seed themselves from the same store, so they are
                 re-derived here as well — the section can arrive after the
                 panel's first render, which would otherwise leave every audio
                 switch frozen at its schema default for the whole session. */
              setAudioOn(isAudioOn())
              setAudioBoot(isAudioBootOn())
              setAudioStart(isAudioStartOn())
              setAudioDone(isAudioDoneOn())
              setAudioVolume(readAudioVolume())
              setAudioHumanOnly(isAudioHumanOnly())
              setAudioDiag(isAudioDiagOn())
            }
            R.useEffect(() => {
              /* Subscribe FIRST, then re-derive once. A subscription alone is not
                 enough: the panel can finish mounting AFTER the section already
                 settled, in which case the ready transition that would have
                 notified it has already been emitted and no later event is
                 guaranteed (the mirror only re-reads on a Host document change or
                 a reconnect). Running the pass here makes the panel's state
                 converge whenever it mounts, with no dependence on
                 having been present for the transition. */
              const unsubscribe = prefsSubscribe(resyncPanelFromPrefs)
              resyncPanelFromPrefs()
              return unsubscribe
            }, [])
            // One read per panel mount: the host is the only authority on which
            // file each slot resolved to, and re-reading on every render would
            // hammer the route while the user drags the volume slider. Guarded
            // with the effect above, because the in-process settings tests drive
            // this panel with a minimal recording React that has no effect hook
            // at all — an unguarded call would turn "cannot refresh the source
            // read-out" into "the whole panel throws".
            R.useEffect(() => { refreshHostState() }, [])
          }
          const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--dsw-alias-border-l1)' }
          const labelStyle = { color: 'var(--dsw-alias-label-primary)', fontSize: '13px', fontWeight: 500, lineHeight: '1.5' }
          // Sub-label explaining what a switch does, so the row is self-describing.
          const hintStyle = { display: 'block', color: 'var(--dsw-alias-label-tertiary)', fontSize: '12px', fontWeight: 400, lineHeight: '1.5', marginTop: '2px' }
          const btnStyleFor = (on, disabled) => {
            /* The switches are themed BY the theme they configure, so while the
               theme is ON the "on" fill reads from the palette variable rather
               than a literal — an inline #fff500 here would keep every enabled
               button yellow while the rest of the UI turned cyan.

               But --edge-accent / --edge-btn-muted live in the theme's own
               stylesheet, which unmount() removes when the theme is switched
               OFF. The hardcoded ink (#000) would then sit on a transparent
               button — invisible in dark mode, where the app panel is dark.
               So when the theme is OFF these buttons fall back to app-native
               tokens (filled chip for "on", outline for "off"), which are the
               same surfaces the rest of the settings page uses. */
            const themed = enabled
            return {
              color: !themed ? 'var(--dsw-alias-label-primary)' : (on ? '#000' : 'var(--dsw-alias-label-primary)'),
              background: !themed
                ? (on ? 'var(--dsw-alias-interactive-bg-hover-solid)' : 'transparent')
                : (on ? 'var(--edge-accent)' : 'var(--edge-btn-muted)'),
              border: '1px solid var(--dsw-alias-border-l2)',
              borderRadius: mode === 'round' ? '999px' : '0',
              padding: '4px 14px',
              fontSize: '12px',
              // A disabled control has to look disabled, not merely ignore clicks.
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.45 : 1,
              whiteSpace: 'nowrap',
            }
          }
          const setGlassValue = (value) => {
            if (!GLASS_OPTIONS.includes(value)) return
            prefsSet(GLASS_KEY, value)
            setGlass(value)
            syncGlass()
          }
          const setTextureValue = (value) => {
            if (!TEXTURE_OPTIONS.includes(value)) return
            prefsSet(TEXTURE_KEY, value)
            setTexture(value)
            syncTexture()
          }
          /* ---------- toggles ----------
             EVERY handler below derives its `next` value from the STORE
             (prefsGet / the is* / read* readers), never from the React state
             variable of the same name. Those two can disagree, and when they do
             the toggle writes the WRONG value to the durable section:

               - the initial useState(readPalette()) runs while the Host section
                 is still 'loading', so it seeds the schema DEFAULT;
               - the mount effect re-derives it, but that pass and any later
                 subscription pass only run on a store event, so a panel that
                 mounted mid-transition can still be showing a default;
               - prefsGetValue overlays prefsLocalEdited on top of the fetched
                 section, so the store and the rendered switch are two different
                 reads by construction.

             Reading the store here makes the click a decision about the CURRENT
             durable value rather than about whatever the last render happened to
             capture, so a stale panel can no longer persist a default over a
             real choice. The state setter still runs, so the UI follows. */
          const toggleTheme = () => {
            const next = !isEnabled()
            prefsSet(ENABLED_KEY, next ? '1' : '0')
            setEnabled(next)
            if (next) { mount(); syncWatermarkVisibility() }
            else { unmount(); syncWatermarkVisibility() }
            /* The announcement watcher is gated on the master switch too, so it has
               to be reconciled here. unmount() already stops it, but turning the
               theme back ON must restart it — otherwise the feature would stay dead
               until the next page load. */
            syncThunder()
          }
          /* Palette selection via <select>. Everything visual is carried by the
             class flip inside syncPaletteClass(); a select fires onChange with
             the chosen value, so no cycle order is needed. */
          const setPaletteValue = (value) => {
            if (value !== 'gray' && value !== 'valley' && value !== 'wuling') return
            if (value === readPalette()) return
            prefsSet(PALETTE_KEY, value)
            setPalette(value)
            syncPaletteClass()
          }
          const toggleWm = () => {
            const next = !isWatermarkOn()
            prefsSet(WATERMARK_KEY, next ? '1' : '0')
            setWmOn(next)
            syncWatermarkVisibility()
          }
          /* Persist as a select (was a two-value cycle button): same pattern. */
          const setWmPersistValue = (value) => {
            const next = value === '1'
            if (next === isWatermarkPersistOn()) return
            prefsSet(WATERMARK_PERSIST_KEY, next ? '1' : '0')
            setWmPersist(next)
            syncWatermarkVisibility()
          }
          const toggleWmPersist = () => {
            const next = !isWatermarkPersistOn()
            prefsSet(WATERMARK_PERSIST_KEY, next ? '1' : '0')
            setWmPersist(next)
            syncWatermarkVisibility()
          }
          /* Notifications. The master re-arms both watchers (the attention poll
             and the shared turn-edge subscription) so a switch flip is live
             without a reload; the sub-switches only gate rendering, which
             showNotify checks per fire. */
          const toggleNotify = () => {
            const next = !isNotifyOn()
            prefsSet(NOTIFY_KEY, next ? '1' : '0')
            setNotifyOn(next)
            syncAudioAttentionWatch()
            syncThunder()
            if (!next) destroyNotify()
          }
          const toggleNotifyDone = () => {
            const next = !isNotifyDoneOn()
            prefsSet(NOTIFY_DONE_KEY, next ? '1' : '0')
            setNotifyDone(next)
            syncThunder()
          }
          const toggleNotifyQuestion = () => {
            const next = !isNotifyQuestionOn()
            prefsSet(NOTIFY_QUESTION_KEY, next ? '1' : '0')
            setNotifyQuestion(next)
            syncAudioAttentionWatch()
          }
          const toggleNotifyApprove = () => {
            const next = !isNotifyApproveOn()
            prefsSet(NOTIFY_APPROVE_KEY, next ? '1' : '0')
            setNotifyApprove(next)
            syncAudioAttentionWatch()
          }
          const toggleLoader = () => {
            const next = !isLoaderOn()
            prefsSet(LOADER_KEY, next ? '1' : '0')
            setLoaderOn(next)
            // Turning it on plays it once right away, so the switch shows what it
            // bought instead of making the user reload to find out.
            if (next) { loaderDone = false; destroyLoader(); runLoader() }
            else destroyLoader()
          }
          const replayLoader = () => {
            loaderDone = false
            destroyLoader()
            runLoader()
          }
          const toggleThunder = () => {
            const next = !isThunderOn()
            prefsSet(THUNDER_KEY, next ? '1' : '0')
            setThunderOn(next)
            /* syncThunder() reads the pref store, so the write above is what it acts
               on. Turning it ON also shows the word once: a switch whose effect only
               appears at some unpredictable later moment gives the user no way to
               tell whether it worked. The preview runs BEFORE the watcher attaches,
               so it cannot be mistaken for a real edge. */
            if (next) showThunder(THUNDER_START)
            else destroyThunder()
            syncThunder()
          }
          const previewThunder = () => { showThunder(THUNDER_DONE) }
          const toggleThunderAnim = () => {
            const next = !isThunderAnimOn()
            prefsSet(THUNDER_ANIM_KEY, next ? '1' : '0')
            setThunderAnim(next)
            /* Nothing to reconcile: the next showThunder() reads the switch and marks
               the plate accordingly. Replaying now is what makes the change legible —
               the difference between the two modes is only visible during the entry,
               so a silent toggle would look like it did nothing. */
            showThunder(THUNDER_START)
          }
          /* Radius as a select (was a cycle button): the same shape as the
             palette row — the current value preselects, onChange writes through. */
          const setRadiusValue = (value) => {
            if (value !== 'square' && value !== 'round') return
            if (value === (prefsGet(RADIUS_KEY) || 'square')) return
            prefsSet(RADIUS_KEY, value)
            setMode(value)
            if (value === 'round') document.body.classList.add('theme-endfield-round')
            else document.body.classList.remove('theme-endfield-round')
          }
          const toggleMode = () => {
            const next = (prefsGet(RADIUS_KEY) || 'square') === 'round' ? 'square' : 'round'
            prefsSet(RADIUS_KEY, next)
            setMode(next)
            if (next === 'round') document.body.classList.add('theme-endfield-round')
            else document.body.classList.remove('theme-endfield-round')
          }
          /* ---------- 音频通知 handlers ----------
             A switch writes its field and updates local state; the host half
             watches the same namespace, so the next event uses the new value
             without a reload. The preview buttons deliberately do NOT play
             anything in the browser: they ask the host, so what you hear while
             testing is exactly what a real notification will sound like. */
          const showPreviewNote = (result) => {
            if (result && result.played) setPreviewNote(t('audioTestOk'))
            else setPreviewNote(t('audioTestFail') + (result && result.why ? '：' + result.why : ''))
          }
          const playPreview = (slot) => { previewSlot(slot).then(showPreviewNote) }
          const audioTestButton = (slot, labelKey) => R.createElement('button', {
            key: 'audio-test-' + slot,
            type: 'button',
            onClick: () => playPreview(slot),
            style: btnStyleFor(false, !audioOn),
            // Previewing while the master switch is off is refused by the host
            // (volume 0 / disabled), so the button says why instead of failing
            // silently.
            disabled: !audioOn,
            title: audioOn ? '' : t('audioNeedOn'),
          }, t('audioTest') + ' · ' + t(labelKey))
          const toggleAudio = () => {
            const next = !audioOn
            prefsSet(AUDIO_ENABLED_KEY, next ? '1' : '0')
            setAudioOn(next)
            // The attention watcher is gated on this switch, so it has to be
            // reconciled here as well as on the pref echo.
            syncAudioAttentionWatch()
            if (next) playPreview('turn-done')
          }
          const toggleAudioStart = () => {
            const next = !audioStart
            prefsSet(AUDIO_TURN_START_KEY, next ? '1' : '0')
            setAudioStart(next)
            if (next) playPreview('turn-start')
          }
          const toggleAudioBoot = () => {
            const next = !audioBoot
            prefsSet(AUDIO_BOOT_KEY, next ? '1' : '0')
            setAudioBoot(next)
            // Preview the boot slot itself: the real one fires from the loader,
            // which is awkward to re-trigger from here.
            if (next) playPreview('boot')
          }
          const toggleAudioDone = () => {
            const next = !audioDone
            prefsSet(AUDIO_TURN_DONE_KEY, next ? '1' : '0')
            setAudioDone(next)
            if (next) playPreview('turn-done')
          }
          const setAudioVolumeValue = (next) => {
            const clamped = Math.min(100, Math.max(0, Math.round(next)))
            prefsSet(AUDIO_VOLUME_KEY, String(clamped))
            setAudioVolume(clamped)
          }
          const toggleAudioHumanOnly = () => {
            const next = !audioHumanOnly
            prefsSet(AUDIO_HUMAN_ONLY_KEY, next ? '1' : '0')
            setAudioHumanOnly(next)
          }
          const toggleAudioDiag = () => {
            const next = !audioDiag
            prefsSet(AUDIO_DIAG_KEY, next ? '1' : '0')
            setAudioDiag(next)
          }
          const applySoundDir = (value) => {
            const text = typeof value === 'string' ? value.trim() : ''
            prefsSet(AUDIO_SOUND_DIR_KEY, text)
            refreshHostState()
          }
          /** The host's view of one slot, or undefined while it has not answered. */
          const slotState = (slot) => {
            if (hostState === null || !Array.isArray(hostState.slots)) return undefined
            return hostState.slots.find((entry) => entry.id === slot)
          }
          // The two reserved rows have no switch, so their value read-out reports
          // whether the SOUND is previewable instead of pretending to be a toggle.
          const audioTestReady = () => (hostState === null ? true : slotState('attention') !== undefined)
          const sourceSummary = () => {
            const done = slotState('turn-done')
            if (done === undefined) return '—'
            if (done.file === null) return t('audioFileMissing')
            return done.bundled ? t('audioFileBundled') : t('audioFileOwn')
          }
          const sourceDetail = () => {
            const rows = []
            for (const slot of ['boot', 'turn-start', 'turn-done']) {
              const state = slotState(slot)
              const name = slot === 'boot' ? t('audioSlotBoot') : slot === 'turn-start' ? t('audioSlotStart') : t('audioSlotDone')
              rows.push(name + t('sep') + (state === undefined || state.file === null ? t('audioFileMissing') : state.file))
            }
            /* How many intervention requests this host half has actually seen.
               Without it, "no sound" cannot distinguish "the event never reached
               the plugin" from "the plugin chose to stay silent" — the two are
               indistinguishable from the page. Re-open this page (or press 刷新)
               after answering a question to watch the counter move. */
            if (hostState !== null && hostState.attention !== undefined) {
              rows.push(t('audioAttentionRow') + t('sep')
                + t('audioSlotUi') + ' ' + String(hostState.attention.ui)
                + ' / ' + t('audioSlotQuestion') + ' ' + String(hostState.attention.question)
                + ' / ' + t('audioSlotApproval') + ' ' + String(hostState.attention.approval))
            }
            if (hostState !== null && Array.isArray(hostState.log) && hostState.log.length > 0) {
              const last = hostState.log[hostState.log.length - 1]
              rows.push(t('audioDiagRow') + t('sep') + last.kind + (last.detail ? ' ' + last.detail : ''))
            }
            return rows.join('　·　')
          }
          const pageStyle = { maxWidth: '640px', padding: '4px 0 16px' }
          /* The ten switches are grouped into four concerns so the page can be
             scanned instead of read as a flat list: 主题 (master switch +
             appearance), 背景 (watermark), 动画 (boot loader),
             娱乐 (雷霆大字 announcements + their entry animation).
             Each group is an editorial numbered header; rows keep their stable
             React keys. The last row of each group drops its divider so the next
             group header's own rule is the only line between groups.

             The header shows the group name in the ACTIVE language plus a latin
             all-caps line. Under English both would collapse to the same word, so
             the second line is dropped there rather than printed twice — the latin
             line is editorial styling for the Chinese name, not a translation. */
          const groupTitle = (no, key, first) => {
            const name = t(key)
            const latin = LOCALE_EN[key]
            const parts = [
              R.createElement('span', { key: 'mark', 'aria-hidden': 'true', style: { width: '4px', height: '14px', flex: '0 0 auto', background: 'currentColor' } }),
              R.createElement('span', { key: 'cn', style: { fontSize: '12px', fontWeight: 600, letterSpacing: '0.14em', lineHeight: '1.5' } }, no + ' ' + name),
            ]
            if (latin !== undefined && latin !== name) {
              parts.push(R.createElement('span', { key: 'en', style: { fontSize: '10px', fontWeight: 500, letterSpacing: '0.2em', opacity: 0.72, lineHeight: '1.5' } }, latin))
            }
            return R.createElement('div', {
              key: 'group-title-' + no,
              className: 'endfield-settings-group-title',
              style: {
                display: 'flex', alignItems: 'center', gap: '8px',
                marginTop: first ? '0' : '26px', paddingBottom: '8px',
                borderBottom: '1px solid var(--dsw-alias-border-l1)',
              },
            }, parts)
          }
          /** "<row label>: <on|off>" — one spelling for every status row. */
          const stateOf = (on) => t(on ? 'on' : 'off')
          const row = (key, last, children) => R.createElement('div', { key, style: last ? { ...rowStyle, borderBottom: 'none' } : rowStyle }, children)
          return R.createElement('div', { className: 'endfield-settings', style: pageStyle }, [
            /* --- 01 主题：总开关在最前，随后是配色与圆角 --- */
            R.createElement('div', { key: 'group-theme' }, [
              groupTitle('01', 'groupTheme', true),
              row('theme', false, [
                R.createElement('span', { style: labelStyle }, t('themeRow') + t('sep') + stateOf(enabled)),
                R.createElement('button', { type: 'button', onClick: toggleTheme, style: btnStyleFor(enabled) }, t(enabled ? 'themeOff' : 'themeOn'))
              ]),
              row('palette', false, [
                R.createElement('span', { style: labelStyle },
                  t('paletteRow'),
                  R.createElement('span', { style: hintStyle },
                    t('paletteHint' + (palette === 'gray' ? 'Gray' : palette === 'wuling' ? 'Wuling' : 'Valley'))
                  )
                ),
                /* A select mirrors the glass row's pattern: the current value
                   preselects, onChange writes through the store-derived handler. */
                R.createElement('select', {
                  'aria-label': t('paletteRow'), value: palette,
                  onChange: (event) => setPaletteValue(event.target.value),
                  style: { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)',
                    border: '1px solid var(--dsw-alias-border-l2)', padding: '6px 10px' },
                }, ['gray', 'valley', 'wuling'].map((value) => R.createElement('option', { key: value, value },
                  t(value === 'gray' ? 'paletteGray' : value === 'valley' ? 'paletteValley' : 'paletteWuling')
                )))
              ]),
              row('motion', false, [
                R.createElement('span', { style: labelStyle }, t('motionRow'),
                  R.createElement('span', { style: hintStyle }, t('motionHint'))),
                R.createElement('select', {
                  'aria-label': t('motionRow'), value: motion,
                  onChange: (event) => {
                    const v = event.target.value
                    if (!MOTION_OPTIONS.includes(v)) return
                    prefsSet(MOTION_KEY, v)
                    setMotion(v)
                    syncMotion()
                  },
                  style: { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)',
                    border: '1px solid var(--dsw-alias-border-l2)', padding: '6px 10px' },
                }, MOTION_OPTIONS.map((v) => R.createElement('option', { key: v, value: v },
                  t(MOTION_LABEL_KEYS[v] || 'motionOff')
                )))
              ]),
              row('glass', false, [
                R.createElement('span', { style: labelStyle }, t('glassRow'),
                  R.createElement('span', { style: hintStyle }, t('glassHint'))),
                R.createElement('select', {
                  'aria-label': t('glassRow'), value: glass,
                  onChange: (event) => setGlassValue(event.target.value),
                  style: { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)',
                    border: '1px solid var(--dsw-alias-border-l2)', padding: '6px 10px' },
                }, GLASS_OPTIONS.map((value) => R.createElement('option', { key: value, value },
                  t({ off: 'glassOff', subtle: 'glassSubtle', standard: 'glassStandard', strong: 'glassStrong' }[value]))))
              ]),
              row('texture', false, [
                R.createElement('span', { style: labelStyle }, t('textureRow'),
                  R.createElement('span', { style: hintStyle }, t('textureHint'))),
                R.createElement('select', {
                  'aria-label': t('textureRow'), value: texture,
                  onChange: (event) => setTextureValue(event.target.value),
                  style: { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)',
                    border: '1px solid var(--dsw-alias-border-l2)', padding: '6px 10px' },
                }, TEXTURE_OPTIONS.map((value) => R.createElement('option', { key: value, value },
                  t(value === 'off' ? 'textureOff' : value === 'subtle' ? 'textureSubtle' : 'textureStandard'))))
              ]),
              row('radius', true, [
                R.createElement('span', { style: labelStyle }, t('radiusRow')),
                R.createElement('select', {
                  'aria-label': t('radiusRow'), value: mode,
                  onChange: (event) => setRadiusValue(event.target.value),
                  style: { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)',
                    border: '1px solid var(--dsw-alias-border-l2)', padding: '6px 10px' },
                }, ['square', 'round'].map((value) => R.createElement('option', { key: value, value },
                  t(value === 'square' ? 'radiusSquare' : 'radiusRound'))))
              ]),
            ]),
            /* --- 02 背景：水印，主开关在前、附属开关在后 --- */
            R.createElement('div', { key: 'group-bg' }, [
              groupTitle('02', 'groupBg', false),
              row('watermark', false, [
                R.createElement('span', { style: labelStyle }, t('watermarkRow') + t('sep') + stateOf(wmOn)),
                R.createElement('button', { type: 'button', onClick: toggleWm, style: btnStyleFor(wmOn) }, t(wmOn ? 'watermarkOff' : 'watermarkOn'))
              ]),
              row('watermark-persist', true, [
                R.createElement('span', { style: labelStyle },
                  t('wmPersistRow'),
                  R.createElement('span', { style: hintStyle },
                    t(wmPersist ? 'wmPersistHintOn' : 'wmPersistHintOff')
                  )
                ),
                R.createElement('select', {
                  'aria-label': t('wmPersistRow'), value: wmPersist ? '1' : '0',
                  onChange: (event) => setWmPersistValue(event.target.value),
                  // The choice only has meaning while the watermark itself is on.
                  disabled: !wmOn,
                  title: wmOn ? '' : t('wmPersistNeedWm'),
                  style: { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)',
                    border: '1px solid var(--dsw-alias-border-l2)', padding: '6px 10px' },
                }, [['0', 'wmPersistOff'], ['1', 'wmPersistOn']].map(([value, key]) =>
                  R.createElement('option', { key, value }, t(key))))
              ]),
            ]),
            /* --- 03 动画：启动加载动画 --- */
            R.createElement('div', { key: 'group-anim' }, [
              groupTitle('03', 'groupAnim', false),
              row('loader', true, [
                R.createElement('span', { style: labelStyle },
                  t('loaderRow') + t('sep') + stateOf(loaderOn),
                  R.createElement('span', { style: hintStyle },
                    t(loaderOn ? 'loaderHintOn' : 'loaderHintOff')
                  )
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  // Replay only makes sense while the feature is on; it lets the user
                  // re-watch the animation without reloading the page.
                  R.createElement('button', {
                    type: 'button',
                    onClick: replayLoader,
                    // The master switch gates this too: the plate is styled by the
                    // stylesheet the master switch removes, so previewing while the
                    // theme is off has nothing to show (runLoader refuses as well).
                    style: btnStyleFor(false, !loaderOn || !enabled),
                    disabled: !loaderOn || !enabled,
                    title: loaderOn ? '' : t('loaderNeed'),
                  }, t('preview')),
                  R.createElement('button', { type: 'button', onClick: toggleLoader, style: btnStyleFor(loaderOn) }, t(loaderOn ? 'loaderOff' : 'loaderOn'))
                )
              ]),
            ]),
            /* --- 04 娱乐：雷霆大字（主开关 + 入场动画子开关） --- */
            R.createElement('div', { key: 'group-fun' }, [
              groupTitle('04', 'groupFun', false),
              row('thunder', false, [
                R.createElement('span', { style: labelStyle },
                  t('thunderRow') + t('sep') + stateOf(thunderOn),
                  R.createElement('span', { style: hintStyle },
                    t(thunderOn ? 'thunderHintOn' : 'thunderHintOff')
                  )
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  // Same affordance as the boot animation: let the user see the
                  // effect now instead of waiting for the next task boundary.
                  R.createElement('button', {
                    type: 'button',
                    onClick: previewThunder,
                    style: btnStyleFor(false, !thunderOn),
                    disabled: !thunderOn,
                    title: thunderOn ? '' : t('thunderNeed'),
                  }, t('preview')),
                  R.createElement('button', { type: 'button', onClick: toggleThunder, style: btnStyleFor(thunderOn) }, t(thunderOn ? 'thunderOff' : 'thunderOn'))
                )
              ]),
              row('thunder-anim', true, [
                R.createElement('span', { style: labelStyle },
                  t('thunderAnimRow') + t('sep') + stateOf(thunderAnim),
                  R.createElement('span', { style: hintStyle },
                    // Say so when the OS preference is overriding the switch, rather
                    // than letting it look like the toggle is broken.
                    (thunderAnim && prefersReducedMotion())
                      ? t('thunderAnimHintReduced')
                      : t(thunderAnim ? 'thunderAnimHintOn' : 'thunderAnimHintOff')
                  )
                ),
                R.createElement('button', {
                  type: 'button',
                  onClick: toggleThunderAnim,
                  style: btnStyleFor(thunderAnim, !thunderOn),
                  // Only meaningful while the announcement itself is on.
                  disabled: !thunderOn,
                  title: thunderOn ? '' : t('thunderNeed'),
                }, t(thunderAnim ? 'thunderAnimOff' : 'thunderAnimOn'))
              ]),
            ]),
            /* --- 05 通知：工业风卡片，三触发 --- */
            R.createElement('div', { key: 'group-notify' }, [
              groupTitle('05', 'groupNotify', false),
              row('notify', false, [
                R.createElement('span', { style: labelStyle },
                  t('notifyRow') + t('sep') + stateOf(notifyOn),
                  R.createElement('span', { style: hintStyle },
                    t(notifyOn ? 'notifyHintOn' : 'notifyHintOff')
                  )
                ),
                R.createElement('button', { type: 'button', onClick: toggleNotify, style: btnStyleFor(notifyOn) },
                  t(notifyOn ? 'notifyOff' : 'notifyOn'))
              ]),
              row('notify-done', false, [
                R.createElement('span', { style: labelStyle },
                  t('notifyDoneRow') + t('sep') + stateOf(notifyDone),
                  R.createElement('span', { style: hintStyle }, t('notifyDoneHint'))
                ),
                R.createElement('button', {
                  type: 'button', onClick: toggleNotifyDone,
                  style: btnStyleFor(notifyDone, !notifyOn), disabled: !notifyOn,
                  title: notifyOn ? '' : t('notifyNeed'),
                }, t(notifyDone ? 'notifyDoneOff' : 'notifyDoneOn'))
              ]),
              row('notify-question', false, [
                R.createElement('span', { style: labelStyle },
                  t('notifyQuestionRow') + t('sep') + stateOf(notifyQuestion),
                  R.createElement('span', { style: hintStyle }, t('notifyQuestionHint'))
                ),
                R.createElement('button', {
                  type: 'button', onClick: toggleNotifyQuestion,
                  style: btnStyleFor(notifyQuestion, !notifyOn), disabled: !notifyOn,
                  title: notifyOn ? '' : t('notifyNeed'),
                }, t(notifyQuestion ? 'notifyQuestionOff' : 'notifyQuestionOn'))
              ]),
              row('notify-approve', true, [
                R.createElement('span', { style: labelStyle },
                  t('notifyApproveRow') + t('sep') + stateOf(notifyApprove),
                  R.createElement('span', { style: hintStyle }, t('notifyApproveHint'))
                ),
                R.createElement('button', {
                  type: 'button', onClick: toggleNotifyApprove,
                  style: btnStyleFor(notifyApprove, !notifyOn), disabled: !notifyOn,
                  title: notifyOn ? '' : t('notifyNeed'),
                }, t(notifyApprove ? 'notifyApproveOff' : 'notifyApproveOn'))
              ]),
            ]),
            /* --- 06 音频：两个生效槽位 + 两个预留槽位 ---
               Every row states WHEN it fires, because that is the whole contract
               of this feature; the two reserved rows say outright that they will
               not fire yet, so a switch that does nothing cannot read as broken. */
            R.createElement('div', { key: 'group-audio' }, [
              groupTitle('06', 'groupAudio', false),
              row('audio', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioRow') + t('sep') + stateOf(audioOn),
                  R.createElement('span', { style: hintStyle },
                    t(audioOn ? 'audioHintOn' : 'audioHintOff')
                  )
                ),
                R.createElement('button', { type: 'button', onClick: toggleAudio, style: btnStyleFor(audioOn) }, t(audioOn ? 'audioOff' : 'audioOn'))
              ]),
              /* The boot row pairs two independent switches stacked on the right:
                 the sound's own on/off, and the loader's preview button. They are
                 separate switches because the loader can be on with no sound. */
              row('audio-boot', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioBootRow') + t('sep') + stateOf(audioBoot),
                  R.createElement('span', { style: hintStyle }, t('audioBootHint'))
                ),
                R.createElement('span', { style: { display: 'flex', flexDirection: 'column', gap: '6px', flex: '0 0 auto', alignItems: 'stretch' } },
                  R.createElement('button', {
                    type: 'button', onClick: replayLoader,
                    style: btnStyleFor(false, !loaderOn || !enabled),
                    disabled: !loaderOn || !enabled,
                    title: loaderOn ? '' : t('loaderNeed'),
                  }, t('preview') + ' · ' + t('loaderRow')),
                  R.createElement('button', {
                    type: 'button', onClick: toggleAudioBoot,
                    style: btnStyleFor(audioBoot, !audioOn), disabled: !audioOn,
                    title: audioOn ? '' : t('audioNeedOn'),
                  }, t(audioBoot ? 'audioBootOff' : 'audioBootOn'))
                )
              ]),
              row('audio-start', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioStartRow') + t('sep') + stateOf(audioStart),
                  R.createElement('span', { style: hintStyle }, t('audioStartHint'))
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  audioTestButton('turn-start', 'audioSlotStart'),
                  R.createElement('button', {
                    type: 'button', onClick: toggleAudioStart,
                    style: btnStyleFor(audioStart, !audioOn), disabled: !audioOn,
                    title: audioOn ? '' : t('audioNeedOn'),
                  }, t(audioStart ? 'audioStartOff' : 'audioStartOn'))
                )
              ]),
              row('audio-done', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioDoneRow') + t('sep') + stateOf(audioDone),
                  R.createElement('span', { style: hintStyle }, t('audioDoneHint'))
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  audioTestButton('turn-done', 'audioSlotDone'),
                  R.createElement('button', {
                    type: 'button', onClick: toggleAudioDone,
                    style: btnStyleFor(audioDone, !audioOn), disabled: !audioOn,
                    title: audioOn ? '' : t('audioNeedOn'),
                  }, t(audioDone ? 'audioDoneOff' : 'audioDoneOn'))
                )
              ]),
              row('audio-volume', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioVolumeRow') + t('sep') + String(audioVolume) + '%',
                  R.createElement('span', { style: hintStyle }, t('audioVolumeHint'))
                ),
                R.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' } },
                  R.createElement('input', {
                    type: 'range', min: 0, max: 100, step: 5,
                    'aria-label': t('audioVolumeRow'),
                    value: audioVolume,
                    disabled: !audioOn,
                    onChange: (event) => setAudioVolumeValue(Number(event.target.value)),
                    onMouseUp: () => { previewSlot('turn-done').then(showPreviewNote) },
                    style: { width: '140px', accentColor: enabled ? 'var(--edge-accent)' : undefined },
                  }),
                  R.createElement('span', { style: { ...labelStyle, minWidth: '38px', textAlign: 'right' } }, String(audioVolume) + '%')
                )
              ]),
              row('audio-attention', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioAttentionRow') + t('sep') + stateOf(audioTestReady()),
                  R.createElement('span', { style: hintStyle }, t('audioReservedHint'))
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  audioTestButton('attention', 'audioSlotAttention')
                )
              ]),
              row('audio-fail', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioTurnFailRow') + t('sep') + stateOf(audioTestReady()),
                  R.createElement('span', { style: hintStyle }, t('audioReservedHint'))
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  audioTestButton('turn-fail', 'audioSlotFail')
                )
              ]),
              row('audio-source', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioFileRow') + t('sep') + sourceSummary(),
                  R.createElement('span', { style: hintStyle, wordBreak: 'break-all' }, sourceDetail())
                ),
                R.createElement('button', {
                  type: 'button', onClick: () => { setPreviewNote(''); refreshHostState() },
                  style: btnStyleFor(false),
                }, t('audioRefresh'))
              ]),
              row('audio-dir', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioSoundDirRow') + t('sep') + (readAudioSoundDir() || t('audioSoundDirDefault')),
                  R.createElement('span', { style: hintStyle }, t('audioSoundDirHint'))
                ),
                R.createElement('span', { style: { display: 'flex', gap: '8px', flex: '0 0 auto' } },
                  R.createElement('input', {
                    type: 'text',
                    'aria-label': t('audioSoundDirRow'),
                    defaultValue: readAudioSoundDir(),
                    placeholder: t('audioSoundDirDefault'),
                    onKeyDown: (event) => { if (event.key === 'Enter') applySoundDir(event.target.value) },
                    onBlur: (event) => applySoundDir(event.target.value),
                    style: { width: '200px', color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l2)', padding: '6px 8px', fontSize: '12px' },
                  })
                )
              ]),
              row('audio-human', false, [
                R.createElement('span', { style: labelStyle },
                  t('audioHumanOnlyRow') + t('sep') + t(audioHumanOnly ? 'audioHumanOnlyOn' : 'audioHumanOnlyOff'),
                  R.createElement('span', { style: hintStyle },
                    t(audioHumanOnly ? 'audioHumanOnlyHintOn' : 'audioHumanOnlyHintOff')
                  )
                ),
                R.createElement('button', {
                  type: 'button', onClick: toggleAudioHumanOnly,
                  style: btnStyleFor(audioHumanOnly, !audioOn), disabled: !audioOn,
                  title: audioOn ? '' : t('audioNeedOn'),
                }, t(audioHumanOnly ? 'audioHumanOnlyOff' : 'audioHumanOnlyOn'))
              ]),
              row('audio-diag', true, [
                R.createElement('span', { style: labelStyle },
                  t('audioDiagRow') + t('sep') + stateOf(audioDiag),
                  R.createElement('span', { style: hintStyle },
                    previewNote !== '' ? previewNote : t('audioDiagHint')
                  )
                ),
                R.createElement('button', { type: 'button', onClick: toggleAudioDiag, style: btnStyleFor(audioDiag) }, t(audioDiag ? 'audioDiagOff' : 'audioDiagOn'))
              ]),
            ]),
          ])
        }
      )
      disposeRows.push(d)
      return d
    })
    }

    ctx.effect(() => () => {
      unmount()
      // Release the idempotency flag so a re-apply after this dispose can mount
      // the theme again; leaving it set killed the theme until a hard reload.
      if (typeof window !== 'undefined') window.__dshThemeEndfieldApplied = false
      if (watermarkObserver) watermarkObserver.disconnect()
      /* A deferred observer install may still be waiting on DOMContentLoaded when
         the run ends; drop the pending listener so a disposed run is not wired
         back into the page. removeEventListener is a no-op when it never fired
         or already ran ({ once }), so both branches are safe. */
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('DOMContentLoaded', watermarkObserverLate)
      }
      if (watermarkRaf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(watermarkRaf)
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') window.removeEventListener('resize', onWatermarkResize)
      if (watermarkEl && watermarkEl.parentNode) watermarkEl.parentNode.removeChild(watermarkEl)
      // The plate owns a rAF handle and a fixed DOM node; both must go with the run.
      destroyLoader()
            /* The announcement feature owns two store subscriptions, a retry timeout and
         a hide timeout, all of which outlive the DOM node — unmount() covers the
         switched-off path, but a fiber unload while the theme is ON must release
         them here too, or the callbacks keep firing against a dead run. */
      thunderStopWatch()
      destroyThunder()
      // The notification stack owns DOM nodes and dismissal timers; both go here.
      destroyNotify()
      // Same reason as the announcement watcher: a poll that outlives its fiber
      // keeps POSTing against a dead run.
      stopAudioAttentionWatch()
      disposeSettings()
    })
  }

		exports.name = "dsh-theme-endfield";
		exports.inject = ["theme"];
		exports.apply = apply;
		/* The attention markers are attached by apply() itself (they are declared in
		   its scope) and read by test/audio-attention-watch.test.js, which asserts
		   they stay semantic: a hashed module class would rot on an upstream rebuild
		   and the watcher would just stop matching, with no error anywhere. */
		return module.exports;
	}
});
