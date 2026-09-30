import cheerio from "assets://js/lib/cheerio.min.js";

let host = "https://v.aikanbot.com";
const UA = "Mozilla/5.0 (Linux; Android 11; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const doubanPosterCache = new Map();

function abs(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return "https:" + url;
  return host + (url.startsWith("/") ? url : "/" + url);
}

function pic(url) {
  const value = abs(url);
  if (!value) return "";

  // FongMi understands the @Headers suffix on image URLs.
  // This mirrors the newer Ikanbot JAR behavior and avoids routing
  // every poster through img-p.aikanbot.com, which failed on the box.
  const headers = JSON.stringify({
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; V2049A Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36",
    "Referer": "https://www.douban.com"
  });
  return value + "@Headers=" + headers;
}

async function get(url, extra = {}) {
  const res = await req(url, {
    method: "get",
    headers: Object.assign({
      "User-Agent": UA,
      "Referer": host + "/"
    }, extra)
  });
  return res && res.content ? res.content : "";
}

function load(html) {
  return cheerio.load(html || "");
}

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s·•・:：!！?？,，.。\-—_()（）\[\]【】《》"'“”‘’]/g, "");
}

async function doubanPoster(name) {
  const key = String(name || "").trim();
  if (!key) return "";
  if (doubanPosterCache.has(key)) return doubanPosterCache.get(key);

  let result = "";
  try {
    const url = "https://movie.douban.com/j/subject_suggest?q=" + encodeURIComponent(key);
    const res = await req(url, {
      method: "get",
      headers: {
        "User-Agent": UA,
        "Referer": "https://movie.douban.com/"
      }
    });

    const data = JSON.parse(res && res.content ? res.content : "[]");
    if (Array.isArray(data) && data.length) {
      const target = normalizeTitle(key);
      let hit = data.find(item => normalizeTitle(item && item.title) === target);

      if (!hit) {
        hit = data.find(item => {
          const title = normalizeTitle(item && item.title);
          return title && (title.includes(target) || target.includes(title));
        });
      }

      if (!hit) hit = data[0];
      if (hit && hit.img) result = String(hit.img);
    }
  } catch (e) {
    console.log("[ikanbot-cover] douban poster lookup failed: " + key + " " + e.message);
  }

  doubanPosterCache.set(key, result);
  return result;
}

async function fillDoubanPosters(list) {
  for (const item of list) {
    const poster = await doubanPoster(item.vod_name);
    if (poster) item.vod_pic = poster;
  }
  return list;
}

function addVod(list, seen, id, name, image, remarks) {
  if (!id || !name || seen.has(id)) return;
  seen.add(id);
  list.push({
    vod_id: id,
    vod_name: name,
    vod_pic: pic(image),
    vod_remarks: remarks || ""
  });
}

function parseList(html, search = false) {
  const $ = load(html);
  const list = [];
  const seen = new Set();

  if (search) {
    $("div.media").each((_, el) => {
      const root = $(el);
      const a = root.find("a[href*='/play/']:first");
      const img = root.find("img:first");
      addVod(
        list,
        seen,
        a.attr("href"),
        root.find(".title-text:first").text().replace(/\s+\d{4}\s*$/, "").trim() ||
          img.attr("alt") ||
          root.find("h5:first").text().trim(),
        img.attr("data-src") || img.attr("src"),
        root.find("span.label:first").text().trim()
      );
    });

    $("a.cover-link").each((_, el) => {
      const a = $(el);
      const img = a.find("img:first");
      addVod(
        list,
        seen,
        a.attr("href"),
        img.attr("alt") || a.attr("title") || a.text().trim(),
        img.attr("data-src") || img.attr("src"),
        ""
      );
    });
  } else {
    $("div.v-list div.item, div#video-list div.item, a.item").each((_, el) => {
      const root = $(el);
      const a = root.is("a") ? root : root.find("a[href]:first");
      const img = root.find("img:first");
      addVod(
        list,
        seen,
        a.attr("href"),
        img.attr("alt") ||
          root.find("p:first").text().trim() ||
          root.find(".title:first").text().trim(),
        img.attr("data-src") || img.attr("src"),
        root.find("span.label:first").text().trim()
      );
    });
  }

  return list;
}

function token(currentId, eToken) {
  if (!currentId || !eToken) return "";
  let rest = String(eToken);
  const out = [];
  const tail = String(currentId).slice(-4);
  for (const ch of tail) {
    const n = parseInt(ch, 10);
    if (Number.isNaN(n)) continue;
    const start = n % 3 + 1;
    out.push(rest.substring(start, start + 8));
    rest = rest.substring(start + 8);
  }
  return out.join("");
}

async function init(cfg) {
  try {
    const ext = cfg && cfg.ext ? cfg.ext : {};
    if (typeof ext === "string" && ext.startsWith("http")) host = ext.replace(/\/$/, "");
    if (ext && typeof ext === "object" && ext.host) host = String(ext.host).replace(/\/$/, "");
  } catch (_) {}
}

