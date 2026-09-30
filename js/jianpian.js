let host = "http://api2.rinhome.com";

const JP_UA = "jianpian-android/360";
const JP_AUTH = "y261ow7kF2dtzlxh1GS9EB8nbTxNmaK/QQIAjctlKiEv";
const JP_REFERER = "www.jianpianapp.com";

function headers() {
  return {
    "User-Agent": JP_UA,
    "JPAUTH": JP_AUTH,
    "Referer": JP_REFERER,
    "Accept": "application/json, text/plain, */*"
  };
}

function image(url) {
  let value = String(url || "");
  if (!value) return "";
  if (value.startsWith("//")) value = "https:" + value;
  const h = JSON.stringify({
    "User-Agent": JP_UA,
    "JPAUTH": JP_AUTH,
    "Referer": JP_REFERER
  });
  return value + "@Headers=" + h;
}

function text(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    if (value.title != null) return String(value.title);
    if (value.name != null) return String(value.name);
  }
  return String(value);
}

function names(list) {
  return Array.isArray(list) ? list.map(x => text(x)).filter(Boolean).join(" / ") : text(list);
}

function normalizePlayUrl(value) {
  let url = String(value || "").trim();
  if (!url) return "";
  if (/^xg(play)?:\/\//i.test(url)) return "tvbox-xg:" + url.replace(/^xg(play)?:\/\//i, "");
  return url;
}

async function requestJson(path) {
  const candidates = [host];
  if (host.startsWith("http://")) candidates.push("https://" + host.slice(7));
  else if (host.startsWith("https://")) candidates.push("http://" + host.slice(8));

  let last = "";
  for (const base of candidates) {
    try {
      const url = base.replace(/\/$/, "") + path;
      const res = await req(url, {
        method: "get",
        timeout: 8000,
        headers: headers()
      });
      const body = res && res.content ? res.content : "";
      last = body;
      const obj = JSON.parse(body || "{}");
      if (obj && (obj.data !== undefined || obj.code !== undefined)) {
        host = base.replace(/\/$/, "");
        return obj;
      }
    } catch (e) {
      console.log("[jianpian] request failed " + base + path + " " + e.message);
    }
  }

  console.log("[jianpian] invalid response path=" + path + " body=" + String(last).slice(0, 120));
  return {};
}

function vodFromItem(item) {
  if (!item) return null;
  const id = item.id != null ? String(item.id) : "";
  const name = text(item.title);
  if (!id || !name) return null;
  return {
    vod_id: id,
    vod_name: name,
    vod_pic: image(item.path || item.thumbnail || item.cover_image || ""),
    vod_remarks: text(item.mask || item.score || (item.playlist && item.playlist.title) || "")
  };
}

function listFromData(data) {
  const arr = Array.isArray(data) ? data : [];
  return arr.map(vodFromItem).filter(Boolean);
}

async function init(cfg) {
  try {
    const ext = cfg && cfg.ext ? cfg.ext : {};
    if (typeof ext === "string" && /^https?:\/\//i.test(ext)) host = ext.replace(/\/$/, "");
    if (ext && typeof ext === "object" && ext.host) host = String(ext.host).replace(/\/$/, "");
  } catch (_) {}
}

async function home() {
  const common = [
    {
      key: "area",
      name: "地区",
      value: [
        {n:"全部",v:"0"},{n:"国产",v:"1"},{n:"中国香港",v:"3"},
        {n:"中国台湾",v:"6"},{n:"美国",v:"5"},{n:"韩国",v:"18"},{n:"日本",v:"2"}
      ]
    },
    {
      key: "year",
      name: "年份",
      value: [
        {n:"全部",v:"0"},{n:"2026",v:"162"},{n:"2025",v:"107"},{n:"2024",v:"119"},
        {n:"2023",v:"153"},{n:"2022",v:"101"},{n:"2021",v:"118"},{n:"2020",v:"16"}
      ]
    },
    {
      key: "by",
      name: "排序",
      value: [{n:"热门",v:"hot"},{n:"更新",v:"update"},{n:"评分",v:"rating"}]
    }
  ];

  return JSON.stringify({
    class: [
      {type_id:"0",type_name:"全部"},
      {type_id:"1",type_name:"电影"},
      {type_id:"2",type_name:"电视剧"},
      {type_id:"3",type_name:"动漫"},
      {type_id:"4",type_name:"综艺"}
    ],
    filters: {"0":common,"1":common,"2":common,"3":common,"4":common}
  });
}

async function homeVod() {
  // The category endpoint is more stable than the historical slide/tag endpoints.
  const obj = await requestJson("/api/crumb/list?area=0&category_id=1&page=1&type=0&limit=24&sort=hot&year=0");
  const list = listFromData(obj.data);
  console.log("[jianpian] home results=" + list.length);
  return JSON.stringify({list});
}

async function category(tid, pg, filter, extend) {
  pg = Math.max(1, parseInt(pg || "1", 10));
  const ext = extend || {};
  const cateId = ext.cateId || tid;
  const area = ext.area != null ? ext.area : "0";
  const year = ext.year != null ? ext.year : "0";
  const by = ext.by || ext.sort || "hot";

  const path =
    "/api/crumb/list?area=" + encodeURIComponent(area) +
    "&category_id=" + encodeURIComponent(cateId) +
    "&page=" + pg +
    "&type=0&limit=24&sort=" + encodeURIComponent(by) +
    "&year=" + encodeURIComponent(year);

  const obj = await requestJson(path);
  const list = listFromData(obj.data);
  console.log("[jianpian] category tid=" + tid + " pg=" + pg + " results=" + list.length + " code=" + (obj.code ?? ""));

  return JSON.stringify({
    page: pg,
    pagecount: list.length ? pg + 1 : pg,
    limit: 24,
    total: list.length ? 9999 : 0,
    list
  });
}

async function search(wd, quick, pg) {
  pg = Math.max(1, parseInt(pg || "1", 10));
  const obj = await requestJson("/api/video/search?page=" + pg + "&key=" + encodeURIComponent(wd));
  const list = listFromData(obj.data);
  console.log("[jianpian] search=" + wd + " results=" + list.length + " code=" + (obj.code ?? ""));
  return JSON.stringify({
    page: pg,
    pagecount: list.length ? pg + 1 : pg,
    list
  });
}

function addPlay(groups, name, arr) {
  if (!Array.isArray(arr) || !arr.length) return;
  const items = [];
  for (const row of arr) {
    if (!row) continue;
    const url = normalizePlayUrl(row.url);
    if (!url) continue;
    const title = text(row.title || row.source_name || "播放");
    items.push(title.replace(/[$#]/g, " ") + "$" + url);
  }
  if (items.length) groups.push({name, url: items.join("#")});
}

async function detail(id) {
  const obj = await requestJson("/api/node/detail?channel=wandoujia&token=&id=" + encodeURIComponent(id));
  const d = obj && obj.data ? obj.data : null;
  if (!d) {
    console.log("[jianpian] detail empty id=" + id + " code=" + (obj.code ?? ""));
    return JSON.stringify({list:[]});
  }

  const groups = [];
  addPlay(groups, "m3u8", d.m3u8_downlist);
  addPlay(groups, "new_m3u8", d.new_m3u8_list);
  addPlay(groups, "ftp", d.new_ftp_list);
  addPlay(groups, "迅雷", d.xunlei_downlist);
  addPlay(groups, "btbo", d.btbo_downlist);

  // Newer JianPian responses may expose source_list_source instead.
  if (Array.isArray(d.source_list_source)) {
    for (const source of d.source_list_source) {
      addPlay(groups, text(source.name || "线路"), source.source_list);
    }
  }

  const vod = {
    vod_id: String(id),
    vod_name: text(d.title),
    vod_pic: image(d.thumbnail || d.path || ""),
    vod_year: text(d.year),
    vod_area: text(d.area),
    type_name: Array.isArray(d.category) ? d.category.map(x => text(x)).filter(Boolean).join(" / ") : text(d.types),
    vod_actor: names(d.actors),
    vod_director: names(d.directors),
    vod_content: text(d.description),
    vod_remarks: d.score != null ? "评分:" + d.score : "",
    vod_play_from: groups.map(x => x.name).join("$$$"),
    vod_play_url: groups.map(x => x.url).join("$$$")
  };

  console.log("[jianpian] detail id=" + id + " lines=" + groups.length);
  return JSON.stringify({list:[vod]});
}

async function play(flag, id) {
  const url = normalizePlayUrl(id);
  return JSON.stringify({
    parse: /^https?:\/\//i.test(url) ? 0 : 0,
    jx: 0,
    url,
    header: headers()
  });
}

export function __jsEvalReturn() {
  return {init, home, homeVod, category, search, detail, play};
}
