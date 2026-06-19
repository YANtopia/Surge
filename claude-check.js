/*
 * Claude 可用性检测面板（仿 CFGPT 思路）
 * 原理：请求 claude.ai 的 Cloudflare trace 接口，取出口国家代码，
 *       用 Anthropic 支持地区白名单判断是否可用。
 * 不直接打 API、不手动指定 policy —— 走 Surge 规则分流，
 *   claude.ai 会被你的规则匹配到 Claude 组出口。
 *
 * 可选 argument：
 *   icon=支持时图标  iconerr=不支持时图标
 *   icon-color=支持时颜色  iconerr-color=不支持时颜色
 *   title=自定义标题
 */

let url = "http://claude.ai/cdn-cgi/trace";

// Anthropic 官方支持的国家/地区白名单（ISO 3166-1 alpha-2）
// 来源：Anthropic supported countries，含主要可用区，不含 CN/HK/RU 等受限区
let supported = ["US","CA","GB","IE","AU","NZ","JP","KR","SG","TW","IN","ID","MY","TH","PH","VN",
"AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IS","IT","LV","LI","LT","LU",
"MT","NL","NO","PL","PT","RO","SK","SI","ES","SE","CH","UA","IL","AE","QA","KW","BH","OM","SA",
"ZA","NG","KE","GH","MX","BR","AR","CL","CO","PE","UY","EC","CR","PA","DO","JM","BS","BB","BZ",
"FJ","PG","BD","LK","NP","MN","KZ","GE","AM","AZ","MD","BA","MK","ME","RS","AL"];

// 解析 argument
let titlediy, icon, iconerr, iconColor, iconerrColor;
if (typeof $argument !== 'undefined') {
  const args = $argument.split('&');
  for (let i = 0; i < args.length; i++) {
    const [key, value] = args[i].split('=');
    if (key === 'title') titlediy = value;
    else if (key === 'icon') icon = value;
    else if (key === 'iconerr') iconerr = value;
    else if (key === 'icon-color') iconColor = value;
    else if (key === 'iconerr-color') iconerrColor = value;
  }
}

$httpClient.get(url, function(error, response, data){
  if (error) {
    console.log("Claude trace 请求失败: " + error);
    $done({
      title: titlediy || 'Claude 可用性',
      content: '✖️ 连接失败/超时',
      icon: iconerr || 'xmark.circle.fill',
      'icon-color': iconerrColor || '#FF3B30'
    });
    return;
  }

  // 解析 trace 返回（key=value 逐行）
  let cf = {};
  (data || "").split("\n").forEach(line => {
    let [k, v] = line.split("=");
    if (k) cf[k] = v;
  });

  let loc = cf.loc || "??";
  let ip = cf.ip || "";
  let flag = getFlag(loc);
  let ok = supported.indexOf(loc) !== -1;

  console.log(`Claude trace: loc=${loc}, ip=${ip}, 支持=${ok}`);

  let body = {
    title: titlediy || 'Claude 可用性',
    content: ok ? `✔️ 可用   出口: ${flag}${loc}` : `✖️ 区域受限   出口: ${flag}${loc}`,
    icon: ok ? (icon || 'checkmark.circle.fill') : (iconerr || 'xmark.circle.fill'),
    'icon-color': ok ? (iconColor || '#34C759') : (iconerrColor || '#FF3B30')
  };
  $done(body);
});

function getFlag(cc){
  if (!cc || cc.length !== 2) return '';
  if (cc.toUpperCase() === 'TW') cc = 'CN';
  return String.fromCodePoint(...cc.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
}