async function home() {
  return JSON.stringify({
    class: [
      { type_id: "movie", type_name: "电影" },
      { type_id: "tv", type_name: "剧集" },
      { type_id: "billboard", type_name: "榜单" }
    ],
    filters: {
      movie: [{
        key: "class",
        name: "分类",
        init: "热门",
        value: ["热门","最新","经典","豆瓣高分","冷门佳片","华语","欧美","韩国","日本","动作","喜剧","爱情","科幻","悬疑","恐怖","成长","豆瓣top250"].map(v => ({ n:v, v }))
      }],
      tv: [{
        key: "class",
        name: "分类",
        init: "热门",
        value: ["热门","美剧","英剧","韩剧","日剧","国产剧","港剧","日本动画","综艺","纪录片"].map(v => ({ n:v, v }))
      }]
    }
  });
}

async function homeVod() {
  return JSON.stringify({ list: parseList(await get(host)) });
}

async function category(tid, pg, filter, extend) {
  pg = Math.max(1, parseInt(pg || "1", 10));
  let url;
  if (tid === "billboard") {
    url = host + "/billboard.html";
  } else {
    const cls = extend && extend.class ? extend.class : "热门";
    url = host + "/hot/index-" + tid + "-" + encodeURIComponent(cls) + (pg > 1 ? "-p-" + pg : "") + ".html";
  }
  const html = await get(url);
  const list = parseList(html);
  const $ = load(html);
  const hasMore = $("div.page-more a").toArray().some(a => $(a).text().includes("下一页"));
  return JSON.stringify({
    page: pg,
    pagecount: hasMore ? pg + 1 : pg,
    limit: list.length,
    total: Math.max(list.length, 1) * (hasMore ? pg + 1 : pg),
    list
  });
}

async function search(wd, quick, pg) {
  pg = Math.max(1, parseInt(pg || "1", 10));
  const url = host + "/search?q=" + encodeURIComponent(wd) + (pg > 1 ? "&p=" + pg : "");
  const html = await get(url);
  const list = parseList(html, true);

  // Ikanbot provides the playable result; Douban supplies a stable poster.
  // This mirrors the cover source used by csp_Douban rather than relying
  // on Ikanbot's image CDN / anti-hotlink behavior.
  await fillDoubanPosters(list);

  console.log("[ikanbot-cover] search=" + wd + " results=" + list.length);
  return JSON.stringify({
    page: pg,
    pagecount: list.length ? pg + 1 : pg,
    list
  });
}

async function detail(id) {
  const pageUrl = abs(id);
  const html = await get(pageUrl);
  const $ = load(html);

  const currentId = $("#current_id").attr("value") || "";
  const eToken = $("#e_token").attr("value") || "";
  const mtype = $("#mtype").attr("value") || "2";

  const name = $("h1:first").text().trim() || $("h2:first").text().trim();
  const rawPic = $("meta[property='og:image']").attr("content") ||
    $("div.item-root img:first").attr("data-src") ||
    $("div.item-root img:first").attr("src") || "";

  const vod = {
    vod_id: id,
    vod_name: name,
    vod_pic: pic(rawPic),
    vod_year: $("div.detail .year:first").text().trim() || $("div.detail h3:nth-child(3)").text().trim(),
    vod_area: $("div.detail .country:first").text().trim() || $("div.detail h3:nth-child(4)").text().trim(),
    vod_actor: $("div.detail .celebrity:first").text().trim() || $("div.detail h3:nth-child(5)").text().trim(),
    vod_content: $("meta[name='description']").attr("content") || $("span#line-tips").text().trim() || "",
    vod_remarks: ""
  };

  const api = host + "/api/getResN?videoId=" + encodeURIComponent(currentId || String(id).split("/").pop()) +
    "&mtype=" + encodeURIComponent(mtype) +
    "&token=" + encodeURIComponent(token(currentId, eToken));

  const raw = await get(api, {
    "Accept": "*/*",
    "Referer": pageUrl,
    "X-Requested-With": "XMLHttpRequest"
  });

  let rows = [];
  try {
    const obj = JSON.parse(raw);
    rows = obj && obj.data && Array.isArray(obj.data.list) ? obj.data.list : [];
  } catch (_) {}

  const groups = new Map();
  for (const row of rows) {
    let items = [];
    try { items = JSON.parse(row.resData || "[]"); } catch (_) {}
    for (const item of items) {
      if (!item || !item.flag || !item.url) continue;
      if (!groups.has(item.flag)) groups.set(item.flag, []);
      groups.get(item.flag).push(String(item.url).replace(/##/g, "#"));
    }
  }

  const from = [];
  const urls = [];
  for (const [flag, values] of groups.entries()) {
    from.push(String(flag).replace(/m3u8/gi, "线路"));
    urls.push(values.join("#"));
  }

  vod.vod_play_from = from.join("$$$");
  vod.vod_play_url = urls.join("$$$");

  return JSON.stringify({ list:[vod] });
}

async function play(flag, id) {
  return JSON.stringify({
    parse: 0,
    jx: 0,
    url: id,
    header: {
      "User-Agent": UA,
      "Referer": host + "/"
    }
  });
}

export function __jsEvalReturn() {
  return { init, home, homeVod, category, search, detail, play };
}
