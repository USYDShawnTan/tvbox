# tvbox

个人精简版 TVBox / FongMi 配置仓。

目标很简单：**只保留常用入口，底层规则跟随上游更新，但配置控制权留在自己手里。**

当前主要用于 Android TV / 机顶盒，已在 **CM311-1a-YST + FongMi Leanback** 场景验证。

---

## 配置地址

FongMi / TVBox 中直接添加：

```text
https://raw.githubusercontent.com/USYDShawnTan/tvbox/main/config.json
```

如果设备访问 GitHub Raw 不稳定，可使用代理：

```text
https://gh-proxy.com/https://raw.githubusercontent.com/USYDShawnTan/tvbox/main/config.json
```

修改仓库配置后，建议在 FongMi 中重新加载配置；遇到缓存问题可直接强制停止 App 后重新打开：

```bash
adb shell am force-stop com.fongmi.android.tv
```

---

## 当前结构

```text
tvbox/
├── config.json
├── list.txt
├── jar/
│   ├── pg.jar
│   └── XYQ.jar
├── json/
│   ├── bili.json
│   ├── douban.json
│   └── sambashare.txt
├── lib/
│   └── token.json
├── .github/
│   └── workflows/
│       └── sync-upstream.yml
└── README.md
```

---

## 当前保留入口

| 名称 | 实现 | 说明 |
| --- | --- | --- |
| 🎬 爱看 | `XYQ.jar / csp_Ikanbot` | 当前稳定入口 |\n| 🧪 爱看·封面修复 | `QuickJS / js/ikanbot-cover.js` | 测试封面代理与资料解析 |
| 🎞️ 低端 | `pg.jar / csp_Ddys` | 备用影视源 |
| 📚 豆瓣 | `pg.jar / csp_Douban` | 分类 / 推荐 |
| 📺 哔哩 | `pg.jar / csp_Bili` | Bilibili |
| 💾 本地 | `pg.jar / csp_Local` | 本地文件 |
| 🗄️ NAS / Samba | `pg.jar / csp_SambaShare` | 局域网媒体 |
| 📡 直播 | `list.txt` | 直播频道 |

---

## Ikanbot 最终方案

Ikanbot 最终没有采用独立 JS Spider，而是跟随高天流云 `XYQ.json` 当前使用的实现：

```text
FongMi
  ↓
config.json
  ↓
site.jar = ./jar/XYQ.jar
  ↓
csp_Ikanbot
  ↓
https://v.aikanbot.com
```

对应配置：

```json
{
  "key": "Ikanbot",
  "name": "🎬 爱看",
  "type": 3,
  "api": "csp_Ikanbot",
  "searchable": 1,
  "quickSearch": 1,
  "filterable": 1,
  "changeable": 1,
  "jar": "./jar/XYQ.jar",
  "ext": "https://v.aikanbot.com"
}
```

这里使用的是**站点级 JAR**，因此：

```text
全局 pg.jar
├── 低端
├── 豆瓣
├── B站
├── 本地
└── Samba

爱看
└── 单独使用 XYQ.jar
    └── csp_Ikanbot
```

这样 Ikanbot 可以单独跟随 XYQ 上游实现，不影响其它仍依赖 `pg.jar` 的入口。

### 为什么没有继续用 JS 版？

排查过程中尝试过：

```text
QuickJS
  ↓
www1.ikanbot.com/search
```

但 Ikanbot 当前对普通 HTTP 抓取启用了 Cloudflare Challenge，返回的是：

```text
<title>Just a moment...</title>
```

而不是实际搜索结果。

因此无论如何调整 HTML selector，JS Spider 都只能得到空结果。最终回到 `XYQ.jar + csp_Ikanbot + v.aikanbot.com` 后搜索恢复正常。

### 为什么 Ikanbot 不使用 `$$$proxy`？

盒子上没有运行对应的本地 SOCKS5 代理时：

```text
127.0.0.1:10172
```

会直接出现：

```text
ECONNREFUSED
```

因此 Ikanbot 当前配置不依赖本地 `proxy`，减少无意义的本地代理依赖。

