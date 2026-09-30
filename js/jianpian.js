let host = "https://api.ztcgi.com";
let imageHost = "";

const UA = "Mozilla/5.0 (Linux; Android 9; V2196A Build/PQ3A.190705.08211809; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36;webank/h5face;webank/1.0;netType:NETWORK_WIFI;appVersion:416;packageName:com.jp3.xg3";

function headers() {
  return {
    "User-Agent": UA,
    "Referer": host + "/",
    "Accept": "application/json, text/plain, */*"
  };
}

function safeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

async function get(path, timeout = 10000) {
  try {
    const res = await req(host.replace(/\/$/, "") + path, {
      method: "get",
      timeout,
      headers: headers()
    });
    return res && res.content ? res.content : "";
  } catch (e) {
    console.log("[jianpian] request failed path=" + path + " " + e.message);
    return "";
  }
}

function absImage(url) {
  let value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return "https:" + value;
  if (imageHost) return imageHost.replace(/\/$/, "") + (value.startsWith("/") ? value : "/" + value);
  return value;
}

function vod(item, idKey = "id", picKey = "path") {
  if (!item) return null;
  const id = item[idKey] != null ? String(item[idKey]) : "";
  const name = String(item.title || "").trim();
  if (!id || !name) return null;
  return {
    vod_id: id,
    vod_name: name,
    vod_pic: absImage(item[picKey] || item.thumbnail || item.cover_image || ""),
    vod_remarks: String(item.mask || item.score || "").trim()
  };
}

function list(data, idKey = "id", picKey = "path") {
  return (Array.isArray(data) ? data : []).map(item => vod(item, idKey, picKey)).filter(Boolean);
}

