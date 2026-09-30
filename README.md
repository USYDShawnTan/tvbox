# tvbox

个人精简 TVBox / FongMi 配置。

设计目标：

- 只保留常用入口，不同步上游完整 sites 列表。
- Spider 与必要规则文件跟随 `gaotianliuyun/gao` 自动更新。
- `config.json` 由本仓库自己维护，不会被上游覆盖。
- GitHub Actions 每 6 小时检查一次；只有文件发生变化才提交。
- Ikanbot 使用独立 JS Spider，不再依赖 `pg.jar` 内的 `csp_Ikanbot` 搜索实现。

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

Ikanbot 当前使用：

```text
lib/drpy2.min.js
  ↓
js/ikanbot.js
  ↓
https://www1.ikanbot.com
```

`js/ikanbot.js` 每 6 小时从高天流云的 `js/爱看机器人.js` 同步一次，
同步后会自动将上游的 `https://www.ikanbot.com` 替换为当前可用的
`https://www1.ikanbot.com`。

## 自动同步文件

来自 `gaotianliuyun/gao@master`：

```text
jar/pg.jar
json/douban.json
json/bili.json
json/sambashare.txt
lib/token.json
lib/drpy2.min.js
js/爱看机器人.js -> js/ikanbot.js
list.txt
```

同步逻辑见 `.github/workflows/sync-upstream.yml`。

> 本仓库仅作为个人配置壳。上游站点、接口和规则可能随时失效或变更。
