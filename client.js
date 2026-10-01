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
           · 悬停圆角软化 0 → 4px（仅直角模式）
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

         色彩取值：信号色边条/角标/读数条一律走 --edge-accent-onpaper——它是各
         调色板的「深/亮一档」版本，压在纸底、面板底**或强调色实心底**上都读得出来。
         反例（曾经的 bug）：读数条一开始用 --edge-accent，而主 CTA 自己的底就是
         --edge-accent，同色叠同色 1.00–1.28:1，条子完全看不见。D–F 没有引入新色值，
         但「onpaper 已被对比度测试覆盖」这句话不成立——见 test/perf-motion.test.js
         末尾的调色板断言（palette-contrast 覆盖的是别的角色）。

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

      /* A-1. 悬停圆角软化（仅直角模式）。
         官网上 border-radius 是被过渡的属性之一（transition: color/background-color/
         border-radius .2s），但**本主题给不了这个过渡**：应用自己有一条
         'button, [role="button"] { transition: none !important }'（见下方
         "Hover feedback should track the pointer immediately"），!important 无视
         特异性——实测 signal 下真实 'button' 的 transitionProperty 是 none，
         只有非 button 的角色（[role='menuitem'] 这类）拿得到颜色过渡。
         曾在这里加过一条 transition: border-radius 想赢过它（见 e8216a8），实测无效，已删；
         现在圆角在悬停时瞬跳，与按钮的其它状态变化一致，文档也照此修正。
         （border-radius 也**不该**进共通过渡：浏览器把它当作可能触发重排的属性，
         放进全局规则会让长列表每次悬停整屏布局失效。） */
      body[data-endfield-motion='signal']:not(.theme-endfield-round) button:hover:not(:disabled),
      body[data-endfield-motion='signal']:not(.theme-endfield-round) [role='button']:hover:not(:disabled) {
        border-radius: 6px !important;
      }

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

      /* A-4. Composer send/stop button：同款箭头滑入 */
      body[data-endfield-motion='signal'] :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary'] {
        position: relative;
      }
      body[data-endfield-motion='signal'] :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary']::after {
        content: '';
        position: absolute;
        left: 8px;
        top: 50%;
        width: 12px;
        height: 55%;
        background-color: var(--edge-accent-ink, #101110);
        clip-path: polygon(0 15%, 100% 50%, 0 85%);
        opacity: 0;
        transform: translateY(-50%) translateX(-14px) scale(.4);
        transition: opacity .2s ease, transform .2s cubic-bezier(.16, 1, .3, 1);
        pointer-events: none;
      }
      body[data-endfield-motion='signal'] :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary']:hover::after {
        opacity: 1;
        transform: translateY(-50%) translateX(0) scale(1);
      }

      /* A-5. Sidebar session/search rows + menu/option items + table rows:
         left signal border on hover. Uses --edge-accent-onpaper (a DARK step
         that reads on both paper and panel) because --edge-accent alone is
         #d9d9d9 in the default gray palette — invisible on cream hover tints.

         The border is declared at REST as 3px solid transparent and only its
         colour changes on hover. Adding the border on hover instead would make
         every hovered row lay out again: measured over a 300-row sweep, the
         hover-created border cost 11.6ms/s of LayoutDuration against 0.00ms/s
         for the always-present version (the same reason the meter/menu rules
         pre-paint their geometry). */
      body[data-endfield-motion='signal'] [class$='_sidebarCol'] [class$='_sessionRow'],
      body[data-endfield-motion='signal'] [class$='_sidebarCol'] [class$='_searchResultRow'],
      body[data-endfield-motion='signal'] [role='menuitem'],
      body[data-endfield-motion='signal'] [role='option'],
      body[data-endfield-motion='signal'] tbody tr,
      body[data-endfield-motion='signal'] .endfield-settings button {
        border-left: 3px solid transparent !important;
      }
      body[data-endfield-motion='signal'] [class$='_sidebarCol'] [class$='_sessionRow']:hover {
        border-left: 3px solid var(--edge-accent-onpaper, var(--edge-accent)) !important;
      }
      body[data-endfield-motion='signal'] [class$='_sidebarCol'] [class$='_searchResultRow']:hover {
        border-left: 3px solid var(--edge-accent-onpaper, var(--edge-accent)) !important;
      }
      body[data-endfield-motion='signal'] [role='menuitem']:hover {
        border-left: 3px solid var(--edge-accent-onpaper, var(--edge-accent)) !important;
      }
      body[data-endfield-motion='signal'] [role='option']:hover {
        border-left: 3px solid var(--edge-accent-onpaper, var(--edge-accent)) !important;
      }
      /* Table row hover: same left border as sidebar rows. */
      body[data-endfield-motion='signal'] tbody tr:hover {
        border-left: 3px solid var(--edge-accent-onpaper, var(--edge-accent)) !important;
      }
      /* Settings panel buttons: left border on hover, visible feedback. */
      body[data-endfield-motion='signal'] .endfield-settings button:hover:not(:disabled) {
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
        body[data-endfield-motion='signal'] :is([class$='_composerSeat'], [class$='_composerHero']) button[class*='_primary']::after,
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
      radiusToRound: '切换圆角',
      radiusToSquare: '切换直角',
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
      radiusToRound: 'Use rounded',
      radiusToSquare: 'Use square',
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
              row('radius', true, [
                R.createElement('span', { style: labelStyle }, t('radiusRow') + t('sep') + t(mode === 'round' ? 'radiusRound' : 'radiusSquare')),
                R.createElement('button', { type: 'button', onClick: toggleMode, style: btnStyleFor(mode === 'round') }, t(mode === 'round' ? 'radiusToSquare' : 'radiusToRound'))
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
                  t('wmPersistRow') + t('sep') + stateOf(wmPersist),
                  R.createElement('span', { style: hintStyle },
                    t(wmPersist ? 'wmPersistHintOn' : 'wmPersistHintOff')
                  )
                ),
                R.createElement('button', {
                  type: 'button',
                  onClick: toggleWmPersist,
                  style: btnStyleFor(wmPersist, !wmOn),
                  // The switch only has meaning while the watermark itself is on.
                  disabled: !wmOn,
                  title: wmOn ? '' : t('wmPersistNeedWm'),
                }, t(wmPersist ? 'wmPersistOff' : 'wmPersistOn'))
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
