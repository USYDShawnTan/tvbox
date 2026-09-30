# tvbox

个人精简版 TVBox / FongMi 配置仓。

已在 **CM311-1a-YST + FongMi Leanback** 环境验证。

当前原则：**只保留实际可用、自己验证过的入口。**

## 配置地址

```text
https://raw.githubusercontent.com/USYDShawnTan/tvbox/main/config.json
```

GitHub Raw 不稳定时：

```text
https://gh-proxy.com/https://raw.githubusercontent.com/USYDShawnTan/tvbox/main/config.json
```

## 当前入口

| 名称 | 实现 | 说明 |
| --- | --- | --- |
| 🎬 爱看·快速 | `XYQ.jar / csp_Ikanbot` | 搜索 / 播放速度优先，部分原站封面可能缺失 |
| ⚡ 优速 | `QuickJS / ikanbot-cover.js` | Ikanbot + 豆瓣高清海报 + 精简播放线路 |
| 🧪 4K剧院 | `drpy2 / 4k剧院.js` | 4K 测试源；先验证分类、搜索和实际播放清晰度 |
| 📚 豆瓣 | `pg.jar / csp_Douban` | 分类、榜单、评分、海报和影视资料 |
| 📺 哔哩 | `QuickJS / bili.js` | Bilibili API，支持热门、搜索、详情、分 P 和播放 |

已经移除：

```text
🎞️ 低端 / DDYS
💾 本地
🗄️ NAS / Samba
📡 直播
🧪 荐片
```

荐片先后测试过旧 JAR、动态域名方案、`api2.rinhome.com` 和 `api.ztcgi.com`，在当前盒子环境里始终无法稳定取得分类内容，因此不再保留实验代码和配置。

## 爱看·快速

```text
FongMi
  ↓
config.json
  ↓
jar/XYQ.jar
  ↓
csp_Ikanbot
  ↓
https://v.aikanbot.com
```

核心配置：

```json
{
  "key": "Ikanbot",
  "name": "🎬 爱看·快速",
  "type": 3,
  "api": "csp_Ikanbot",
  "jar": "./jar/XYQ.jar",
  "ext": "https://v.aikanbot.com"
}
```

优点是简单、快、稳定；缺点是搜索结果部分封面可能缺失。

## ⚡ 优速

优速是基于 Ikanbot 自己维护的 QuickJS 版本：

```text
Ikanbot
  ├── 分类 / 搜索
  ├── 详情 / 播放
  └── 原始片源

豆瓣 Frodo API
  └── 高清海报
```

### 海报

搜索结果会尽量使用豆瓣高清封面：

```text
Ikanbot 返回结果
  ↓
标题 + 年份匹配豆瓣
  ↓
优先 pic.large
  ↓
FongMi 竖版海报
```

当前优化：

- 标题完全匹配优先；
- 同标题 + 同年份结果去重；
- 年份会合并到状态信息里；
- 卡片使用 `rect / 0.75` 竖版比例；
- 已有豆瓣图片时直接升级大图，减少额外请求；
- 豆瓣请求 2.5 秒超时；
- 每批 3 条并发；
- 进程内缓存避免重复查询；
- 豆瓣失败时保留 Ikanbot 原图兜底。

### 线路

优速只保留五条常用线路：

```text
量子      ← lzm3u8
非凡      ← ffm3u8
优质      ← 1080zyk
西瓜      ← xigua / xgm3u8
快车      ← kcm3u8
```

其余 Ikanbot 返回线路不展示。

FongMi / TVBox 播放数据格式：

```text
线路之间：$$$
同线路剧集之间：#
剧集名称和地址之间：$
```

例如：

```text
vod_play_from:
量子$$$非凡$$$优质

vod_play_url:
HD中字$https://example.com/a.m3u8$$$中字$https://example.com/b.m3u8$$$...
```

## 哔哩

之前的旧 `csp_Bili` 在当前盒子环境无法正常使用，因此改成仓库自带：

```text
js/bili.js
  ↓
Bilibili Web API
```

目前支持：

- 热门视频
- 纪录片 / 知识 / 科技 / 音乐 / 影视分类
- 关键词搜索
- 视频详情
- 分 P
- 直接播放

默认未登录：

```json
"ext": {
  "cookie": ""
}
```

## 豆瓣

豆瓣主要作为影视元数据源，而不是主播放源：

- 热门电影 / 剧集
- 分类和榜单
- 海报
- 评分
- 年份、地区、演员等资料
- 给优速补高清海报

当前：

```json
{
  "api": "csp_Douban",
  "searchable": 0,
  "ext": "./json/douban.json"
}
```

## 壁纸

```text
https://picsum.photos/1920/1080?blur=1
```

## 当前目录

```text
tvbox/
├── config.json
├── jar/
│   ├── pg.jar
│   └── XYQ.jar
├── js/
│   ├── bili.js
│   ├── ikanbot-cover.js
│   └── 4k剧院.js
├── lib/
│   └── drpy2.min.js
├── json/
│   └── douban.json
├── .github/
│   └── workflows/
│       └── sync-upstream.yml
└── README.md
```

## 自动同步

每 6 小时同步：

```text
jar/pg.jar
jar/XYQ.jar
json/douban.json
lib/drpy2.min.js
js/4k剧院.js
```

`config.json`、`js/bili.js` 和 `js/ikanbot-cover.js` 由本仓库自己维护。

## 调试

重启 FongMi：

```bash
adb shell am force-stop com.fongmi.android.tv
```

爱看 / 优速：

```bash
adb logcat | grep -Ei 'Ikanbot|ikanbot-cover|TV-search|QuickJS|Exception'
```

哔哩：

```bash
adb logcat | grep -Ei '\[bili\]|TV-search|QuickJS|Exception'
```

## 版本

- `1.0.0`：Ikanbot 搜索 / 播放稳定版。
- `1.1.0`：增加豆瓣高清封面补全。
- `1.2.0`：爱看性能优化、Bilibili 修复和整体精简。
- `main`：继续维护优速搜索 / 海报 / 线路体验。

## 今天用到的影视相关链接

### FongMi / TV

项目主页：

```text
https://github.com/FongMi/TV
```

Release：

```text
https://github.com/FongMi/TV/releases
```

当前 CM311-1a-YST 使用：

```text
leanback-armeabi_v7a.apk
```

### 影视仓 / TVBox

```text
https://github.com/youhunwl/TVAPP/tree/refs/heads/main/TVBox
```

### 高天流云上游

```text
https://github.com/gaotianliuyun/gao
```

### 本仓库

```text
https://github.com/USYDShawnTan/tvbox
```

当前稳定 Tag：

```text
https://github.com/USYDShawnTan/tvbox/tree/1.2.0
```

> 本仓库用于个人配置与技术研究。第三方站点、接口和 Spider 的可用性可能随时间变化。


## 4K剧院测试

新增独立测试入口：

```text
🧪 4K剧院
  ↓
lib/drpy2.min.js
  ↓
js/4k剧院.js
  ↓
https://4k4k.live
```

当前直接跟随高天流云上游规则，先不做二次魔改，重点验证：

```text
分类是否加载
→ 搜索是否正常
→ 详情是否正常
→ 能否直接播放
→ 实际是否为 2160p / 4K，而不只看片名标签
```

为避免尚未验证的源加入全局聚合搜索，当前设置：

```json
"quickSearch": 0
```

对应的 `lib/drpy2.min.js` 和 `js/4k剧院.js` 已加入每 6 小时上游同步。
