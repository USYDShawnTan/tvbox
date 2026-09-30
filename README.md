# tvbox

个人精简 TVBox / FongMi 配置。

设计目标：

- 只保留常用入口，不同步上游完整 sites 列表。
- Spider 与必要规则文件跟随 `gaotianliuyun/gao` 自动更新。
- `config.json` 由本仓库自己维护，不会被上游覆盖。
- GitHub Actions 每 6 小时检查一次；只有文件发生变化才提交。
- Ikanbot 使用独立 QuickJS Spider，不依赖 `pg.jar` 或 `drpy2.min.js`。

## 配置地址

```text
https://raw.githubusercontent.com/USYDShawnTan/tvbox/main/config.json
```

## 当前保留

- Ikanbot
- 低端影视
- 豆瓣
- Bilibili
- 本地
- Samba / NAS
- 直播

## Ikanbot

Ikanbot 当前直接使用：

```text
js/ikanbot-standalone.js
  ↓
https://www1.ikanbot.com
```

该 Spider 只依赖 FongMi 自带的 QuickJS 与 Cheerio，避免 `drpy2.min.js`
继续加载第三方远程模块导致初始化失败。搜索、详情和播放逻辑均在本仓库可直接维护。

## 自动同步文件

来自 `gaotianliuyun/gao@master`：

```text
jar/pg.jar
json/douban.json
json/bili.json
json/sambashare.txt
lib/token.json
list.txt
```

同步逻辑见 `.github/workflows/sync-upstream.yml`。

> 本仓库仅作为个人配置壳。上游站点、接口和规则可能随时失效或变更。
