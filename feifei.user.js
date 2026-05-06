// ==UserScript==
// @name         腓腓 — 外链直连
// @namespace    https://github.com/kc9vu/feifei
// @version      1.3.0
// @description  《山海经》有兽名腓腓，养之可以解忧。解析页面外链跳转拦截，直达目标地址。
// @author       腓腓
// @license      MIT
// @match        http?://*/*
// @exclude      http?://www.google.*/*
// @exclude      http?://*.baidu.com/*
// @exclude      http?://*.bing.com/*
// @exclude      http?://sogou.com/*
// @exclude      http?://*.sogou.com/*
// @exclude      http?://*.so.com/*
// @exclude      http?://duckduckgo.com/*
// @exclude      http?://yandex.*/*
// @exclude      http?://*.yandex.*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    var CFG_AUTO_REDIRECT   = true;
    var CFG_MARK_LINKS      = true;
    var CFG_UNIVERSAL_PARSE = true;

    var UNIVERSAL_PARAMS = ['url','target','redirect','redirect_uri','redirect_url',
        'goto','to','next','link','uri','dest','r','u','forward'];
    var STORE_KEY = 'feifei_customRules';
    var MARK_PREFIX = '腓腓已处理\n原始跳转: ';

    // ── 内置规则 & 索引 ────────────────────────────────────────
    var BUILTIN_RULES = [
        { p: 'link.zhihu.com',       k: 'target'            },
        { p: 'link.juejin.cn',       k: 'target'            },
        { p: 'link.csdn.net',        k: 'target'            },
        { p: 'www.jianshu.com',      k: 'url',  t: '/go-wild'                 },
        { p: 'www.oschina.net',      k: 'url',  t: '/action/GoToLink'          },
        { p: 'cloud.tencent.com',    k: 'url',  t: '/developer/redirect'       },
        { p: 'developer.aliyun.com', k: 'url',  t: '/forward'                  },
        { p: 'www.v2ex.com',         k: 'url',  t: '/go'                       },
        { p: 'steamcommunity.com',   k: 'url',  t: '/linkfilter'               },
        { p: 'gitee.com',            k: 'target', t: '/link'                   },
        { p: 'afdian.com',           k: 'url',  t: '/link'                     },
        { p: 'jump.bdimg.com',       k: 'url'                                 },
        { p: 'c.pc.qq.com',          k: 'url'                                 },
        { p: 'www.douyin.com',       k: 'url',  t: '/follow'                   },
        { p: 'www.toutiao.com',      k: 'url',  t: '/link'                     },
        { p: 'weibo.cn',             k: 'url',  t: '/sinaurl'                  },
        { p: 'www.weibo.com',        k: 'url',  t: '/sinaurl'                  },
        { p: 'link.logonews.cn',     k: 'url'                                 },
        { p: 'link.uisdc.com',       k: 'target'                              },
        { p: 'mail.qq.com',          k: 'url',  t: '/cgi-bin/readtemplate'    },
        { p: 'www.423down.com',      k: 'url',  t: '/go.php'                  }
    ];

    // p = pattern(hostname), k = param key, t = path prefix
    // 按 hostname 索引（不含通配符），O(1) 查找
    var RULE_INDEX = {};     // hostname → [{k, t}]   (已排序，t 长的在前)
    var WILDCARD_RULES = []; // 含 * 的规则

    (function buildIndex() {
        for (var i = 0; i < BUILTIN_RULES.length; i++) {
            var r = BUILTIN_RULES[i];
            if (r.p.indexOf('*') !== -1) {
                WILDCARD_RULES.push(r);
            } else {
                var list = RULE_INDEX[r.p];
                if (!list) RULE_INDEX[r.p] = list = [];
                list.push(r);
            }
        }
        // 每条 hostname 下的规则按 path 长度降序排列（优先匹配长路径）
        var keys = Object.keys(RULE_INDEX);
        for (var j = 0; j < keys.length; j++) {
            RULE_INDEX[keys[j]].sort(function (a, b) {
                return (b.t ? b.t.length : 0) - (a.t ? a.t.length : 0);
            });
        }
    })();

    // 自定义规则缓存
    var customRulesCache = GM_getValue(STORE_KEY, []);

    function refreshCustomRules() {
        customRulesCache = GM_getValue(STORE_KEY, []);
    }

    // ── 核心工具 ──────────

    var HTTP_URL_RE = /^https?:\/\/[^\s"'<>]+$/i;

    function isValidHttpUrl(s) {
        return s.length > 10 && HTTP_URL_RE.test(s);
    }

    // Base64 解码 — 快速跳过 URL 编码值（含 %）
    function base64Decode(s) {
        if (s.indexOf('%') !== -1) return null;
        try { return atob(s); } catch (_) { /* ignore */ }
        var fixed = s.replace(/-/g, '+').replace(/_/g, '/');
        while (fixed.length % 4) fixed += '=';
        try { return atob(fixed); } catch (_) { return null; }
    }

    // 多级 URL 解码（最多 3 层）
    function decodeUntilUrl(v) {
        var cur = v;
        for (var i = 0; i < 3; i++) {
            if (HTTP_URL_RE.test(cur)) return cur;
            try {
                var nxt = decodeURIComponent(cur);
                if (nxt === cur) break;
                cur = nxt;
            } catch (_) { break; }
        }
        return HTTP_URL_RE.test(cur) ? cur : null;
    }

    // 综合解码：URL 解码 → Base64 兜底 → 明文兜底
    function decodeRaw(raw) {
        var d = decodeUntilUrl(raw);
        if (d) return d;
        // Base64 不会含 %，跳过 URL 编码值
        if (raw.indexOf('%') === -1) {
            var b = base64Decode(raw);
            if (b) {
                d = decodeUntilUrl(b);
                if (d) return d;
                if (HTTP_URL_RE.test(b)) return b;
            }
        }
        return HTTP_URL_RE.test(raw) ? raw : null;
    }

    // 通配符域名匹配（编译缓存）
    var wildcardCache = {};
    function wildcardMatch(pattern, domain) {
        if (pattern.indexOf('*') === -1) return pattern === domain;
        var re = wildcardCache[pattern];
        if (!re) wildcardCache[pattern] = re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
        return re.test(domain);
    }

    /** 从已解析的 URL 对象中按参数名提取目标地址 */
    function tryExtract(urlObj, paramKey) {
        var raw = urlObj.search ? urlObj.searchParams.get(paramKey) : null;
        if (!raw && urlObj.hash) {
            try {
                var fake = new URL('https://x.com/' + urlObj.hash.replace(/^#\/?/, ''));
                raw = fake.searchParams.get(paramKey);
            } catch (_) { /* ignore */ }
        }
        return raw ? decodeRaw(raw) : null;
    }

    /** 通用探测：遍历常见参数名 */
    function tryExtractUniversal(urlObj) {
        if (!urlObj.search && !urlObj.hash) return null;
        var i, raw, t;
        if (urlObj.search) {
            for (i = 0; i < UNIVERSAL_PARAMS.length; i++) {
                raw = urlObj.searchParams.get(UNIVERSAL_PARAMS[i]);
                if (raw) { t = decodeRaw(raw); if (t) return t; }
            }
        }
        if (urlObj.hash) {
            try {
                var fake = new URL('https://x.com/' + urlObj.hash.replace(/^#\/?/, ''));
                for (i = 0; i < UNIVERSAL_PARAMS.length; i++) {
                    raw = fake.searchParams.get(UNIVERSAL_PARAMS[i]);
                    if (raw) { t = decodeRaw(raw); if (t) return t; }
                }
            } catch (_) { /* ignore */ }
        }
        return null;
    }

    /** 解析链接：返回 { target } 或 null */
    function resolveTarget(href) {
        var url;
        try { url = new URL(href); } catch (_) { return null; }

        var host = url.hostname;
        var list, i, r, t;

        // 1. O(1) 精确域名索引
        list = RULE_INDEX[host];
        if (list) {
            for (i = 0; i < list.length; i++) {
                r = list[i];
                if (!r.t || url.pathname.indexOf(r.t) === 0) {
                    t = tryExtract(url, r.k);
                    if (t && t !== href) return { target: t };
                }
            }
        }

        // 2. 通配规则
        for (i = 0; i < WILDCARD_RULES.length; i++) {
            r = WILDCARD_RULES[i];
            if (wildcardMatch(r.p, host) && (!r.t || url.pathname.indexOf(r.t) === 0)) {
                t = tryExtract(url, r.k);
                if (t && t !== href) return { target: t };
            }
        }

        // 3. 自定义规则（缓存）
        for (i = 0; i < customRulesCache.length; i++) {
            r = customRulesCache[i];
            if (wildcardMatch(r.p, host) && (!r.t || url.pathname.indexOf(r.t) === 0)) {
                t = tryExtract(url, r.k);
                if (t && t !== href) return { target: t };
            }
        }

        // 4. 通用探测
        if (CFG_UNIVERSAL_PARSE) {
            t = tryExtractUniversal(url);
            if (t && t !== href) return { target: t };
        }

        return null;
    }

    // ── 链接处理 ──────────────────────────────────────────────

    var SKIP_PROTO_RE = /^(javascript|mailto|tel|ftp|magnet|file|data):/i;

    function processLink(a) {
        if (a.dataset.feifei) return;
        var href = a.href;
        if (!href || SKIP_PROTO_RE.test(href)) {
            a.dataset.feifei = 'skip';
            return;
        }
        var r = resolveTarget(href);
        if (!r) { a.dataset.feifei = '0'; return; }
        a.dataset.feifei = '1';
        a.href = r.target;
        if (CFG_MARK_LINKS && !a.title) {
            a.title = MARK_PREFIX + href;
        }
    }

    function processAllLinks() {
        var links = document.querySelectorAll('a:not([data-feifei])');
        for (var i = 0; i < links.length; i++) processLink(links[i]);
    }

    // ── DOM 监听（requestAnimationFrame 节流） ─────────────────

    function setupObserver() {
        var rafId = 0;
        var observer = new MutationObserver(function () {
            if (rafId) return;
            rafId = requestAnimationFrame(function () {
                rafId = 0;
                processAllLinks();
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // ── 自动跳转 ──────────────────────────────────────────────

    function tryAutoRedirect() {
        if (!CFG_AUTO_REDIRECT) return false;
        var href = window.location.href;
        var r = resolveTarget(href);
        if (!r || r.target === href) return false;
        window.location.replace(r.target);
        return true;
    }

    // ── 自定义规则管理 ────────────────────────────────────────

    function cmdAddRule() {
        var domain = (prompt('请输入域名（支持 * 通配符），如 "link.example.com":') || '').trim();
        if (!domain) return alert('已取消');
        var param = (prompt('请输入承载目标地址的参数名，如 "target":') || '').trim();
        if (!param) return alert('已取消');
        var pathInput = (prompt('可选项 — 限定路径前缀，如 "/redirect"，留空匹配全部:') || '').trim();

        var rule = { p: domain, k: param };
        if (pathInput) rule.t = pathInput;

        var rules = GM_getValue(STORE_KEY, []);
        rules.push(rule);
        GM_setValue(STORE_KEY, rules);
        customRulesCache = rules;

        alert('已添加: ' + domain + (pathInput || '/*') + ' → ?' + param);
        processAllLinks();
    }

    function cmdDeleteRule() {
        var rules = GM_getValue(STORE_KEY, []);
        if (rules.length === 0) return alert('当前没有自定义规则。');

        var text = '输入序号删除:\n';
        for (var i = 0; i < rules.length; i++) {
            text += (i + 1) + '. ' + rules[i].p + (rules[i].t || '/*') + '  →  ?' + rules[i].k + '\n';
        }

        var input = prompt(text + '\n输入序号（多个用逗号分隔）或输入 0 全部删除:');
        if (input === null) return alert('已取消');

        var trimmed = input.trim();
        if (trimmed === '0') {
            if (confirm('确定删除全部 ' + rules.length + ' 条自定义规则？')) {
                GM_setValue(STORE_KEY, []);
                customRulesCache = [];
                alert('已清空。');
            }
            return;
        }

        var idxList = trimmed.split(',');
        var indices = [];
        for (var j = 0; j < idxList.length; j++) {
            var n = parseInt(idxList[j].trim(), 10) - 1;
            if (n >= 0 && n < rules.length) indices.push(n);
        }
        if (indices.length === 0) return alert('未找到有效序号。');

        // 降序排列（避免索引偏移）
        indices.sort(function (a, b) { return b - a; });

        var removed = [];
        for (var k = 0; k < indices.length; k++) {
            removed.push(rules[indices[k]].p);
            rules.splice(indices[k], 1);
        }

        GM_setValue(STORE_KEY, rules);
        customRulesCache = rules;
        alert('已删除 ' + indices.length + ' 条:\n' + removed.join(', '));
    }

    // ── 注册菜单 ──────────────────────────────────────────────

    function registerMenus() {
        GM_registerMenuCommand('➕ 添加自定义规则', cmdAddRule, 'a');
        GM_registerMenuCommand('🗑 删除自定义规则', cmdDeleteRule, 'd');
    }

    // ── 启动 ──────────────────────────────────────────────────

    function init() {
        if (tryAutoRedirect()) return;
        processAllLinks();
        setupObserver();
        registerMenus();
    }

    init();
})();
