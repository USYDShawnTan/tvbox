let cookie = "";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const API = "https://api.bilibili.com";
const WEB = "https://www.bilibili.com";

function headers() {
  const h = {
    "User-Agent": UA,
    "Referer": WEB + "/",
    "Origin": WEB
  };
  if (cookie) h["Cookie"] = cookie;
  return h;
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
}

function pic(value) {
  let url = String(value || "");
  if (!url) return "";
  if (url.startsWith("//")) url = "https:" + url;
  return url;
}

function formatDuration(sec) {
  sec = parseInt(sec || 0, 10);
  if (!Number.isFinite(sec) || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return [h, String(m).padStart(2,"0"), String(s).padStart(2,"0")].join(":");
  return [m, String(s).padStart(2,"0")].join(":");
}

async function json(url) {
  const res = await req(url, {
    method: "get",
    headers: headers(),
    timeout: 10000
  });
  const body = res && res.content ? res.content : "";
  try {
    return JSON.parse(body || "{}");
  } catch (e) {
    console.log("[bili] json parse failed " + url + " " + e.message);
    return {};
  }
}

function popularVod(item) {
  return {
    vod_id: item.bvid || "",
    vod_name: stripHtml(item.title),
    vod_pic: pic(item.pic),
    vod_remarks: (item.owner && item.owner.name ? item.owner.name + " · " : "") + formatDuration(item.duration)
  };
}

function searchVod(item) {
  return {
    vod_id: item.bvid || "",
    vod_name: stripHtml(item.title),
    vod_pic: pic(item.pic),
    vod_remarks: (item.author ? item.author + " · " : "") + String(item.duration || "")
  };
}

async function popular(page) {
  const obj = await json(API + "/x/web-interface/popular?pn=" + page + "&ps=20");
  if (obj.code !== 0 || !obj.data || !Array.isArray(obj.data.list)) {
    console.log("[bili] popular failed code=" + obj.code + " message=" + (obj.message || ""));
    return [];
  }
  return obj.data.list.map(popularVod).filter(v => v.vod_id && v.vod_name);
}

async function searchApi(keyword, page) {
  const url =
    API +
    "/x/web-interface/search/type?search_type=video&keyword=" +
    encodeURIComponent(keyword) +
    "&order=totalrank&page=" +
    page;

  const obj = await json(url);
  if (obj.code !== 0 || !obj.data || !Array.isArray(obj.data.result)) {
    console.log("[bili] search failed keyword=" + keyword + " code=" + obj.code + " message=" + (obj.message || ""));
    return [];
  }
  return obj.data.result.map(searchVod).filter(v => v.vod_id && v.vod_name);
}

async function init(cfg) {
  try {
    const ext = cfg && cfg.ext ? cfg.ext : {};
    if (typeof ext === "object" && ext.cookie) cookie = String(ext.cookie).trim();
  } catch (_) {}
}

async function home() {
  return JSON.stringify({
    class: [
      { type_id: "热门", type_name: "热门" },
      { type_id: "纪录片", type_name: "纪录片" },
      { type_id: "知识", type_name: "知识" },
      { type_id: "科技", type_name: "科技" },
      { type_id: "音乐", type_name: "音乐" },
      { type_id: "影视", type_name: "影视" }
    ]
  });
}

async function homeVod() {
  return JSON.stringify({ list: await popular(1) });
}

async function category(tid, pg) {
  pg = Math.max(1, parseInt(pg || "1", 10));
  const list = tid === "热门" ? await popular(pg) : await searchApi(tid, pg);
  return JSON.stringify({
    page: pg,
    pagecount: list.length ? pg + 1 : pg,
    limit: list.length,
    total: list.length ? 9999 : 0,
    list
  });
}

async function search(wd, quick, pg) {
  pg = Math.max(1, parseInt(pg || "1", 10));
  const list = await searchApi(wd, pg);
  console.log("[bili] search=" + wd + " results=" + list.length);
  return JSON.stringify({
    page: pg,
    pagecount: list.length ? pg + 1 : pg,
    list
  });
}

async function detail(id) {
  const bvid = String(id || "");
  const obj = await json(API + "/x/web-interface/view?bvid=" + encodeURIComponent(bvid));
  if (obj.code !== 0 || !obj.data) {
    console.log("[bili] detail failed bvid=" + bvid + " code=" + obj.code);
    return JSON.stringify({ list: [] });
  }

  const d = obj.data;
  const pages = Array.isArray(d.pages) && d.pages.length
    ? d.pages
    : [{ cid: d.cid, part: d.title, duration: d.duration }];

  const play = pages
    .filter(p => p && p.cid)
    .map((p, i) => {
      const name = stripHtml(p.part) || ("P" + (i + 1));
      return name.replace(/[$#]/g, " ") + "$" + bvid + "@@" + p.cid;
    })
    .join("#");

  const vod = {
    vod_id: bvid,
    vod_name: stripHtml(d.title),
    vod_pic: pic(d.pic),
    vod_year: d.pubdate ? new Date(d.pubdate * 1000).getFullYear().toString() : "",
    vod_area: d.tname || "",
    vod_actor: d.owner && d.owner.name ? d.owner.name : "",
    vod_content: d.desc || "",
    vod_remarks: "Bilibili",
    vod_play_from: "B站",
    vod_play_url: play
  };

  return JSON.stringify({ list: [vod] });
}

async function play(flag, id) {
  const parts = String(id || "").split("@@");
  const bvid = parts[0] || "";
  const cid = parts[1] || "";
  if (!bvid || !cid) return JSON.stringify({ parse: 0, url: "" });

  const url =
    API +
    "/x/player/playurl?bvid=" +
    encodeURIComponent(bvid) +
    "&cid=" +
    encodeURIComponent(cid) +
    "&qn=64&fnval=0&fnver=0&fourk=0";

  const obj = await json(url);
  const durl = obj && obj.data && Array.isArray(obj.data.durl) ? obj.data.durl : [];
  const playUrl = durl.length ? durl[0].url : "";

  if (!playUrl) {
    console.log("[bili] playurl failed bvid=" + bvid + " cid=" + cid + " code=" + obj.code);
    return JSON.stringify({ parse: 1, url: WEB + "/video/" + bvid });
  }

  return JSON.stringify({
    parse: 0,
    jx: 0,
    url: playUrl,
    header: {
      "User-Agent": UA,
      "Referer": WEB + "/"
    }
  });
}

export function __jsEvalReturn() {
  return { init, home, homeVod, category, detail, search, play };
}