---

## JAR 的职责

仓库当前有两个 JAR。

### `jar/pg.jar`

作为全局 Spider：

```json
"spider": "./jar/pg.jar"
```

用于大部分现有入口。

### `jar/XYQ.jar`

仅给 Ikanbot 单独使用：

```json
"jar": "./jar/XYQ.jar"
```

两者互不冲突。

---

## 自动跟随上游

上游：

```text
gaotianliuyun/gao@master
```

GitHub Actions 每 6 小时检查一次：

```text
17 */6 * * *
```

同步以下文件：

```text
jar/pg.jar
jar/XYQ.jar
json/douban.json
json/bili.json
json/sambashare.txt
lib/token.json
list.txt
```

流程：

```text
gaotianliuyun/gao
        ↓
GitHub Actions
        ↓
下载指定文件
        ↓
校验 config.json / 文件非空
        ↓
有变化才 commit
        ↓
USYDShawnTan/tvbox
        ↓
FongMi 重新加载
```

`config.json` **不会从上游覆盖**，入口数量、顺序以及自定义参数仍由本仓库控制。

手动同步也可以在：

```text
GitHub → Actions → Sync upstream → Run workflow
```

执行。

---

## 调试

### 查看 FongMi 搜索日志

```bash
adb logcat -c
adb logcat | grep -Ei 'Ikanbot|TV-search|SpiderDebug|QuickJS|Exception'
```

### 完整重启 FongMi

```bash
adb shell am force-stop com.fongmi.android.tv
```

然后重新打开 App。

### 查看设备 ABI

```bash
adb shell getprop ro.product.cpu.abi
adb shell getprop ro.product.cpu.abilist
```

例如 CM311-1a-YST 当前系统：

```text
armeabi-v7a
armeabi-v7a,armeabi
```

因此应安装 FongMi：

```text
leanback-armeabi_v7a.apk
```

而不是 `arm64-v8a`。

---

## 已知事项

1. `🎞️ 低端` 当前配置仍包含 `$$$proxy`，如果盒子没有启动本地代理，搜索可能出现 `127.0.0.1:10172 ECONNREFUSED`。这不影响 Ikanbot。

2. `pg.jar` 初始化时可能尝试寻找迅雷、磁力、FFmpeg 等可选 native library。如果仓库中不存在对应 `.so` 文件，日志里会看到 404；只要没有使用对应能力，一般不影响普通点播。

3. 上游规则、域名、JAR 都可能变化。自动同步解决的是“跟随更新”，不是“保证上游永远可用”。

4. JAR 属于可执行代码。自动同步意味着会跟随上游代码变化；对安全要求更高时，可以进一步改成固定 SHA / 人工审核后更新。

---

## 设计原则

这个仓库不是完整镜像，也不追求“源越多越好”。

更倾向于：

```text
少量稳定入口
+
自己维护 config.json
+
必要文件自动跟随上游
+
问题可定位、可回滚
```

比起加载几十上百个站点，这种方式更适合长期放在自己的机顶盒上使用。

---

> 本仓库仅作为个人配置与技术研究记录。第三方站点、接口、Spider、JAR、直播源及其内容由对应上游维护者提供，其可用性、安全性和授权状态均可能随时间变化。


## 封面修复测试

`1.0.0` 保留原来的 `XYQ.jar` 稳定方案。当前 `main` 额外增加：

```text
🧪 爱看·封面修复
  ↓
js/ikanbot-cover.js
  ↓
https://v.aikanbot.com
  ↓
原始封面 URL + @Headers=...
```

第一版尝试统一走 `img-p.aikanbot.com` 图片代理，但在 CM311-1a-YST 上测试为全部封面失败。
当前改为沿用新版 Ikanbot JAR 的思路：保留原始封面 URL，并追加 FongMi 支持的 `@Headers`，
携带 User-Agent / Referer 请求图片。

该测试源不会替换原来的 `🎬 爱看`，确认搜索、封面、详情和播放都正常后再考虑升级为默认入口。
