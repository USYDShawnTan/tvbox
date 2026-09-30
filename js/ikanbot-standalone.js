import cheerio from "assets://js/lib/cheerio.min.js";

let host = "https://www1.ikanbot.com";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1";

function absolute(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return "https:" + value;
  return host + (value.startsWith("/") ? value : "/" + value);
}

async function request(url, headers = {}) {
  const res = await http(url, {
    method: "get",
    headers: Object.assign({
      "User-Agent": UA,
      "Referer": host + "/"
    }, headers)
  });
  return res && res.content ? res.content : "";
}

function load(html) {
  return cheerio.load(html || "");
}

function card($, item) {
  const a = $(item).is("a") ? $(item) : $(item).find("a:first");
  const img = $(item).find("img:first");
  const name =
    img.attr("alt") ||
    $(item).find("h5 a:first").text().trim() ||
    $(item).find("p:first").text().trim();

  return {
    vod_id: a.attr("href") || "",
    vod_name: name || "",
    vod_pic: absolute(img.attr("data-src") || img.attr("src") || ""),
    vod_remarks: $(item).find("span.label:first").text().trim() || ""
  };
}

function tokenFromPage($) {
  const currentId = $("#current_id").val();
  let eToken = $("#e_token").val();
  if (!currentId || !eToken) return "";

  const subId = String(currentId).slice(-4);
  const keys = [];

  for (let i = 0; i < subId.length; i++) {
    const curInt = parseInt(subId[i], 10);
    const splitPos = (Number.isNaN(curInt) ? 0 : curInt) % 3 + 1;
    keys.push(eToken.substring(splitPos, splitPos + 8));
    eToken = eToken.substring(splitPos + 8);
  }
  return keys.join("");
}

async function home() {
  return JSON.stringify({
    class: [
      { type_id: "movie", type_name: "电影" },
      { type_id: "tv", type_name: "剧集" }
    ],
    filters: {
      movie: [{
        key: "tag",
        name: "标签",
        init: "热门",
        value: ["热门","最新","经典","豆瓣高分","冷门佳片","华语","欧美","韩国","日本","动作","喜剧","爱情","科幻","悬疑","恐怖","治愈","豆瓣top250"].map(v => ({ n: v, v }))
      }],
      tv: [{
        key: "tag",
        name: "标签",
        init: "国产剧",
        value: ["热门","美剧","英剧","韩剧","日剧","国产剧","港剧","日本动画","综艺","纪录片"].map(v => ({ n: v, v }))
      }]
    }
  });
}

async function homeVod() {
  const html = await request(host);
  const $ = load(html);
  const list = [];
  $("div.v-list a.item").each((_, item) => {
    const v = card($, item);
    if (v.vod_id && v.vod_name) list.push(v);
  });
  return JSON.stringify({ list });
}

async function category(tid, pg, filter, extend) {
  pg = Math.max(1, parseInt(pg || 1, 10));
  const tag = extend && extend.tag ? extend.tag : (tid === "tv" ? "国产剧" : "热门");
  const base = "/hot/index-" + tid + "-" + encodeURIComponent(tag);
  const path = base + (pg > 1 ? "-p-" + pg : "") + ".html";
  const html = await request(host + path);
  const $ = load(html);
  const list = [];

  $("div.v-list a.item").each((_, item) => {
    const v = card($, item);
    if (v.vod_id && v.vod_name) list.push(v);
  });

  const hasMore = $("div.page-more a").filter((_, el) => $(el).text().includes("下一页")).length > 0;

  return JSON.stringify({
    page: pg,
    pagecount: hasMore ? pg + 1 : pg,
    limit: list.length,
    total: hasMore ? (pg + 1) * Math.max(list.length, 1) : pg * Math.max(list.length, 1),
    list
  });
}

