import cheerio from "assets://js/lib/cheerio.min.js";

let host = "https://v.aikanbot.com";
const UA = "Mozilla/5.0 (Linux; Android 11; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DOUBAN_TIMEOUT = 3000;
const DOUBAN_CONCURRENCY = 3;
const PREFERRED_LINES = [
  { name: "量子", flags: ["lzm3u8", "lz线路", "lz"] },
  { name: "非凡", flags: ["ffm3u8", "ff"] },
  { name: "优质", flags: ["1080zyk", "1080zy"] },
  { name: "西瓜", flags: ["xigua", "xiguam3u8", "xgm3u8"] },
  { name: "快车", flags: ["kcm3u8", "kc"] }
];
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
    timeout: 8000,
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

function upgradeDoubanImage(url) {
  let value = String(url || "");
  if (!value) return "";
  value = value
    .replace("/view/photo/s_ratio_poster/public/", "/view/photo/l/public/")
    .replace("/view/photo/m/public/", "/view/photo/l/public/")
    .replace("/view/subject/s/public/", "/view/subject/l/public/")
    .replace("/view/subject/m/public/", "/view/subject/l/public/");
  return value;
}

async function fetchDoubanLargePic(type, id) {
  if (!id) return "";
  const kinds = [];
  if (type === "tv") kinds.push("tv", "movie");
  else kinds.push("movie", "tv");

  for (const kind of kinds) {
    try {
      const url =
        "https://frodo.douban.com/api/v2/" +
        kind +
        "/" +
        encodeURIComponent(id) +
        "?apikey=0ac44ae016490db2204ce0a042db2916";

      const res = await req(url, {
        method: "get",
        timeout: DOUBAN_TIMEOUT,
        headers: {
          "Host": "frodo.douban.com",
          "Connection": "Keep-Alive",
          "Referer": "https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html",
          "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36 MicroMessenger/7.0.9.501 NetType/WIFI MiniProgramEnv/Windows WindowsWechat"
        }
      });

      const body = res && res.content ? res.content : "";
      const data = JSON.parse(body || "{}");
      const raw =
        (data.pic && (data.pic.large || data.pic.normal)) ||
        data.cover_url ||
        "";

      if (raw) return upgradeDoubanImage(raw);
    } catch (_) {}
  }
  return "";
}

async function doubanPoster(name, year = "") {
  const titleKey = String(name || "").trim();
  const yearKey = String(year || "").trim();
  const cacheKey = titleKey + "::" + yearKey;
  if (!titleKey) return "";
  if (doubanPosterCache.has(cacheKey)) return doubanPosterCache.get(cacheKey);

  let result = "";
  try {
    const url =
      "https://frodo.douban.com/rexxar/api/v2/search/weixin?q=" +
      encodeURIComponent(titleKey) +
      "&start=0&count=20&apikey=0ac44ae016490db2204ce0a042db2916";

    const res = await req(url, {
      method: "get",
      headers: {
        "Host": "frodo.douban.com",
        "Connection": "Keep-Alive",
        "Referer": "https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html",
        "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36 MicroMessenger/7.0.9.501 NetType/WIFI MiniProgramEnv/Windows WindowsWechat"
      }
    });

    const body = res && res.content ? res.content : "";
    const data = JSON.parse(body || "{}");
    const items = Array.isArray(data.items) ? data.items : [];
    const target = normalizeTitle(titleKey);

    const candidates = items
      .map(item => ({
        item,
        target: item && item.target ? item.target : null
      }))
      .filter(x => {
        const t = x.target;
        if (!t) return false;
        const type = String(x.item.target_type || t.type || "");
        return type === "movie" || type === "tv";
      });

    let hit = candidates.find(x =>
      normalizeTitle(x.target.title) === target &&
      (!yearKey || String(x.target.year || x.item.year || "") === yearKey)
    );

    if (!hit) {
      hit = candidates.find(x => normalizeTitle(x.target.title) === target);
    }

    if (!hit) {
      hit = candidates.find(x => {
        const title = normalizeTitle(x.target.title);
        return title && target && (title.includes(target) || target.includes(title));
      });
    }

    if (!hit && candidates.length) hit = candidates[0];

    if (hit && hit.target) {
      const targetId = hit.target.id || hit.item.id || "";
      const targetType = String(hit.item.target_type || hit.target.type || "");

      // Prefer a high-resolution image already present in search results.
      // Most hits already contain pic.large or a URL that can be promoted
      // from s_ratio_poster/m to l/public, avoiding a second HTTP request.
      let raw =
        (hit.target.pic && hit.target.pic.large) ||
        hit.target.cover_url ||
        (hit.target.pic && (hit.target.pic.normal || hit.target.pic.small)) ||
        "";

      raw = upgradeDoubanImage(raw);

      // Only hit the detail endpoint when the search result truly has no image.
      if (!raw) raw = await fetchDoubanLargePic(targetType, targetId);

      if (raw) {
        raw = String(raw);
        if (raw.startsWith("//")) raw = "https:" + raw;
        if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw.replace(/^\/+/, "");

        result =
          raw +
          "@Referer=https://api.douban.com/@User-Agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36";
      }
    }

    console.log("[ikanbot-cover] douban=" + titleKey + (yearKey ? " (" + yearKey + ")" : "") + " poster=" + (result ? "ok" : "miss"));
  } catch (e) {
    console.log("[ikanbot-cover] douban poster lookup failed: " + titleKey + " " + e.message);
  }

  doubanPosterCache.set(cacheKey, result);
  return result;
}

