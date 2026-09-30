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
├── js/
│   └── ikanbot-cover.js
├── json/
│   └── douban.json
├── .github/
│   └── workflows/
│       └── sync-upstream.yml
└── README.md
```

---

## 当前保留入口

| 名称 | 实现 | 说明 |
| --- | --- | --- |
| 🎬 爱看 | `XYQ.jar / csp_Ikanbot` | 原始稳定入口，搜索 / 播放正常，部分结果封面缺失 |\n| 🧪 爱看·封面修复 | `QuickJS / js/ikanbot-cover.js` | Ikanbot 负责搜索播放，豆瓣补高清封面；当前推荐测试入口 |
| 📚 豆瓣 | `pg.jar / csp_Douban` | 分类 / 推荐 |
| 📡 直播 | `list.txt` | 直播频道 |

---

## 豆瓣是什么？

### 📚 豆瓣

配置：

```json
{
  "api": "csp_Douban",
  "searchable": 0,
  "ext": "./json/douban.json"
}
```

豆瓣在这里更像 **影视资料库 / 元数据源**，主要负责：

- 电影、电视剧分类
- 热门推荐和榜单
- 海报
- 评分
- 年份、地区、演员等资料

它不是本仓库的主要播放源，因此当前关闭了全局搜索：

```text
searchable = 0
```

从 `1.1.0` 开始，`🧪 爱看·封面修复` 还会借用豆瓣 Frodo API，根据 Ikanbot 返回的片名匹配豆瓣条目，再取 `pic.large` 作为高清海报。

因此现在的关系是：

```text
Ikanbot → 搜索 / 详情 ID / 播放线路
豆瓣   → 海报 / 元数据补全
```

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
└── 豆瓣

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
list.txt
```text
jar/pg.jar
jar/XYQ.jar
json/douban.json
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

`1.0.0` 保留的是 `XYQ.jar + csp_Ikanbot` 稳定方案。

`1.1.0` 增加：

```text
🧪 爱看·封面修复
        │
        ├── Ikanbot：搜索 / 播放
        │
        └── 豆瓣 Frodo API：高清封面
                ↓
              pic.large
```

最终验证结果：

- Ikanbot 搜索和播放保持正常；
- 原站部分搜索结果缺封面的问题，通过豆瓣按片名补图解决；
- 普通豆瓣搜索图清晰度不足，因此最终会进一步请求豆瓣详情接口，优先使用 `pic.large`；
- 对豆瓣缩略图路径也会尝试升级到 `/view/photo/l/public/` 大图路径。

当前仍保留原始 `🎬 爱看` 作为兼容 / 回退入口。


## 已移除入口

为了保持配置精简，当前已移除：

```text
🎞️ 低端 / DDYS
📺 哔哩 / Bilibili
💾 本地
🗄️ NAS / Samba
```

其中 Bilibili 在当前盒子环境中无法正常使用；低端及本地/NAS 相关入口当前也没有实际需求，因此一起从 `config.json` 和自动同步清单中移除。
