# tvbox

个人精简 TVBox / FongMi 配置。

设计目标：

- 只保留常用入口，不同步上游完整 sites 列表。
- Spider 与必要规则文件跟随 `gaotianliuyun/gao` 自动更新。
- `config.json` 由本仓库自己维护，不会被上游覆盖。
- GitHub Actions 每 6 小时检查一次；只有文件发生变化才提交。
- Ikanbot 单独使用上游 `XYQ.jar`，其他 JAR 站点继续使用 `pg.jar`。

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

Ikanbot 当前跟随高天流云 `XYQ.json` 的实现：

```text
jar/XYQ.jar
  ↓
csp_Ikanbot
  ↓
https://v.aikanbot.com
```

这里使用站点级 `jar`，因此不会影响其他仍依赖 `pg.jar` 的站点。
同时去掉了 `$$proxy`，避免依赖盒子本地未启动的 SOCKS5 代理。

## 自动同步文件

来自 `gaotianliuyun/gao@master`：

```text
jar/pg.jar
jar/XYQ.jar
json/douban.json
json/bili.json
json/sambashare.txt
lib/token.json
list.txt
```

同步逻辑见 `.github/workflows/sync-upstream.yml`。

> 本仓库仅作为个人配置壳。上游站点、接口和规则可能随时失效或变更。