async function init(cfg) {
  try {
    const ext = cfg && cfg.ext ? cfg.ext : {};
    if (typeof ext === "string" && /^https?:\/\//i.test(ext)) host = ext.replace(/\/$/, "");
    if (ext && typeof ext === "object" && ext.host) host = String(ext.host).replace(/\/$/, "");
  } catch (_) {}

  // Current API exposes its resource host here.
  try {
    const body = await get("/api/v2/settings/resourceDomainConfig", 8000);
    const obj = safeJson(body);
    const raw = obj && obj.data ? String(obj.data.imgDomain || "") : "";
    if (raw) {
      const domains = raw.split(",").map(x => x.trim()).filter(Boolean);
      if (domains.length) imageHost = /^https?:\/\//i.test(domains[0]) ? domains[0] : "https://" + domains[0];
    }
  } catch (_) {}

  if (!imageHost) imageHost = "https://img.jgsfnl.com";
  console.log("[jianpian] init host=" + host + " imageHost=" + imageHost);
}

function fallbackClasses() {
  return [
    {type_id:"1", type_name:"电影"},
    {type_id:"2", type_name:"电视剧"},
    {type_id:"3", type_name:"动漫"},
    {type_id:"4", type_name:"综艺"}
  ];
}

function commonFilter() {
  return [
    {
      key:"cateId",
      name:"分类",
      value:[
        {v:"",n:"全部"},{v:"1",n:"剧情"},{v:"2",n:"爱情"},{v:"3",n:"动画"},
        {v:"4",n:"喜剧"},{v:"5",n:"战争"},{v:"7",n:"古装"},{v:"8",n:"奇幻"},
        {v:"9",n:"冒险"},{v:"10",n:"动作"},{v:"11",n:"科幻"},{v:"12",n:"悬疑"},
        {v:"13",n:"犯罪"},{v:"18",n:"惊悚"},{v:"24",n:"武侠"},{v:"25",n:"恐怖"}
      ]
    },
    {
      key:"area",
      name:"地区",
      value:[
        {v:"",n:"全部"},{v:"1",n:"国产"},{v:"3",n:"中国香港"},
        {v:"6",n:"中国台湾"},{v:"5",n:"美国"},{v:"18",n:"韩国"},{v:"2",n:"日本"}
      ]
    },
    {
      key:"year",
      name:"年代",
      value:[
        {v:"",n:"全部"},{v:"162",n:"2026"},{v:"107",n:"2025"},{v:"119",n:"2024"},
        {v:"153",n:"2023"},{v:"101",n:"2022"},{v:"118",n:"2021"},
        {v:"16",n:"2020"},{v:"7",n:"2019"},{v:"2",n:"2018"},{v:"3",n:"2017"}
      ]
    },
    {
      key:"sort",
      name:"排序",
      value:[{v:"update",n:"最新"},{v:"hot",n:"最热"},{v:"rating",n:"评分"}]
    }
  ];
}

async function home() {
  let classes = [];

  // Prefer the server's live category list, but keep a local fallback.
  try {
    const body = await get("/api/v2/settings/homeCategory", 8000);
    const obj = safeJson(body);
    if (Array.isArray(obj.data)) {
      classes = obj.data
        .filter(x => x && x.id != null && x.name)
        .map(x => ({type_id:String(x.id), type_name:String(x.name)}))
        .filter(x => !/推荐|首页/.test(x.type_name));
    }
  } catch (_) {}

  if (!classes.length) classes = fallbackClasses();

  const filters = {};
  for (const item of classes) {
    if (item.type_id !== "88" && item.type_id !== "99") filters[item.type_id] = commonFilter();
  }

  console.log("[jianpian] home classes=" + classes.map(x => x.type_name).join(","));
  return JSON.stringify({class:classes, filters});
}

async function homeVod() {
  const body = await get("/api/slide/list?pos_id=88");
  const obj = safeJson(body);
  const items = Array.isArray(obj.data) ? obj.data : [];

  const videos = items.map(item => ({
    vod_id: item.jump_id != null ? String(item.jump_id) : String(item.id || ""),
    vod_name: String(item.title || ""),
    vod_pic: absImage(item.thumbnail || item.path || ""),
    vod_remarks: String(item.mask || "")
  })).filter(x => x.vod_id && x.vod_name);

  console.log("[jianpian] homeVod results=" + videos.length + " code=" + String(obj.code ?? ""));
  return JSON.stringify({list:videos});
}

async function category(tid, pg, filter, extend) {
  pg = Math.max(1, parseInt(pg || "1", 10));
  const ext = extend || {};

  const path =
    "/api/crumb/list?fcate_pid=" + encodeURIComponent(tid) +
    "&category_id=&area=" + encodeURIComponent(ext.area || "") +
    "&year=" + encodeURIComponent(ext.year || "") +
    "&type=" + encodeURIComponent(ext.cateId || "") +
    "&sort=" + encodeURIComponent(ext.sort || "") +
    "&page=" + pg;

  const body = await get(path);
  const obj = safeJson(body);
  const videos = list(obj.data);

  console.log("[jianpian] category tid=" + tid + " pg=" + pg +
    " results=" + videos.length + " code=" + String(obj.code ?? "") +
    " message=" + String(obj.message || obj.msg || ""));

  return JSON.stringify({
    page:pg,
    pagecount:videos.length ? pg + 1 : pg,
    limit:videos.length,
    total:videos.length ? 99999 : 0,
    list:videos
  });
}

async function search(wd, quick, pg) {
  pg = Math.max(1, parseInt(pg || "1", 10));

  const path =
    "/api/v2/search/videoV2?key=" + encodeURIComponent(wd) +
    "&category_id=88&page=" + pg + "&pageSize=20";

  const body = await get(path);
  const obj = safeJson(body);
  const videos = list(obj.data, "id", "thumbnail");

  console.log("[jianpian] search=" + wd + " pg=" + pg +
    " results=" + videos.length + " code=" + String(obj.code ?? "") +
    " message=" + String(obj.message || obj.msg || ""));

  return JSON.stringify({
    page:pg,
    pagecount:videos.length ? pg + 1 : pg,
    list:videos
  });
}

function cleanPlayUrl(url) {
  return String(url || "").trim();
}

async function detail(id) {
  const body = await get("/api/video/detailv2?id=" + encodeURIComponent(id));
  const obj = safeJson(body);
  const d = obj && obj.data ? obj.data : null;

  if (!d) {
    console.log("[jianpian] detail empty id=" + id +
      " code=" + String(obj.code ?? "") +
      " message=" + String(obj.message || obj.msg || ""));
    return JSON.stringify({list:[]});
  }

  const groups = [];
  if (Array.isArray(d.source_list_source)) {
    for (const group of d.source_list_source) {
      if (!group || !Array.isArray(group.source_list)) continue;
      const eps = [];

      for (const item of group.source_list) {
        const url = cleanPlayUrl(item && item.url);
        if (!url) continue;
        const name = String((item && item.source_name) || "播放").replace(/[$#]/g, " ");
        eps.push(name + "$" + url);
      }

      if (eps.length) {
        groups.push({
          name:String(group.name || "线路").replace(/[$#]/g, " "),
          url:eps.join("#")
        });
      }
    }
  }

  const vodObj = {
    vod_id:String(d.id != null ? d.id : id),
    vod_name:String(d.title || ""),
    vod_pic:absImage(d.thumbnail || d.path || ""),
    vod_year:String(d.year || ""),
    vod_area:String(d.area || ""),
    vod_remarks:String(d.mask || d.score || ""),
    vod_content:String(d.description || ""),
    vod_play_from:groups.map(x => x.name).join("$$$"),
    vod_play_url:groups.map(x => x.url).join("$$$")
  };

  console.log("[jianpian] detail id=" + id + " lines=" + groups.length);
  return JSON.stringify({list:[vodObj]});
}

async function play(flag, id) {
  let url = cleanPlayUrl(id);
  if (!url) return JSON.stringify({parse:0, url:""});

  // JianPian extractor in FongMi handles ftp/xg/tvbox-xg links.
  if (!/\.(m3u8|mp4)(\?|$)/i.test(url) && !/^https?:\/\//i.test(url)) {
    if (!/^tvbox-xg:/i.test(url)) url = "tvbox-xg:" + url;
  }

  return JSON.stringify({
    parse:0,
    jx:0,
    url
  });
}

export function __jsEvalReturn() {
  return {init, home, homeVod, category, search, detail, play};
}
