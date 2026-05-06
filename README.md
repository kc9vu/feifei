<p align="center">
  <img src="https://img.shields.io/badge/Tampermonkey-v4.0+-black?logo=tampermonkey" alt="Tampermonkey">
  <img src="https://img.shields.io/github/license/kc9vu/feifei" alt="License">
</p>

# 腓腓 — 外链直连

> 《山海经·中山经》：**「有兽焉，其状如狸而白尾，有鬣，名曰腓腓，养之可以解忧。」**

腓腓（féi féi）是《山海经》中能为人解忧的神兽。
此脚本正如其名——**解析页面中被跳转拦截的外链，直达目标地址，免除跳转页之忧。**

---

## 功能

| 功能 | 说明 |
|------|------|
| 🔗 **链接直连** | 自动将跳转链接（如 `link.zhihu.com/?target=...`）替换为真实目标 |
| ⚡ **自动跳转** | 身处跳转页时立刻跳走，不污染浏览器历史 |
| 🔍 **通用探测** | 对未知域名自动探测 `url` / `target` / `redirect` 等 14 种常见参数 |
| 🧬 **多格式解码** | URL 编码（1~3 层）、Base64、URL-safe Base64 自动识别 |
| 🔩 **自定义规则** | 通过油猴菜单添加任意域名 + 参数名规则 |
| 👁 **DOM 监听** | MutationObserver 实时处理动态加载的链接 |

### 已内置支持的站点（21 个）

知乎 · 掘金 · CSDN · 简书 · 开源中国 · 腾讯云 · 阿里云 · V2EX · Steam · Gitee 等。

---

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)/[Violentmonkey](https://violentmonkey.github.io/) 浏览器扩展
2. 点击 [脚本安装链接](https://github.com/kc9vu/feifei/raw/refs/heads/main/feifei.user.js) → Tampermonkey/Violentmonkey 会自动弹出安装提示

---

## 使用

安装即用，无需配置。链接被处理时会自动替换 `href` 属性，鼠标悬停可见原始跳转地址。

### 添加自定义规则

点击 Tampermonkey 图标 → **「➕ 添加自定义规则」**，输入：

```
域名（支持 * 通配）: link.example.com
参数名:            target
路径前缀（可选）:    /redirect
```

### 删除自定义规则

点击 **「🗑 删除自定义规则」** → 输入序号 → 确认

---

## 示例

| 原始链接 | 解析后 |
|----------|--------|
| `link.zhihu.com/?target=https%3A%2F%2Fexample.com` | `https://example.com` |
| `www.423down.com/go.php?url=aHR0cHM6Ly9wYW4ucXVhcmsuY24vcw==` | `https://pan.quark.cn/s/...` |
| `jump.bdimg.com/?url=https%3A%2F%2Fwww.baidu.com` | `https://www.baidu.com` |

---

## About the name

**Fei Fei** (腓腓) is a mythical creature from *Shanhaijing* (Classic of Mountains and Seas), an ancient Chinese text. It resembles a fox with a white tail, and keeping one is said to dispel worries — much like this script dispels the annoyance of redirect pages.

---

## 欢迎反馈

未覆盖的跳转域名？发现 Bug？

→ [提交 Issue](https://github.com/kc9vu/feifei/issues) 附上原始跳转链接，会尽快加入内置规则。

添加自定义规则后验证有效的，也欢迎提 PR 或反馈收录。

## License

[MIT](LICENSE)