async function fillDoubanPosters(list) {
  for (let i = 0; i < list.length; i += DOUBAN_CONCURRENCY) {
    const batch = list.slice(i, i + DOUBAN_CONCURRENCY);
    await Promise.all(batch.map(async item => {
      const poster = await doubanPoster(item.vod_name, item.vod_year || "");
      if (poster) item.vod_pic = poster;
    }));
  }
  return list;
}

function addVod(list, seen, id, name, image, remarks, year = "") {
  if (!id || !name || seen.has(id)) return;
  seen.add(id);
  list.push({
    vod_id: id,
    vod_name: name,
    vod_pic: pic(image),
    vod_remarks: remarks || "",
    vod_year: year || ""
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
      const titleText = root.find(".title-text:first").text().trim();
      const yearMatch = titleText.match(/(?:^|\s)(\d{4})\s*$/);
      const year = yearMatch ? yearMatch[1] : "";
      const cleanTitle = titleText.replace(/\s+\d{4}\s*$/, "").trim();

      addVod(
        list,
        seen,
        a.attr("href"),
        cleanTitle || img.attr("alt") || root.find("h5:first").text().trim(),
        img.attr("data-src") || img.attr("src"),
        root.find("span.label:first").text().trim(),
        year
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

  const $ = load(html);
  const hasMore = $("div.page-more a, ul.pagination a").toArray().some(a =>
    $(a).text().includes("下一页") || $(a).attr("rel") === "next"
  );

  console.log("[ikanbot-cover] search=" + wd + " results=" + list.length + " hasMore=" + hasMore);
  return JSON.stringify({
    page: pg,
    pagecount: hasMore ? pg + 1 : pg,
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
    try {
      items = JSON.parse(String(row.resData || "[]").replace(/#{2,}/g, "#"));
    } catch (_) {}

    for (const item of items) {
      if (!item || !item.flag || !item.url) continue;

      const flag = String(item.flag);
      const rawUrl = String(item.url).trim();
      if (!rawUrl) continue;

      const label = String(item.name || item.title || item.remarks || "播放")
        .replace(/[$#]/g, " ")
        .trim() || "播放";

      if (!groups.has(flag)) groups.set(flag, []);

      // getResN normally returns one episode object at a time:
      // {flag, name, url}. Build TVBox's "episode$url" ourselves
      // instead of concatenating raw line URLs.
      if (rawUrl.includes("#")) {
        for (const part of rawUrl.split("#")) {
          const value = String(part || "").trim();
          if (!value) continue;

          if (value.includes("$")) {
            const pos = value.indexOf("$");
            const epName = value.slice(0, pos).replace(/[$#]/g, " ").trim() || label;
            const epUrl = value.slice(pos + 1).trim();
            if (epUrl) groups.get(flag).push(epName + "$" + epUrl);
          } else {
            groups.get(flag).push(label + "$" + value);
          }
        }
      } else {
        groups.get(flag).push(label + "$" + rawUrl);
      }
    }
  }

  const from = [];
  const urls = [];
  const entries = Array.from(groups.entries()).map(([flag, values]) => ({
    flag: String(flag),
    lower: String(flag).toLowerCase(),
    values
  }));

  for (const pref of PREFERRED_LINES) {
    const hit = entries.find(entry =>
      pref.flags.some(flag => entry.lower === String(flag).toLowerCase())
    );
    if (!hit) continue;

    const seenUrls = new Set();
    const merged = hit.values.filter(Boolean).filter(entry => {
      const pos = String(entry).indexOf("$");
      const url = pos >= 0 ? String(entry).slice(pos + 1) : String(entry);
      if (!url || seenUrls.has(url)) return false;
      seenUrls.add(url);
      return true;
    });
    if (!merged.length) continue;

    from.push(pref.name);
    urls.push(merged.join("#"));
  }

  console.log("[ikanbot-cover] preferred lines=" + from.join(","));
  // "$$" separates playback lines; "#" separates episodes within a line.
  vod.vod_play_from = from.join("$$");
  vod.vod_play_url = urls.join("$$");

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