async function search(wd, quick, pg) {
  pg = Math.max(1, parseInt(pg || 1, 10));
  const searchUrl = host + "/search?q=" + encodeURIComponent(wd) + "&p=" + pg;
  console.log("[ikanbot] search " + searchUrl);

  const html = await request(searchUrl);
  const $ = load(html);
  const list = [];

  $("div.media").each((_, item) => {
    const v = card($, item);
    if (v.vod_id && v.vod_name) list.push(v);
  });

  // The current Ikanbot search page may no longer use div.media.
  // Fall back to play links and deduplicate by href.
  if (list.length === 0) {
    const seen = new Set();

    $("a[href^='/play/']").each((_, a) => {
      const href = $(a).attr("href") || "";
      if (!href || seen.has(href)) return;

      const links = $("a[href='" + href.replace(/'/g, "\\'") + "']");
      let name = "";
      let pic = "";

      links.each((__, link) => {
        if (!name) {
          name = $(link).text().replace(/\s+/g, " ").trim();
        }
        const img = $(link).find("img:first");
        if (!pic && img.length) {
          pic = img.attr("data-src") || img.attr("src") || "";
          if (!name) name = img.attr("alt") || "";
        }
      });

      // Prefer a nearby heading when the thumbnail link itself has no text.
      if (!name) {
        const parent = $(a).parent();
        name =
          parent.find("h5:first").text().trim() ||
          parent.find("h4:first").text().trim() ||
          parent.find("h3:first").text().trim();
      }

      if (!name) return;

      const containerText = $(a).parent().parent().text().replace(/\s+/g, " ").trim();
      const lineMatch = containerText.match(/\[(\d+)条线路可播放\]/);

      seen.add(href);
      list.push({
        vod_id: href,
        vod_name: name,
        vod_pic: absolute(pic),
        vod_remarks: lineMatch ? lineMatch[1] + "条线路" : ""
      });
    });
  }

  console.log("[ikanbot] search results=" + list.length);

  const hasMore = $("div.page-more a").filter((_, el) => $(el).text().includes("下一页")).length > 0;

  return JSON.stringify({
    page: pg,
    pagecount: hasMore ? pg + 1 : pg,
    list
  });
}

async function detail(id) {
  const pageUrl = absolute(id);
  const html = await request(pageUrl);
  const $ = load(html);
  const detail = $("div.detail");

  const vod = {
    vod_id: id,
    vod_name: detail.find("h2").text().trim(),
    vod_pic: absolute($("div.item-root img:first").attr("data-src") || $("div.item-root img:first").attr("src") || ""),
    vod_remarks: "",
    vod_content: $("span#line-tips").text().trim() || "",
    vod_year: detail.find("h3:nth-child(3)").text().trim(),
    vod_area: detail.find("h3:nth-child(4)").text().trim(),
    vod_actor: detail.find("h3:nth-child(5)").text().trim()
  };

  const videoId = String(id).substring(String(id).lastIndexOf("/") + 1);
  const token = tokenFromPage($);
  const api = host + "/api/getResN?videoId=" + encodeURIComponent(videoId) + "&mtype=1&token=" + encodeURIComponent(token);

  const raw = await request(api, { "Referer": pageUrl });
  const json = JSON.parse(raw);
  const rows = json && json.data && Array.isArray(json.data.list) ? json.data.list : [];

  const playlist = {};
  for (const row of rows) {
    let data = [];
    try { data = JSON.parse(row.resData || "[]"); } catch (_) {}
    for (const item of data) {
      if (!item.flag || !item.url || playlist[item.flag]) continue;
      playlist[item.flag] = item.url;
    }
  }

  const order = { kuaikan: 1, bfzym3u8: 2, ffm3u8: 3, lzm3u8: 4 };
  const names = { kuaikan: "快看", bfzym3u8: "暴风", ffm3u8: "非凡", lzm3u8: "量子" };
  const entries = Object.keys(playlist)
    .map(key => ({ key, sort: order[key] || 5 }))
    .sort((a, b) => a.sort - b.sort);

  vod.vod_play_from = entries.map(e => names[e.key] || e.key).join("$$$");
  vod.vod_play_url = entries.map(e => playlist[e.key]).join("$$$");

  return JSON.stringify({ list: [vod] });
}

async function play(flag, id) {
  return JSON.stringify({
    parse: 0,
    url: id,
    header: {
      "User-Agent": UA,
      "Referer": host + "/"
    }
  });
}

export default {
  init() {},
  home,
  homeVod,
  category,
  detail,
  search,
  play
};
