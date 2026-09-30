# tvbox

个人精简版 TVBox / FongMi 配置仓。

已在 **CM311-1a-YST + FongMi Leanback** 环境验证。

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
| 🎬 爱看·快速 | `XYQ.jar / csp_Ikanbot` | 搜索和播放快；部分原站封面可能缺失 |
| 🖼️ 爱看·高清封面 | `QuickJS / ikanbot-cover.js` | Ikanbot 搜索播放 + 豆瓣高清海报；请求更多，速度较慢 |
| 🧪 荐片 | `XYQ.jar / csp_JianPian` | 测试源；跟随当前 XYQ 实现 |\n| 📚 豆瓣 | `pg.jar / csp_Douban` | 分类、榜单、评分、海报和影视资料 |
| 📺 哔哩 | `QuickJS / bili.js` | 直接调用 Bilibili API，不再依赖旧 `csp_Bili` 规则 |

已经移除：

```text
🎞️ 低端 / DDYS
💾 本地
🗄️ NAS / Samba
📡 直播
```

## 爱看为什么保留两个？

高清封面版需要额外请求豆瓣匹配影片并获取 `pic.large`，网络较慢时容易增加搜索耗时。

所以暂时拆成两个独立入口：

```text
🎬 爱看·快速
  └── Ikanbot 原生搜索 / 播放
      └── 速度优先

🖼️ 爱看·高清封面
  ├── Ikanbot 搜索 / 播放
  └── 豆瓣 Frodo API 补高清封面
      └── 显示效果优先
```

高清版设置 `quickSearch: 0`，避免参与快速搜索。

## 哔哩修复

之前的 B 站入口使用：

```text
pg.jar
  ↓
csp_Bili
  ↓
json/bili.json
```

在当前盒子环境中无法正常打开。

现在改成仓库自带的：

```text
js/bili.js
  ↓
Bilibili 官方 Web API
```

当前实现包含：

- 热门视频
- 纪录片 / 知识 / 科技 / 音乐 / 影视分类搜索
- 关键词搜索
- 视频详情和分 P
- 直接获取播放地址
- 播放时自动附带 Bilibili Referer / User-Agent

默认是未登录模式：

```json
"ext": {
  "cookie": ""
}
```

如果 Bilibili 后续对搜索或高清画质加强风控，可以再填 Cookie，不需要改 Spider 代码。

## 壁纸

当前：

```text
https://picsum.photos/1920/1080?blur=1
```

使用 16:9 随机高分辨率照片，比原来的渐变壁纸更适合电视背景。

## 当前目录

```text
tvbox/
├── config.json
├── jar/
│   ├── pg.jar
│   └── XYQ.jar
├── js/
│   ├── bili.js
│   └── ikanbot-cover.js
├── json/
│   └── douban.json
├── .github/
│   └── workflows/
│       └── sync-upstream.yml
└── README.md
```

## 自动同步

每 6 小时只同步仍然需要的上游文件：

```text
jar/pg.jar
jar/XYQ.jar
json/douban.json
```

`config.json`、`js/bili.js`、`js/ikanbot-cover.js` 由本仓库自己维护。

## 调试

重启 FongMi：

```bash
adb shell am force-stop com.fongmi.android.tv
```

爱看日志：

```bash
adb logcat | grep -Ei 'Ikanbot|ikanbot-cover|TV-search|QuickJS|Exception'
```

哔哩日志：

```bash
adb logcat | grep -Ei '\[bili\]|TV-search|QuickJS|Exception'
```

## 版本

- `1.0.0`：Ikanbot 搜索 / 播放稳定版。
- `1.1.0`：增加豆瓣高清封面补全。
- `main`：快速 / 高清版分离，移除低端、本地、NAS、直播，Bilibili 改为独立 QuickJS API 实现。

> 本仓库用于个人配置与技术研究。第三方站点和接口的可用性可能随时间变化。


## 爱看性能优化

高清封面版最初对每条搜索结果串行执行：

```text
豆瓣搜索
→ 豆瓣详情
→ 下一条
```

搜索结果较多时容易超时。

当前 main 已优化为：

```text
每批 3 条并发
→ 优先直接使用豆瓣搜索结果中的 pic.large / 可升级大图 URL
→ 只有搜索结果完全没有图片时才请求豆瓣详情
→ 单次豆瓣请求超时 3 秒
→ 标题 + 年份优先匹配，降低同名作品错图概率
```

因此高清版仍然比快速版请求更多，但正常情况下网络请求数会明显下降。

## 今天用到的影视相关链接

下面集中记录今天实际用到或确认过的影视 App、配置和上游项目，方便以后直接回来找。

### FongMi / TV

项目主页：

```text
https://github.com/FongMi/TV
```

Release 下载页：

```text
https://github.com/FongMi/TV/releases
```

当前这台 **CM311-1a-YST** 是 32 位 Android 用户空间，安装包应优先选择：

```text
leanback-armeabi_v7a.apk
```

不要选：

```text
arm64-v8a
```

### 影视仓 / TVBox

今天参考过的仓库目录：

```text
https://github.com/youhunwl/TVAPP/tree/refs/heads/main/TVBox
```

这里包含影视仓 / TVBox 相关安装包和版本。

### 高天流云 TVBox 配置上游

本仓库部分 JAR 和豆瓣配置的上游来源：

```text
https://github.com/gaotianliuyun/gao
```

当前自动同步的内容主要包括：

```text
jar/pg.jar
jar/XYQ.jar
json/douban.json
```

### 本仓库

仓库主页：

```text
https://github.com/USYDShawnTan/tvbox
```

FongMi 配置地址：

```text
https://raw.githubusercontent.com/USYDShawnTan/tvbox/main/config.json
```

GitHub Raw 访问不稳定时：

```text
https://gh-proxy.com/https://raw.githubusercontent.com/USYDShawnTan/tvbox/main/config.json
```

### 当前稳定版本

```text
1.2.0
```

Tag：

```text
https://github.com/USYDShawnTan/tvbox/tree/1.2.0
```




## 荐片测试

第一版使用了 `pg.jar / csp_Jianpian + json/jianpian.json`，在当前盒子上出现分类无法加载。

排查后发现当前较新的 JianPian 实现已经不依赖这份旧过滤 JSON；高天流云当前 `XYQ.json` 使用的是：

```text
XYQ.jar
  ↓
csp_JianPian
  ↓
http://39.108.238.168:20000
```

因此测试入口已切换到同样的实现：

```json
{
  "api": "csp_JianPian",
  "jar": "./jar/XYQ.jar",
  "playerType": 1,
  "searchable": 1,
  "quickSearch": 0,
  "filterable": 1,
  "timeout": 60,
  "ext": "http://39.108.238.168:20000"
}
```

原来的 `json/jianpian.json` 不再参与配置。
