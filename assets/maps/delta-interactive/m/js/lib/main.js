/* eslint-disable */

var IMG_PRE = window.DELTA_ASSET_ROOT.replace(/\/$/, '');


var getQuery = function (name) {
    var m = window.location.search.match(new RegExp('(\\?|&)' + name + '=([^&]*)(&|$)'));
    return !m ? '' : decodeURIComponent(m[2]);
};

function debounce(callback, delay) {
    let timerId;
   
    return function(...args) {
      clearTimeout(timerId);
   
      timerId = setTimeout(() => {
        callback.apply(this, args);
      }, delay);
    };
  }

  function copyToClipboard (text) {
    var textarea = document.createElement("textarea"); //创建临时的文本区域元素
    textarea.value = text; //将要复制的内容赋值给文本区域
    document.body.appendChild(textarea); //添加到页面中
    textarea.select(); //选中文本区域的内容
    try {
        var successful = document.execCommand('copy'); //执行复制命令
        var msg = successful ? '成功' : '失败';
        console.log('已经'+msg+'复制到剪贴板！');
    } catch (err) {
        console.error('无法复制到剪贴板', err);
    } finally {
        document.body.removeChild(textarea); //移除临时的文本区域元素
    }
}

var browser = {
    versions: (function () {
        var u = navigator.userAgent;
        return {
            mobile: !!u.match(/AppleWebKit.*Mobile.*/), // 移动终端
            Tablet: u.indexOf('Tablet') > -1 || u.indexOf('Pad') > -1 || u.indexOf('Nexus 7') > -1, // 平板
            ios: u.indexOf('like Mac OS X') > -1, // ios终端
            android: u.indexOf('Android') > -1 || u.indexOf('Adr') > -1, // android终端
            Safari: u.indexOf('Safari') > -1,
            Chrome: u.indexOf('Chrome') > -1 || u.indexOf('CriOS') > -1,
            IE: u.indexOf('MSIE') > -1 || u.indexOf('Trident') > -1,
            Edge: u.indexOf('Edge') > -1,
            QQBrowser: u.indexOf('QQBrowser') > -1,
            QQ: u.indexOf('QQ/') > -1,
            Wechat: u.indexOf('MicroMessenger') > -1,
            Weibo: u.indexOf('Weibo') > -1,
            360: u.indexOf('QihooBrowser') > -1,
            UC: u.indexOf('UC') > -1 || u.indexOf(' UBrowser') > -1,
            Taobao: u.indexOf('AliApp(TB') > -1,
            Alipay: u.indexOf('AliApp(AP') > -1,
            isMac: /macintosh|mac os x/i.test(navigator.userAgent),
            isSafari: /Safari/.test(u) && !/Chrome/.test(u)
        };
    })(),
    language: (navigator.browserLanguage || navigator.language).toLowerCase()
};

function findPad() {
    let width = window.innerWidth;
    let height = window.innerHeight;
    console.log('findPad', width);
    
    if ($('.pad_landscape').length) {
        return true;
    } else {
        return false;
    }
}

function detectNotchOrDynamicIsland() {
    const result = {
        hasNotch: false,
        hasDynamicIsland: false,
        deviceType: 'unknown',
        safeAreaTop: 0,
        screenInfo: {
            width: window.screen.width,
            height: window.screen.height,
            pixelRatio: window.devicePixelRatio || 1
        }
    };

    // 获取安全区域顶部距离
    const computedStyle = getComputedStyle(document.documentElement);
    const safeAreaTop = computedStyle.getPropertyValue('env(safe-area-inset-top)') || 
                        computedStyle.getPropertyValue('constant(safe-area-inset-top)');

    const safeAreaLef = computedStyle.getPropertyValue('env(safe-area-inset-)') || 
    computedStyle.getPropertyValue('constant(safe-area-inset-top)');
    
    if (safeAreaTop && safeAreaTop !== '0px') {
        result.safeAreaTop = parseInt(safeAreaTop);
        result.hasNotch = true;
    }

    // 检测iOS设备
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone;
    
    if (isIOS) {
        const { width, height } = window.screen;
        const pixelRatio = window.devicePixelRatio || 1;
        const actualWidth = width * pixelRatio;
        const actualHeight = height * pixelRatio;

        // iPhone X系列及以上设备尺寸检测
        const iphoneModels = {
            // iPhone X, XS
            'iPhone X/XS': { width: 1125, height: 2436 },
            // iPhone XR
            'iPhone XR': { width: 828, height: 1792 },
            // iPhone XS Max
            'iPhone XS Max': { width: 1242, height: 2688 },
            // iPhone 11
            'iPhone 11': { width: 828, height: 1792 },
            // iPhone 11 Pro
            'iPhone 11 Pro': { width: 1125, height: 2436 },
            // iPhone 11 Pro Max
            'iPhone 11 Pro Max': { width: 1242, height: 2688 },
            // iPhone 12 mini
            'iPhone 12 mini': { width: 1080, height: 2340 },
            // iPhone 12, 12 Pro
            'iPhone 12/12 Pro': { width: 1170, height: 2532 },
            // iPhone 12 Pro Max
            'iPhone 12 Pro Max': { width: 1284, height: 2778 },
            // iPhone 13 mini
            'iPhone 13 mini': { width: 1080, height: 2340 },
            // iPhone 13, 13 Pro
            'iPhone 13/13 Pro': { width: 1170, height: 2532 },
            // iPhone 13 Pro Max
            'iPhone 13 Pro Max': { width: 1284, height: 2778 },
            // iPhone 14
            'iPhone 14': { width: 1170, height: 2532 },
            // iPhone 14 Plus
            'iPhone 14 Plus': { width: 1284, height: 2778 },
            // iPhone 14 Pro (灵动岛)
            'iPhone 14 Pro': { width: 1179, height: 2556 },
            // iPhone 14 Pro Max (灵动岛)
            'iPhone 14 Pro Max': { width: 1290, height: 2796 },
            // iPhone 15
            'iPhone 15': { width: 1179, height: 2556 },
            // iPhone 15 Plus
            'iPhone 15 Plus': { width: 1290, height: 2796 },
            // iPhone 15 Pro (灵动岛)
            'iPhone 15 Pro': { width: 1179, height: 2556 },
            // iPhone 15 Pro Max (灵动岛)
            'iPhone 15 Pro Max': { width: 1290, height: 2796 }
        };

        // 检测具体设备型号
        for (const [model, dimensions] of Object.entries(iphoneModels)) {
            if ((actualWidth === dimensions.width && actualHeight === dimensions.height) ||
                (actualWidth === dimensions.height && actualHeight === dimensions.width)) {
                result.deviceType = model;
                result.hasNotch = true;
                
                // 检测是否有灵动岛
                if (model.includes('14 Pro') || model.includes('15 Pro') || model === 'iPhone 15' || model === 'iPhone 15 Plus') {
                    result.hasDynamicIsland = true;
                }
                break;
            }
        }

        // 如果没有匹配到具体型号，但有安全区域，则认为是刘海屏
        if (result.deviceType === 'unknown' && result.safeAreaTop > 0) {
            result.hasNotch = true;
            result.deviceType = 'Unknown iPhone with notch';
        }
    }

    // 检测Android设备
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isAndroid) {
        // Android设备通过安全区域和屏幕比例判断
        const { width, height } = window.screen;
        const aspectRatio = Math.max(width, height) / Math.min(width, height);
        
        // 如果屏幕比例大于2:1且有安全区域，很可能是刘海屏
        if (aspectRatio > 2.0 && result.safeAreaTop > 0) {
            result.hasNotch = true;
            result.deviceType = 'Android device with notch';
        }

        // 一些已知的Android刘海屏设备检测
        const userAgent = navigator.userAgent.toLowerCase();
        const androidNotchDevices = [
            'pixel 3', 'pixel 3 xl', 'pixel 4', 'pixel 4 xl',
            'oneplus 6', 'oneplus 6t', 'oneplus 7', 'oneplus 7 pro',
            'huawei p20', 'huawei p30', 'huawei mate 20',
            'xiaomi mi 8', 'xiaomi mi 9', 'xiaomi mi 10',
            'samsung galaxy s10', 'samsung galaxy s20', 'samsung galaxy s21'
        ];

        for (const device of androidNotchDevices) {
            if (userAgent.includes(device.replace(' ', ''))) {
                result.hasNotch = true;
                result.deviceType = `Android: ${device}`;
                break;
            }
        }
    }

    return result;
}

const deviceInfo = detectNotchOrDynamicIsland();
if (deviceInfo.hasNotch || deviceInfo.hasDynamicIsland) {
    $('.m-index').addClass('has-notch');
}



/**变量 */
const navCtn = $('.left-nav-ctn');
let pageSwiper = null;
let part3ListTop = true;
let part3ListBot = false;
let movePart3List = false;
let currScrollIndex = 0;
let footShow = false;

// 全面战场新全局变量
window.viewChange = true; // 进攻方视角

window.occupy = false; // 占领模式

window.warLv = 0; // 阶段

window.isLvChange = false;

window.warSwiper = null; // 部署swiper

window.pervInitX = '' // 上一次位移

// 导航相关
var navTypyList = $('.nav-type-list')
var regionList = $('.region-list')
var floorList = $('.floor-list')
var currLeftNav = 0;

// 全面战场模式
var isWar = false;
// 攻守方
var isAttack = true;

// 楼层模式
var isFloor = false;
var currFloorIndex = -1;
var currMapFloor = dabaFloor;
var outFloor = true;
var currFloorRegion = '';

function getFloorGroupMap() {
    var floorGroupMap = mapScaleInfo && mapScaleInfo.floorInfo && mapScaleInfo.floorInfo.info
        ? mapScaleInfo.floorInfo.info.floor
        : null;
    if (floorGroupMap && !Array.isArray(floorGroupMap) && typeof floorGroupMap === 'object') {
        return floorGroupMap;
    }
    return null;
}

function getFloorAliasMap() {
    return mapScaleInfo && mapScaleInfo.floorInfo && mapScaleInfo.floorInfo.info
        ? (mapScaleInfo.floorInfo.info.floorAliasMap || {})
        : {};
}

function normalizeFloorRegionName(regionName) {
    if (!regionName) return '';
    var aliasMap = getFloorAliasMap();
    return aliasMap[regionName] || regionName;
}

function resolveFloorList(regionName, fallbackToFlat) {
    var floorGroupMap = getFloorGroupMap();
    var normalizedRegionName = normalizeFloorRegionName(regionName);
    if (floorGroupMap) {
        if (normalizedRegionName && Array.isArray(floorGroupMap[normalizedRegionName])) {
            return floorGroupMap[normalizedRegionName];
        }

        var floorGroupKeys = Object.keys(floorGroupMap);
        for (var i = 0; i < floorGroupKeys.length; i++) {
            var floorGroupKey = floorGroupKeys[i];
            var floorGroupList = floorGroupMap[floorGroupKey];
            if (!Array.isArray(floorGroupList)) continue;

            if (
                normalizedRegionName &&
                (
                    floorGroupKey === normalizedRegionName ||
                    floorGroupKey.indexOf(normalizedRegionName) > -1 ||
                    normalizedRegionName.indexOf(floorGroupKey) > -1
                )
            ) {
                return floorGroupList;
            }

            for (var j = 0; normalizedRegionName && j < floorGroupList.length; j++) {
                if (floorGroupList[j].floor_name === normalizedRegionName) {
                    return floorGroupList;
                }
            }
        }

        return fallbackToFlat ? (Array.isArray(mapScaleInfo && mapScaleInfo.floor) ? mapScaleInfo.floor : []) : [];
    }

    if (Array.isArray(mapScaleInfo && mapScaleInfo.floor)) {
        if (!normalizedRegionName) {
            return mapScaleInfo.floor;
        }
        return mapScaleInfo.floor.filter(function (item) {
            return item.floor_name === normalizedRegionName;
        });
    }

    return [];
}

function getCurrentFloorList(regionName, shouldUpdateRegion) {
    var resolvedRegionName = regionName || currFloorRegion;
    if (!resolvedRegionName) {
        var activeRegionName = $.trim($('.region-item.action').text());
        if (activeRegionName) {
            resolvedRegionName = activeRegionName;
        }
    }
    if (!resolvedRegionName) {
        var floorGroupMap = getFloorGroupMap();
        if (floorGroupMap) {
            var floorGroupKeys = Object.keys(floorGroupMap);
            if (floorGroupKeys.length === 1) {
                resolvedRegionName = floorGroupKeys[0];
            }
        }
    }
    var floorItems = resolveFloorList(resolvedRegionName, true);
    if (shouldUpdateRegion !== false && resolvedRegionName) {
        currFloorRegion = normalizeFloorRegionName(resolvedRegionName);
    }
    return floorItems;
}

function getFloorItem(index, regionName, floorCode, shouldUpdateRegion) {
    var floorItems = getCurrentFloorList(regionName, shouldUpdateRegion);
    if (floorCode) {
        for (var i = 0; i < floorItems.length; i++) {
            if (floorItems[i].floor_f === floorCode) {
                return floorItems[i];
            }
        }
    }
    if (floorItems[index]) {
        return floorItems[index];
    }
    return null;
}

function getActiveFloorConfig(index, regionName, floorCode) {
    var floorItem = getFloorItem(index, regionName, floorCode);
    if (floorItem) {
        return floorItem;
    }
    var flatFloorList = mapScaleInfo && mapScaleInfo.floorInfo && mapScaleInfo.floorInfo.info && Array.isArray(mapScaleInfo.floorInfo.info.floor)
        ? mapScaleInfo.floorInfo.info.floor
        : [];
    return flatFloorList[index] || null;
}

function getFloorIndexByCode(floorItems, floorCode, fallbackIndex) {
    if (floorCode) {
        for (var i = 0; i < floorItems.length; i++) {
            if (floorItems[i].floor_f === floorCode) {
                return i;
            }
        }
    }
    if (floorItems[fallbackIndex]) {
        return fallbackIndex;
    }
    return -1;
}

function shouldRenderAllFloorItems() {
    if (!Array.isArray(mapScaleInfo && mapScaleInfo.floor)) {
        return false;
    }
    var floorAddressMap = {};
    for (var i = 0; i < mapScaleInfo.floor.length; i++) {
        var floorAddress = mapScaleInfo.floor[i].floor_address;
        if (floorAddress) {
            floorAddressMap[floorAddress] = true;
        }
    }
    return Object.keys(floorAddressMap).length > 1;
}

function getFloorListForRender() {
    if (shouldRenderAllFloorItems()) {
        return mapScaleInfo.floor;
    }
    return getCurrentFloorList();
}

// 判断导航数据是否为"分组形态"（[{titleType, title, typeList}]）；扁平条目数组（雷达站楼层 navList_ldz_*）返回 false。
// 酒店等既有楼层 navList_firest/navList_second 是分组形态 → 有真分类 tab，必须走 initNav 正常渲染；
// 雷达站楼层 navList_ldz_* 是扁平条目 → 无组概念，需整列渲染。
function isGroupedNav(arr) {
    return Array.isArray(arr) && arr.length > 0 && !!arr[0] &&
        !!arr[0].titleType && Array.isArray(arr[0].typeList);
}

function buildFloorItemKey(floorInfo) {
    if (!floorInfo) return '';
    return [
        floorInfo.floor_address || '',
        floorInfo.floor_name || '',
        floorInfo.floor_f || ''
    ].join('__');
}

function buildFloorMapPath(floorInfo, floorCode) {
    var resolvedFloorCode = floorInfo && floorInfo.floor_f ? floorInfo.floor_f : floorCode;
    if (!resolvedFloorCode) {
        return isZj ? `${currMap + currLv}_s` : `${currMap + currLv}`;
    }
    var floorPath = floorInfo && floorInfo.floor_address
        ? `${floorInfo.floor_address}_${resolvedFloorCode}`
        : resolvedFloorCode;
    return isZj ? `${currMap + currLv}_s_${floorPath}` : `${currMap + currLv}_${floorPath}`;
}

// 定义名称与类名的映射，实现可扩展性
const nameClassMap = {
    '保险箱': 'red',
    '小保险箱': 'red',
    '托卡马克面板': 'red',
    '乏燃料堆体': 'red',
    '燃料储罐': 'red',
    '应急仓': 'red',
    '仿星控制柱': 'red',
    '反应堆基座': 'red',
    '污水净化器': 'red',
    '服务器': 'orange',
    '电脑': 'orange'
};


var warNavText = {
    '全部': 'all',
    '据点': 'jd',
    '基地部署点': 'jdbsd',
    '载具': 'zj',
    '固定弹药箱': 'gddyx',
    '固定武器': 'gdwq',
    '载具补给站': 'zjbjz',
    '装置': 'zz'
}

var regionText = {
    0: 'A',
    1: 'B',
    2: 'C',
    3: 'D',
    4: 'E'
}

var queryMap = {
    'daba': '00',
    'cgxg': '10',
    'htjd': '21',
    'bks': '31',
    'cxjy': '42',
    'az3': '50',
}


// 导航相关
var navTypyList = $('.nav-type-list')
var regionList = $('.region-list')
var currLeftNav = 0;

// 地图相关
var visibleMarker = {};
var listIsAll = {
    0: false,
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
    7: false,
    8: false,
}
var visibleMarker2 = {
    0: {
        isAll: false,
        isInit: false,
        markers: {}
    },
    1: {
        isAll: false,
        isInit: false,
        markers: {}
    },
    2: {
        isAll: false,
        isInit: false,
        markers: {}
    },
    3: {
        isAll: false,
        isInit: false,
        markers: {}
    },
    4: {
        isAll: false,
        isInit: false,
        markers: {}
    },
    5: {
        isAll: false,
        isInit: false,
        markers: {}
    },
    6: {
        isAll: false,
        isInit: false,
        markers: {}
    },
    7: {
        isAll: false,
        isInit: false,
        markers: {}
    },
    8: {
        isAll: false,
        isInit: false,
        markers: {}
    }
};

function normalizeMarkerMode(mode) {
    return typeof mode === 'string' ? mode.trim() : '';
}

function getMarkerMode(item) {
    var itemMode = normalizeMarkerMode(item?.mode);
    if (itemMode) {
        return itemMode;
    }
    var pickupMode = normalizeMarkerMode(item?.['拾取条件']);
    if (pickupMode === '泄露区刷新' || pickupMode === '需要密钥才能开启') {
        return pickupMode;
    }
    return '';
}

function getMarkerFilterKey(item) {
    if (!item?.name) return '';
    var mode = getMarkerMode(item);
    return mode ? `${item.name}__${mode}` : `${item.name}__default`;
}

// ========== ★ 鱼类导航组（自 PC 版迁移，去国际化） ==========
// 静态 nav 数据（navList_az3 等）没有"鱼类"入口；地图点位数据 mapArticle_* 中 catalog==='fish'
// 的条目在此按 name__模式 聚合为第 N+1 组 tab（独立 tab，与 PC 版一致），同种鱼多个点位合并为 num。
// 只在有鱼的地图追加（无鱼不产生空组）；floor（楼层扁平 nav）与战争（isWar）流程不处理。
function buildFishGroup(icons) {
    var entryMap = {};
    var numMap = {};
    (Array.isArray(icons) ? icons : []).forEach(function (item) {
        if (!item || !item.name || item.catalog !== 'fish') return;
        var key = getMarkerFilterKey(item);
        numMap[key] = (numMap[key] || 0) + 1;
        if (entryMap[key]) return;
        var entry = { name: item.name, icon: item.icon ? 'nav_' + item.icon : 'nav_wz' };
        var mode = getMarkerMode(item);
        if (mode) entry.mode = mode;            // 携带 mode 保证 getMarkerFilterKey 与 marker 侧一致
        if (item.catalog) entry.catalog = item.catalog;
        if (item.sub_name) entry.sub_name = item.sub_name;
        entryMap[key] = entry;
    });
    var typeList = Object.keys(entryMap).map(function (k) {
        entryMap[k].num = numMap[k];
        return entryMap[k];
    });
    return { titleType: 'yl', title: '鱼类', typeList: typeList };
}
// 幂等追加"鱼类"组到导航组数组末尾（已存在 yl 组则原样返回）；当前地图无鱼时不追加
function ensureFishGroup(arr, icons) {
    if (!Array.isArray(arr) || !Array.isArray(icons)) return arr;
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].titleType === 'yl') return arr;
    }
    var group = buildFishGroup(icons);
    if (!group.typeList.length) return arr;
    return arr.concat([group]);
}
// 取导航组数组中的"鱼类"组条目列表（无鱼返回 []）。allNavList / navTypeList 各自持有独立的 yl 组对象，
// 故两边分别取，保持与 ensureFishGroup 一致的"各自构建"模式，避免跨数组共享同一批对象。
function getFishTypeList(arr) {
    if (!Array.isArray(arr)) return [];
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].titleType === 'yl') return Array.isArray(arr[i].typeList) ? arr[i].typeList : [];
    }
    return [];
}
// ★ 把鱼类条目注入"全部"组（allNavList[0] / titleType==='all'）
// 背景：默认视图走 renderNavTypeList(allNavList[0].typeList, 0)，而静态 nav（navList_az3[0]）里
// 一条 catalog==='fish' 都没有 —— 只有点「鱼类」tab 才走 navTypeList[N]。结果首屏「全部」看不到鱼。
// 实现约束：恒返回**新数组**、只替换 [0]，绝不原地 push（避免污染模块级静态 nav、重复注入无限膨胀）。
function injectFishIntoAll(arr, fishEntries) {
    if (!Array.isArray(arr) || !arr.length) return arr;
    if (!Array.isArray(fishEntries) || !fishEntries.length) return arr;
    var head = arr[0];
    if (!head || head.titleType !== 'all' || !Array.isArray(head.typeList)) return arr;
    // 按 filterKey 去重：已存在同名同 mode 的条目则跳过（重复渲染会被 renderNavTypeList 的 seenFilterKeys 吃掉，但 num 会算错）
    var existKeys = {};
    head.typeList.forEach(function (item) {
        if (item) existKeys[getMarkerFilterKey(item)] = true;
    });
    var added = fishEntries.filter(function (item) {
        return item && !existKeys[getMarkerFilterKey(item)];
    });
    if (!added.length) return arr;
    var newHead = {};
    for (var k in head) {
        if (Object.prototype.hasOwnProperty.call(head, k)) newHead[k] = head[k];
    }
    newHead.typeList = head.typeList.concat(added);
    return [newHead].concat(arr.slice(1));
}
// nav 列表里鱼图标的图片基址（与 marker 侧 refreshMarker2 同源的 CDN lv3 目录；本机 lv3 缺失部分鱼图）
var FISH_ICON_URL = '../img/lv3/';
function fishIconImg(item, cls) {
    var raw = (item && item.icon) ? String(item.icon).replace(/^nav_/, '') : 'wz';
    return `<div class="wz-icon ${cls || ''}" ><img src="${FISH_ICON_URL + raw}.png" style="width:100%;height:100%;object-fit:contain"/></div>`;
}

// ========== ★ 通用自定义区域绘制（自 PC 版迁移，去国际化） ==========
// 用法（纯数据操作，零接线）：
//   1. 区域数据挂在当前地图 poi（selectRegion_*）的条目上：加 points（"X=..,Y=..,Z=.." 数组，L.polygon 自动闭合）
//      和可选 style（{ color, weight, dashArray, fillOpacity }）；
//   2. 道具对象加 activeRegion: '<poi条目name>' 或 ['<name1>', '<name2>', ...]（一次高亮多个区域），
//      导航栏勾选该道具时绘制对应区域 polygon + 名称标注；取消勾选时按剩余勾选道具重算重绘。
//      同一区域被多个道具引用时同屏只画一份（drawnRegions 幂等）。
//   3. 子区域（可选）：条目加 children: [{ name, x, y, points, style? }, ...]——父被触发时跟随渲染，
//      每个子项画自己的 polygon + 子标题（锚点用 child.x/y），颜色缺省继承父色（child.style 可单独指定）；
//      父条目的 points 保留则照常画父轮廓 + 父标题，两者互不排斥；children 只一层、不可被 activeRegion 独立引用。
//   区域轮廓可用 scripts/build_game_world_points.js 从原图手动取点生成。
var regionLayers = [];                          // 已绘制区域图层（polygon + 名称标签），统一清理入口
var DEFAULT_REGION_COLOR = '#185FA5';           // 区域缺省描边/填充色（可被 region.color / style.color 覆盖）
var drawnRegions = {};                          // 已绘制区域名集合（drawRegion 幂等依据；clearRegions 时重置）

// 清理当前已绘制的所有自定义区域（polygon + 名称标签）；导航重算 / 切图 / 切楼层时调用
function clearRegions() {
    $.each(regionLayers, function () { this.remove(); });
    regionLayers = [];
    drawnRegions = {};
}

// 绘制一个自定义区域（poi 条目驱动）+ 名称标注；只画不清，配合 clearRegions 使用
function drawRegion(name) {
    // 幂等：同一区域同屏只画一份（多个道具引用同一 activeRegion 时不叠加）
    if (drawnRegions[name]) return;
    drawnRegions[name] = true;
    // 从当前地图 poi（selectRegion_*）按 name 找带 points 或 children 的条目（如核电站水域）
    var region = null;
    if (poiInfo && poiInfo.length) {
        for (var i = 0; i < poiInfo.length; i++) {
            if (poiInfo[i].name === name &&
                ((poiInfo[i].points && poiInfo[i].points.length) || (poiInfo[i].children && poiInfo[i].children.length))) {
                region = poiInfo[i];
                break;
            }
        }
    }
    if (!region) return;
    // 父区域：有 points 时绘制父 polygon + 父标题
    if (region.points && region.points.length) drawOneRegion(region, region.name);
    // 子区域：children 跟随父渲染；有 points 画 polygon + 子标题，仅 {name,x,y} 时只渲染子标题
    if (region.children && region.children.length) {
        region.children.forEach(function (child) {
            if (!child) return;
            var hasAnchor = (child.x != null && child.y != null &&
                             Number.isFinite(Number(child.x)) && Number.isFinite(Number(child.y))) ||
                            (child.labelX != null && child.labelY != null);
            if (!hasAnchor && !(child.points && child.points.length)) return;
            drawOneRegion(child, child.name);
        });
    }
}

// 绘制单个区域 polygon + 名称标注（父条目与 children 子项共用）；只画不清，配合 clearRegions 使用
function drawOneRegion(item, labelText) {
    var latlngs = null;
    // 顶点解析（与 drawBorder 同链路：filterPos → getMapPos）；无 points 时跳过 polygon 绘制
    if (item.points && item.points.length) {
        latlngs = item.points.map(function (str) {
            var pos = getMapPos(filterPos(str, 'X', ','), filterPos(str, 'Y', ',', 1));
            return [pos.y, pos.x];
        });
        var style = item.style || {};
        var color = style.color || item.color || DEFAULT_REGION_COLOR;
        regionLayers.push(L.polygon(latlngs, {
            color: color, fillColor: color,
            fillOpacity: style.fillOpacity != null ? style.fillOpacity : 0.15,
            weight: style.weight != null ? style.weight : 2,
            dashArray: style.dashArray || null,
            interactive: false
        }).addTo(map));
    }
    // 名称标注：优先 labelX/labelY，其次条目自带 x/y，缺省取顶点均值；interactive:false 避免遮挡
    var lp;
    if (item.labelX != null && item.labelY != null) {
        lp = getMapPos(item.labelX, item.labelY);
    } else if (item.x != null && item.y != null && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y))) {
        lp = getMapPos(item.x, item.y);
    } else if (latlngs) {
        var sumLat = 0, sumLng = 0;
        latlngs.forEach(function (ll) { sumLat += ll[0]; sumLng += ll[1]; });
        lp = { y: sumLat / latlngs.length, x: sumLng / latlngs.length };
    } else {
        return;
    }
    regionLayers.push(L.marker([lp.y, lp.x], {
        icon: L.divIcon({
            className: 'map-region-name',
            html: '<div class="region-item">' + (labelText || item.name) + '</div>'
        }),
        interactive: false
    }).addTo(map));
}

// 收集当前所有已勾选道具的 activeRegion（去重，供 syncRegions 渲染）
function collectActiveRegions() {
    var set = {};
    (Array.isArray(mapIcons) ? mapIcons : []).forEach(function (item) {
        if (!item || !item.activeRegion || !visibleMarker[getMarkerFilterKey(item)]) return;
        var list = Array.isArray(item.activeRegion) ? item.activeRegion : [item.activeRegion];
        list.forEach(function (rn) { if (rn) set[rn] = true; });
    });
    return Object.keys(set);
}

// 按当前勾选道具集合重绘自定义区域（refreshMarker2 尾部调用）；先清空再重画；drawRegion 幂等
function syncRegions() {
    if (isWar) return;
    clearRegions();
    collectActiveRegions().forEach(function (rn) { drawRegion(rn); });
}

var hoverMarker = {};
var clickMarker = {}
var ciLayer = null;
var typeListInit = false;
function Page() {
    var _this = this;
    _this.$page = $('.m-index')

    const navTypeList = $('.nav-option-ctn')

    // _this.$page.css('height', window.innerHeight)
    _this.init = function () {
        console.log(11111);
       _this.resizeDom();
        console.log('init');
        _this.isInit = true;
    }
    _this.sizeList = { 'ar' : true, 'en': true, 'zh-tw': true, 'ko': true, 'tr': true}
    var sizeAutoList = $('.sizeAuto');
    var scaleAutoList = $('.scaleAuto')
    _this.resizeDom = () => {
        if (window.innerHeight > window.innerWidth) {
            // 清除行内样式
            navTypeList.css('height', '')

            return;
        };
        if (isLandscapeType() === 'landscape') {
        //    navTypeList.css('height', 50 * (window.innerWidth / window.innerHeight) + 'vh')
            
        } else {

        }

        
    };

    window.onresize = function(e) {
        _this.resizeDom();
    }

    function isLandscapeType () {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // const userAgent = navigator.userAgent.toLowerCase();

    // 确保是横屏状态
    if (width <= height) {
        return null; // 非横屏状态
    }

    // 常规手机横屏：宽度小于768px且是移动设备
    const isRegularPhoneLandscape = width / height > 1.5;

    // 宽屏或折叠屏横屏：宽度大于等于768px
    const isWideOrFoldableLandscape = width / height <= 1.5;

    if (isRegularPhoneLandscape) {
        return 'landscape'; // 常规尺寸手机横屏
    } else if (isWideOrFoldableLandscape) {
        return 'pad_landscape'; // 宽屏或折叠屏横屏
    }

    return null;
}

}
var bksTop = ['-461305', '-460454', '-459334', '-460257', '-459631', '-459328.9688', '-458885', '-459003', '-458692']
var bksBom = ['-458000', '-457863', '-457854', '-457554', '-457310', '-457776', '-457320', '-457322', '-457830']

var mapScaleInfo = dabaInfo;
// var mapScaleInfo = gcInfo;
function getMapPos (posX, posY) {
    
    if (currLayer.name === 'bks_1f' || currLayer.name === 'map_bks2') {
        // console.log(posX, posY);
        
        if (bksTop.includes(posY)) {
            posX = Number(posX) + 700
            posY = Number(posY) - 200
        }
        if (bksBom.includes(posY)) {
            posX = Number(posX) + 900
            posY = Number(posY) + 200
        }
        if (posY === -459085) {
            posX = Number(posX) + 300
        }

    }
    var x = Number(posX)
    var y = Number(posY)
    var bj = isFloor ? mapScaleInfo.floorInfo.info.bj : 128
    // x轴转换计算公式：世界轴 / 设计稿宽度/2
    // x轴倍率：81086.304688 / 4096 = 19.79646110546875
    // var xB = 81086.304688 / 4096
    // 81086.304688 / 128
    var xB2 = mapScaleInfo.width / bj

    // y轴计算公式：世界轴 / 设计稿宽度/2
    // y轴倍率：80988.500000 / 4096 = 19.7725830078125
    // var yB = 80988.500000 / 4096 / -bj
    var yB2 = mapScaleInfo.height / bj
    
    // 世界中心轴x： 358155.687500； y： 750191.750000
    // return {x: bj - (mapScaleInfo.centerX - x ) / xB2, y: -bj - (mapScaleInfo.centerY + y ) / yB2}
    // currLayer.name === 'map_gc'|| currLayer.name === 'map_pc'
    if (currLayer.name.indexOf('cgxg') !== -1 || currLayer.name === 'map_yc2' || currLayer.name === 'map_yc'|| mapScaleInfo.rotate == 90) {

        return {x: bj - (mapScaleInfo.centerY + y ) / yB2, y: -bj + (mapScaleInfo.centerX - x ) / xB2}
    } else if (mapScaleInfo.rotate === -90) {
        return {x: bj + (mapScaleInfo.centerY + y ) / yB2, y: -bj - (mapScaleInfo.centerX - x ) / xB2}
    } else{
        return {x: bj - (mapScaleInfo.centerX - x ) / xB2, y: -bj - (mapScaleInfo.centerY + y ) / yB2}
    }
    // return {x: 127, y: -68}
}
new Page().init();

        // 项目初始化的一些函数
        var initProject = function () {
            // 阻止微信下拉；原生js绑定覆盖zepto的默认绑定
            // document.body.addEventListener('touchmove', function (e) {
            //     e.preventDefault();
            // }, { passive: false });
        
            /** 解决ios12微信input软键盘收回时页面不回弹，兼容动态添加dom(腾讯登录组件)的情况 */
            var resetScroll = (function () {
                var timeWindow = 500;
                var timeout; // time in ms
                var functionName = function (args) {
                    let inputEl = $('input, select, textarea');
                    // TODO: 连续添加元素时，可能存在重复绑定事件的情况
                    inputEl && inputEl.on('blur', () => {
                        var scrollHeight = document.documentElement.scrollTop || document.body.scrollTop || 0;
                        window.scrollTo(0, Math.max(scrollHeight, 0));
                    });
                };
        
                return function () {
                    clearTimeout(timeout);
                    timeout = setTimeout(function () {
                        functionName.apply();
                    }, timeWindow);
                };
            }());
        };
    initProject();

    var getImgName = function (str, search) {
        let lastIndex = str.lastIndexOf(search);
        let newStr = str.slice(lastIndex + 1)
        return newStr.split('.')[0];
    }

// 全部icon
var allNavList = navList;
// 单个大类
var navTypeList = navListInfo;
// icon地图映射
var mapIcons = mapArticle;

var poiInfo = selectRegion;

// var allNavList = navList_cgxg;
// // 单个大类
// var navTypeList = navListInfo_cgxg;
// // icon地图映射
// var mapIcons = mapArticle_cgxg;

var isRemove = false;

var poiList = []

// 当前地图
var currLayer;

// 标点
	var map
    var mapFolder = '0_4/'
    var cacheMarker = [];
    var removeCacheMarker = [];
    var markerList = [];
    var currClickMarker;
    var warMark = [];
    var borderList = [];


    // 切换地图
    var dom_changeMapBtn = $('.curr-map-name')
    var dom_mapList = $('.map-list')
    var dom_warList = $('.war-list')
    var dom_map_lv = $('.curr-map-lv')
    var dom_map_lv_list = $('.map-lv-list')
    var dom_war_lv_list = $('.war-lv-list')
    var currMap = '0';
    var clickMap = '0';
    var currLv = '0'
    var currWarMap = 'gc';
    var currWarType = 'pc';
    var isZj = false;
    var mapChangeIsClick = false;
    var mapLvIsClick = false;
    var rightNavIsClick = false;

    var mapMenuIsShow = false;

    var showCheck = false;

    var saveMarker = {}; // 切换楼层前保存的点位
    var currNavIcon = ''; // 当前选择的icon
    var NavCliciIndex = 1;
    var chooseItemLvName = ''; // 选择的难度名称


var markerPop = $('.marker-pop-ctn')
var markerName = $('.marker-pop-ctn .marker-name')
var addressName = $('.marker-pop-ctn .address-name')

function refreshMarker2(from, arr) {
    $.each(cacheMarker, function () {
        if (this.options.icon?.polyline) {
            this.options.icon?.polyline.remove();
            this.options.icon?.polyline2.remove();
        }
        this.remove();
    
    });
    isRemove = true;
    cacheMarker = [];
    markerList = []
    // ★ 清理自定义区域图层（activeRegion 绘制），避免切图/切楼层/切难度残留（自 PC 版迁移）
    clearRegions();

    $.each(arr, function (index, item) {
        var visible = false;
        var that = this;
        var markerFilterKey = getMarkerFilterKey(item);
        if (from === "filter" && visibleMarker[markerFilterKey]) visible = true;
        if (from === "filter" && visibleMarker[getMarkerFilterKey({ name: '出生点' })] && item.type === 'revive') {
            visible = true;
        }
        if (from === "filter" && visibleMarker[getMarkerFilterKey({ name: '首领' })] && item.type === 'Boss') {
            visible = true;
        }
        if (from === "filter" && visibleMarker[getMarkerFilterKey({ name: '行动接取站' })] && item.type === 'move') {
            visible = true;
        }
        if (from === "filter" && visibleMarker[getMarkerFilterKey({ name: '高价值' })] && item.type === 'move') {
            visible = true;
        }
        if (visible) {
            if (item['自定义区域']) {
                var popupHtml = `
                <div class="name">${this?.sub_name || this.name}${item['自定义区域'] !== ''? `<span> ( ${item['自定义区域']} ) </span>`: ''}</div>
                 <div class="btn-floor" data-floor=${this.floor}></div>
                <div class="address">地点：<span>${item['自定义区域']}</span></div>
            `;
            } else {
                var popupHtml = `
                <div class="name">${this?.sub_name || this.name}${item['自定义区域'] !== ''? `<span> ( ${item['自定义区域']} ) </span>`: ''}</div>
                 <div class="btn-floor" data-floor=${this.floor}></div>
            `;
            }
          


            popupHtml += '</div>';

            var className = ''
            if (item?.type) {
                className =  item.type
            } else {
                className =  'article'
            }
            var pos = getMapPos(this.x, this.y)
            var path = isWar ? '../img/dzc_i/' : '../img/lv3/'
            var iconName;
            if (that.name === "进攻方基地" ) {
                iconName = window.viewChange ? 'g_jdbsd_g': 'g_jdbsd_r'
            } else if (that.name === "防守方基地") {
                iconName = window.viewChange ? 'f_jdbsd_r': 'f_jdbsd_g'
            } else {
                iconName = that.icon
            }
            if (this.icon) {
                let rotate = currWarMap === 'qhz' ? 90 : 180
                var myIcon =  L.divIcon({
                    className: `${isWar ? 'map-war-icon' : 'map-icon'} ${nameClassMap[that.name] || ''}`,
                    html: `<div class="map-icon-bg" style="${that?.rotate ? `transform: translate3d(-50%, -50%, 0) rotate(${Number(that?.rotate) + rotate}deg)` : ''}"><img src="${path + iconName}.png"/><text class="marker-order" style="${that?.index ? `display: block;` : 'display: none;'}">#${that?.index}</text></div>`,
                    iconSize: [30, 30],			//设置图标大小
                    iconAnchor: [15, 15],		//设置图标偏移
                })

                if (that.name === '电梯撤离点' && that.point1) {
                    var pos1 = getMapPos(that.point1.x, that.point1.y)
                    var pos2 = getMapPos(that.point2.x, that.point2.y)
                    var latlngs1 = [
                        [pos1.y, pos1.x],
                        [pos.y, pos.x]  // 添加终点坐标
                    ];
                    var latlngs2 = [
                        [pos2.y, pos2.x],
                        [pos.y, pos.x]  // 添加终点坐标
                    ];
                    
                    myIcon.polyline = L.polyline(latlngs1, {
                        color: '#EAEBEB',
                        dashArray: '10, 10',  // 虚线样式：10px线段，10px间隔
                        weight: 2
                    }).addTo(map);
                    myIcon.polyline2 = L.polyline(latlngs2, {
                        color: '#EAEBEB',
                        dashArray: '10, 10',  // 虚线样式：10px线段，10px间隔
                        weight: 2
                    }).addTo(map);
                }

                myIcon.name = that.name;
                
                cacheMarker.push(L.marker([pos.y, pos.x], {icon:  myIcon, zIndexOffset: that.name === currNavIcon ? NavCliciIndex + 1 : NavCliciIndex}).bindPopup(popupHtml).addTo(map).on({
                    click: function () {
                        document.getElementById('MapContainer').classList.remove('zooming');
                        currClickMarker?.setIcon(currClickMarker?.myIcon)
                        this.isClick = true;
                        this.myIcon = myIcon;
                        if (that?.floor || that?.floor === 0) {
                            var popupFloorInfo = getFloorItem(that.floor, item['自定义区域'], null, false);
                            $('.leaflet-popup').addClass('floor')
                            $('.btn-pop-floor').attr('data-name', that.name)
                            $('.btn-pop-floor').attr('data-floor', popupFloorInfo?.floor_f || mapScaleInfo?.floor[that.floor]?.floor_f || '')
                            $('.btn-pop-floor').attr('data-index', that.floor)
                            $('.btn-pop-floor').attr('data-region', item['自定义区域'] || '')
                        } else {
                            $('.leaflet-popup').removeClass('floor')
                        }
                        this.openPopup();
                        this.setIcon( L.divIcon({
                            className: `${isWar ? 'map-war-icon' : 'map-icon'} click ${nameClassMap[that.name] || ''}`,
                            html: `<div class="map-icon-bg" style="${that?.rotate ? `transform: translate3d(-50%, -50%, 0) rotate(${Number(that?.rotate) + rotate}deg)` : ''}"><img src="${path + iconName}.png"/><text class="marker-order" style="${that?.index ? `display: block;` : 'display: none;'}">#${that?.index}</text></div>`,
                            iconSize: [50, 50],			//设置图标大小
                            iconAnchor: [25, 25],		//设置图标偏移
                        }));
                        currClickMarker = this;
                        $(this.getElement()).addClass('click')
                        if (item['随机']) {
                            markerName.html(`${ that?.sub_name || that.name}${item['拾取条件'] && item['拾取条件'] !== ''? `<span> ( ${item['拾取条件']} ) </span>`: ` [${item['随机']}]`}`)
                        } else if (item['撤离条件']) {
                            markerName.html(`${ that?.sub_name || that.name}${item['撤离条件'] && item['撤离条件'] !== ''? `<span> ( ${item['撤离条件']} ) </span>`: ` [${item['撤离条件']}]`}`)
                        } else if (item?.img) {
                            $('.marker-preview').attr('src', item?.img)
                            markerName.html(`${ that?.sub_name || that.name}`)
                        } else {
                            var markerCondition = item['拾取条件'] || item['出现条件'] || '';
                            markerName.html(`${ that?.sub_name || that.name}${markerCondition !== '' ? `<span> ( ${markerCondition} ) </span>` : ''}`)
                        }
                        if (this.myIcon.name.indexOf('基地') > -1) {
                            initWarSwiper(this.myIcon.name, that);
                        }
                        // this?.remove()
                       
                        addressName.html(that['自定义区域'])
                        if (that['自定义区域']) {
                            $('.address').show();
                        } else {
                            $('.address').hide();
                        }
                        if (item?.img) {
                            $('.marker-preview-ctn').show();
                        } else {
                            $('.marker-preview-ctn').hide();
                        }
                        markerPop.addClass('show')
                        console.log('that', that);
                        $('.marker-pop-ctn').removeClass('preview')
                        // 如果有楼层，则显示楼层按钮
                        if (that?.floor || that?.floor === 0) {
                            $('.marker-pop-ctn').attr('data-floor', that.floor)
                            $('.marker-pop-ctn').attr('data-name', that.name)
                            $('.marker-pop-ctn').attr('data-index', index)
                            $('.marker-pop-ctn').addClass('floor')
                        } else if (that?.index) {
                            $('.marker-pop-ctn').addClass('preview')
                        } else {
                            $('.marker-pop-ctn').removeClass('floor')
                           
                        }
                    },
                    popupclose: function () {
                        markerPop.removeClass('show')
                    }
                }))
            }
            
        }
      
    });
    isRemove = false;
    // ★ 区域重绘（自 PC 版迁移）：marker 重建后按当前勾选集合绘制 activeRegion 多边形/水域；isWar 内部已跳过
    syncRegions();
}



function toggleVisible(type, index) {
    
    switch (type) {
        case "0_all":
        case "1_all":
        case "2_all":
        case "3_all":
        case "4_all":
        case "5_all":
            renderMarker()
            break;
        case "0_none":
        case "1_none":
        case "2_none":
        case "3_none":
        case "4_none":
        case "5_none":
          
            renderMarker()
            isWar ? $('.map-war-icon').remove() : $('.map-icon').remove();
            console.log('删除', $('.map-icon').remove());
            break;
        case "none":
            isWar ? $('.map-war-icon').remove() : $('.map-icon').remove();
            currClickMarker?.remove();
            renderMarker2()
            break;
    
        default:
            visibleMarker[type] = visibleMarker[type] ? false : true;
            break;
    }
    $('.deploy-swiper').removeClass('show')
    function renderMarker () {
        if (Number(currLeftNav) === 0) {
            console.log(visibleMarker);
            
            for (var o in visibleMarker) {
                if (visibleMarker.hasOwnProperty(o)) {
                    visibleMarker[o] = (type.indexOf('all') > 0 ? true : false);
                }
            }
        } else {
            for (let index = 0; index < navTypeList[currLeftNav].typeList.length; index++) {
                const element = navTypeList[currLeftNav].typeList[index];
                visibleMarker[getMarkerFilterKey(element)] = (type.indexOf('all') > 0 ? true : false);
            }
        }
       
    }

    function renderMarker2 () {
        for (var o in visibleMarker) {
            if (visibleMarker.hasOwnProperty(o)) {
                visibleMarker[o] = (type.indexOf('all') > 0 ? true : false);
            }
        }
       
    }

    refreshMarker2("filter", mapIcons);
}




var init = function () {
    var mapWidth = isFloor ? mapScaleInfo.floorInfo.info.boundsW : mapScaleInfo.boundsW;  
    var mapHeight = isFloor ? mapScaleInfo.floorInfo.info.boundsH :mapScaleInfo.boundsH;  
    // var mapOrigin = L.latLng(0, 0);
    var mapOrigin = isWar ? L.latLng(0, 0) : L.latLng(0, 0);
    var pixelToLatLngRatio = -1;
    var southWest = mapOrigin; // 左上角  
    var northEast = L.latLng((mapHeight) * pixelToLatLngRatio, mapWidth * pixelToLatLngRatio); // 右下角  
    var bounds = L.latLngBounds(southWest, northEast);  

    map = L.map('MapContainer', {
        crs: L.CRS.Simple,
        attributionControl: false,
        zoomControl: false,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0,
        minZoom: mapScaleInfo.minZoom,
        maxZoom: 8,
        // preferCanvas: true,
        smoothSensitivity: 1,   // zoom speed. default is 1
        zoomSnap: .1,
        wheelDebounceTime: 10
    }).setView([mapScaleInfo.initX,  mapScaleInfo.initY], mapScaleInfo.initZoom);
    // let control = new L.Control.Zoomslider()
    // map.addControl(control);
    window.pervInitX = mapScaleInfo.initX
    addLayer('map_db');
    if (queryMap[getQuery('map')]) {
        let getMap = queryMap[getQuery('map')];
        currMap = getMap[0];
        currLv = getMap[1];
        clickMap = getMap[0];
        changeMapLv(getMap);
        if (getQuery('map') === 'cgxg' || getQuery('map') === 'htjd') {
            
            $('.zj-ctn').addClass('show')   
            $('.curr-random').css('display', 'block')
            $('.random-list').removeClass('close')
        }
    }

    if (getQuery('map').indexOf('dzc') !== -1) {
        enterWarMap();
    }
    // addLayer('daba_1f');

    map.on('click', function(e) {
        if (currClickMarker) {
            currClickMarker.setIcon(currClickMarker.myIcon)
            $('.deploy-swiper').removeClass('show')
        }
     });
 
     $('.leaflet-popup-pane').on('click', (e) => {
         console.log(e);
         console.log(currClickMarker);
         currClickMarker?.closePopup();
         currClickMarker?.setIcon(currClickMarker.myIcon)
         $('.deploy-swiper').removeClass('show')
     })

    // ★ 鱼类导航组（与 changeMapLv→applyMapConfig 内 ensureFishGroup/injectFishIntoAll 注入同款）：首屏默认
    // 路径（无 ?map= 时不走 changeMapLv）直接 initNav，静态 nav 无鱼类组/鱼条目 → 鱼点位无 nav 入口可点亮、
    // 地图不显示鱼。此处补同样注入保证首屏有鱼；ensureFishGroup 幂等、injectFishIntoAll 去重恒返新数组，
    // query 参数路径（applyMapConfig 已注入）在此重复执行无副作用。
    if (!isWar && !isFloor) {
        allNavList = ensureFishGroup(allNavList, mapIcons);
        navTypeList = ensureFishGroup(navTypeList, mapIcons);
        allNavList = injectFishIntoAll(allNavList, getFishTypeList(allNavList));
    }

    initNav();
    // 如果有floor，则初始化floor
    if (mapScaleInfo.floorInfo) {
        initFloor();
    } else{
        $('.btn-floor-mod').removeClass('show')
    }
    bindEvent();
};

// 边界数组转换
function filterPos (str, char1, char2, i) {
    var index = str.indexOf(char1);
    var index2 = str.indexOf(char2, index + 1);
    // console.log(index, index2);
    
    if (index != -1 && index2 != -1) {
        return str.slice(index + 2, index2);
    }
    return str;
}


// 绘制边界
function drawBorder (color, border, isJd = false){ 

    var latlngs = [];
   

    for (let index = 0; index < border.length; index++) {
        const element = border[index];
        let x = filterPos(element, 'X', ',')
        let y = filterPos(element, 'Y', ',', 1)
        var pos = getMapPos(x, y)
        latlngs.push([pos.y, pos.x])
    }

    // 全地图边界
    let fourLatlng = [[0, mapScaleInfo.boundsW * -1],[-mapScaleInfo.boundsH, mapScaleInfo.boundsW * -1],[-mapScaleInfo.boundsH, -mapScaleInfo.boundsW * -1], [0, -mapScaleInfo.boundsW * -1]];
    var latlngs2 = [latlngs]
    

    // // 绘制且添加
    // transparent
    // if (isAttack) {
    //     var polyline = L.polyline(latlngs, {color: 'red'}).addTo(map);
    // } else {
    //     var polyline = L.polyline(latlngs, {color: 'green'}).addTo(map);
    // }
   
    
    if (isJd) {
        let colors
        if (window.occupy) {
            colors = 'white'
        } else {
            colors = window.viewChange ? 'red' : color
        }
        console.log('colors', colors);
        
        const line = L.polygon(latlngs, {color: colors, fillColor: colors, weight: 3, stroke: false}).addTo(map)
        const line2 = L.polygon(latlngs, {color: colors, fillColor: colors, weight: 3, stroke: false}).addTo(map)
        const line3 = L.polygon(latlngs, {color: colors, fillColor: colors, weight: 3, stroke: false}).addTo(map)
        const line4 = L.polyline(latlngs, {color: colors}).addTo(map)
        // line.bringToFront();
        
        borderList.push(line);
        borderList.push(line2);
        borderList.push(line3);
        borderList.push(line4);
    } else {
        borderList.push(L.polyline(latlngs, {color}).addTo(map));
    }
   
    // var polygon = L.polygon(latlngs, { color: "transparent"}).addTo(map);

    // polygon.on('click', (e) => {
    //     console.log(1, e);
    //     polyline.setStyle({color: 'red'});
    // })
}

function addLayer (mapName) {
    if (currLayer && map.hasLayer(currLayer)) {
        map.removeLayer(currLayer);
    }
    var mapWidth
    var mapHeight

    var minZoom, initZoom, initX, initY
    var mapOrigin
    var pixelToLatLngRatio;
    var southWest; // 左上角  
    if (window.occupy) {
        mapWidth = mapScaleInfo.boundsW_s
        mapHeight = mapScaleInfo.boundsH_s
        southWest = L.latLng(0, 0)
        pixelToLatLngRatio = -1
    } else if (isFloor) {
        var currentFloorConfig = getActiveFloorConfig(currFloorIndex, currFloorRegion);
        if (!currentFloorConfig) {
            currentFloorConfig = mapScaleInfo && Array.isArray(mapScaleInfo.floor) ? mapScaleInfo.floor[currFloorIndex] : null;
        }
        mapWidth = currentFloorConfig ? currentFloorConfig.boundsW : mapScaleInfo.floorInfo.info.boundsW
        mapHeight = currentFloorConfig ? currentFloorConfig.boundsH : mapScaleInfo.floorInfo.info.boundsH

        // southWest = L.latLng(-25, 55)
        // pixelToLatLngRatio = -0.85
        // mapWidth = mapScaleInfo.boundsW
        // mapHeight = mapScaleInfo.boundsH
        console.log(mapScaleInfo.floorInfo.info.latLngX, mapScaleInfo);
        
        southWest = L.latLng(
            currentFloorConfig ? currentFloorConfig.latLngX : mapScaleInfo.floorInfo.info.latLngX,
            currentFloorConfig ? currentFloorConfig.latLngY : mapScaleInfo.floorInfo.info.latLngY
        )
        pixelToLatLngRatio = currentFloorConfig && currentFloorConfig.pixelToLatLngRatio
            ? currentFloorConfig.pixelToLatLngRatio
            : mapScaleInfo.floorInfo.info.pixelToLatLngRatio
    } else if (isWar) {
        mapWidth = mapScaleInfo.boundsW
        mapHeight = mapScaleInfo.boundsH
        southWest = L.latLng(0, 0)
        pixelToLatLngRatio = -1
    } else {
        mapWidth = mapScaleInfo.boundsW
        mapHeight = mapScaleInfo.boundsH
        southWest = L.latLng(0, 0)
        pixelToLatLngRatio = -1
    }
    var northEast = L.latLng((mapHeight) * pixelToLatLngRatio, mapWidth * pixelToLatLngRatio); // 右下角  
    if (window.occupy) {
        minZoom = mapScaleInfo.minZoom_s
        initZoom = mapScaleInfo.initZoom_s
        initX = mapScaleInfo.initX_s
        initY = mapScaleInfo.initY_s
    } else if (isFloor) {
        minZoom = currentFloorConfig ? currentFloorConfig.minZoom : mapScaleInfo.floorInfo.info.minZoom
        initZoom = currentFloorConfig ? currentFloorConfig.initZoom : mapScaleInfo.floorInfo.info.initZoom
        initX = currentFloorConfig ? currentFloorConfig.initX : mapScaleInfo.floorInfo.info.initX
        initY = currentFloorConfig ? currentFloorConfig.initY : mapScaleInfo.floorInfo.info.initY;
        
    } else {
        minZoom = mapScaleInfo.minZoom
        initZoom =  mapScaleInfo.initZoom
        initX = mapScaleInfo.initX
        initY = mapScaleInfo.initY;
    }
    console.log('目标', mapName, isFloor, initZoom);
    
    var bounds = L.latLngBounds(southWest, northEast);  
        // var href = mapScaleInfo?.href ? mapScaleInfo?.href : '../img/'
        var href = '../img/'
        // if (!isFloor && mapScaleInfo.href) {
        //     href = mapScaleInfo.href
        
        // } else if (isFloor && mapScaleInfo.floorInfo?.info?.href) {
        //     href = mapScaleInfo.floorInfo?.info?.href
        // } else {
        //     // href = ' ../img/'
        //      href = ' ../img/'
        // }

    console.log(northEast, bounds);
    currLayer = L.tileLayer(href + `${mapName}/{z}_{x}_{y}.jpg`, {
        minZoom: minZoom,
        maxZoom: 8,
        maxNativeZoom: isFloor ? (mapScaleInfo.floorInfo.info?.maxZomm || 6) : 4,
        noWrap: true,
        attribution: '地图与数据 © 腾讯 / 三角洲行动',
        bounds: bounds,
        errorTileUrl: window.DELTA_ASSET_ROOT + 'blank.jpg',
        tileSize: isFloor ? 512 : 256,
        zoomOffset: isFloor ? -1 : 0
    }).addTo(map);
    console.log(isFloor ? 512 : 256);
    
    currLayer.name = mapName


    map.setMaxBounds(bounds)
    map.options.minZoom = minZoom;
    
    if (mapName === 'map_qhz' && currWarType === 'mobile') {
        map.setView([window.occupy ? mapScaleInfo.initX_mobile_s : mapScaleInfo.initX, window.occupy ? mapScaleInfo.initY_mobile_s : mapScaleInfo.initY], initZoom)
    } else {
        console.log('执行', initZoom);
        
        map.setView([initX, initY], initZoom)
    }


    window.pervInitX = window.occupy ? mapScaleInfo.initX_s : mapScaleInfo.initX
    


    let html = ''
    $.each(poiList, function () {
        this.remove();
    
    });
    poiList = [];

    if (!isWar) {
        regionList.html('')
        
        poiInfo.forEach((item, index) => {
            if (item.name === '行政西楼' || item.name === '行政东楼') return;
            var myIcon =  L.divIcon({
                className: ` map-region-name`,
                html: `<div class="map-region-name">${item.name}</div>`,
            })
            console.log('item', item);
            
            var pos = getMapPos(item.x, item.y)
            html+= `<div class="region-item region-item-${index}" data-x="${item.x}" data-y="${item.y}">${item.name}</div>`
            poiList.push(L.marker([pos.y, pos.x], {icon: myIcon}).addTo(map))
        })
    
        // 锚点定位
        regionList.html(html)
        $('.region-item').on('click', anchorRegion)
    } else {
        regionList.html('')
        let length = window[currWarMap].info.sector
        for (let index = 0; index < length; index++) {
            html += `<div class="region-item-war region-item-war-${index} ${Number(window.warLv) === index ? 'active' : ''}" data-index="${index}">区域${regionText[index]}</div>`
        }
        regionList.html(html)
        $('.region-item-war').on('click', function (e) {
            console.log(2222, $(this));
            var index = $(e.target).attr('data-index');
            window.isLvChange = true;
            window.warLv = index
            changeWarMap(currWarMap, currWarType);
            // initNav();
            // bindOptionEvent();
            $('.lv-change-tips').text(`区域${window.warLv+1}`)
            $('.deploy-swiper').removeClass('show')
            map.flyTo([window[currWarMap].info.sectorInit[window.warLv].initX,  window[currWarMap].info.sectorInit[window.warLv].initY], window[currWarMap].info.sectorInit[window.warLv].initZoom)
            listIsAll[currLeftNav] = false;
            $('.choose-all').attr('class', 'img_all_close choose-all')
            console.log('addLayer', currLeftNav, listIsAll);
            setTimeout(() => {
                window.isLvChange = false;
            }, 1000)
        })
    }
    
}

// 定位通用方法
function anchorRegion (e) {
    e.stopPropagation();
    var x = $(e.target).attr('data-x');
    var y = $(e.target).attr('data-y');
    currFloorRegion = normalizeFloorRegionName($.trim($(e.target).text()));
    var pos = getMapPos(x, y)
    if (isFloor) {
        isFloor = false;
        changeMapLv(`${currMap + currLv}`);
        $('.btn-floor-mod').addClass('act')
        $('.floor-text').text('切换楼层')
        $('.floor-list').removeClass('show')
        setTimeout(() => {
            map.flyTo([pos.y * 2, pos.x * 2], 4.5)
        }, 500)
        outFloor = true;
       
    } else {
        map.flyTo([pos.y, pos.x], 4.5)
    }
    // map.flyTo([pos.y, pos.x], 4.5)
    $('.region-item').removeClass('action')
    $(this).addClass('action')
    // findFloor($(e.target).text())

}

// 初始化楼层
function initFloor () {
    var currentFloorList = getFloorListForRender();
    var activeFloorItem = currFloorIndex > -1 ? getFloorItem(currFloorIndex, currFloorRegion, null, false) : null;
    var activeFloorKey = buildFloorItemKey(activeFloorItem);
    floorList.html('')
    floorTop = $('.map-floor-change-list')
    let html2 = ''
    currentFloorList.forEach((item, index) => {
        let floorRegion = item.floor_name || ''
        let floorItemKey = buildFloorItemKey(item)
        let isActiveFloor = activeFloorKey && floorItemKey === activeFloorKey
        let html = `<div class="floor-item floor-item-${index} ${isActiveFloor ? 'act' : ''}" data-index="${index}" data-address="${item.floor_address}" data-floor="${item.floor_f}" data-region="${floorRegion}" data-floor-key="${floorItemKey}">${item.floor_address ? item.floor_name : ''} ${item.floor_f}</div>`
        html2 += `<div class="map-floor-item floor_${item.floor_f} ${isActiveFloor ? 'act' : ''}" data-index="${index}" data-floor="${item.floor_f}" data-region="${floorRegion}" data-floor-key="${floorItemKey}"></div>`
        floorList.append(html)
       
    })
    if (currentFloorList.length && currentFloorList[0].floor_address) {
        floorList.attr('data-address', 'more')
    }
    
    floorTop.html(html2)
    $('.btn-floor-mod').addClass('show')
    $('.floor-item').off('click').on('click', enterFloorMode)
    $('.map-floor-item').off('click').on('click', enterFloorMode)
}

function enterFloorMode(e) {
    outFloor = false;
    isFloor = true;
    let index = Number($(e.target).attr('data-index'));
    let floor = $(e.target).attr('data-floor');
    let floorRegion = $(e.target).attr('data-region') || currFloorRegion;
    let currentFloorList = getCurrentFloorList(floorRegion);
    currFloorIndex = getFloorIndexByCode(currentFloorList, floor, index);
    if (currFloorIndex === -1) return;
    let currentFloor = currentFloorList[currFloorIndex];
    let activeFloorKey = buildFloorItemKey(currentFloor);
    currFloorRegion = normalizeFloorRegionName(floorRegion || currentFloor.floor_name);
    $('.nav-option-ctn').addClass('floor')
    $('.m-index').addClass('floor')
    $('.btn-floor-mod').addClass('act')
    $('.floor-text').text('退出楼层')
    $('.floor-list').addClass('show')
    $('.floor-item').removeClass('act')
    $('.map-floor-item').removeClass('act')
    $(`.floor-item[data-floor-key="${activeFloorKey}"]`).addClass('act')
    $(`.map-floor-item[data-floor-key="${activeFloorKey}"]`).addClass('act')
    saveMarker = Object.assign({}, visibleMarker);
    changeMapLv(buildFloorMapPath(currentFloor, floor));
    enterFloorSave();
}

function shouldSkipAllSelectionWhenExitFloor() {
    return (`${currMap}${currLv}` === '50' || `${currMap}${currLv}` === '51') && !!listIsAll[currLeftNav];
}

// 进入楼层保留选项
function enterFloorSave () {
    let navType = {
        '保险箱': 'nav_bxx',
        '小保险箱': 'nav_xbxx',
        '服务器': 'nav_fwq',
        '电脑': 'nav_dn',
        '电脑机箱': 'nav_dnjx',
        '武器箱': 'nav_wqx',
        '大武器箱': 'nav_dwqx',
        '弹药箱': 'nav_dyx',
        '工具柜': 'nav_gjg',
        '收纳盒': 'nav_dgjh',
        // '一件衣服': 'nav_yf_s',
        '一件衣服': 'nav_yf',
        '军用医疗包': 'nav_ylb',
        '医疗物资堆': 'nav_ylwzd',
        '旅行包': 'nav_lxd',
        '手提箱': 'nav_stx',
        '储物柜': 'nav_cwg',
        '高级储物箱': 'nav_cwg_gj',
        '抽屉柜': 'nav_ctg',
        '登山包': 'nav_dsb',
        '快递箱': 'nav_kdx',
        '航空储物箱': 'nav_hkcwx',
        '垃圾桶': 'nav_ljx',
        '搅拌车': 'nav_snc',
        '野外物资箱': 'nav_ywwzx',
        '鸟窝': 'nav_nw',
        '藏匿物': 'nav_cnw',
        '高级旅行箱': 'nav_xlx'
    }
    console.log(saveMarker);
    for (const key in saveMarker) {
        if (Object.hasOwnProperty.call(saveMarker, key)) {
            if (saveMarker[key]) {
                console.log(key);
                
                !visibleMarker[key] ? $(`.nav-list-${navType[key]}`).addClass('active'): $(`.${navType[key]}`).removeClass('active')
                toggleVisible(key, currLeftNav);
            }
        }
    }
    visibleMarker = Object.assign({}, saveMarker);
    // !visibleMarker[name] ? $(`.${nav}`).addClass('active'): $(`.${nav}`).removeClass('active')
    // toggleVisible(name, currLeftNav);
}

// 重置全选
function resetAll (type) {
    if (currLeftNav == 0) {
        console.log('全部');
        if (listIsAll[0]) {
            for (const key in listIsAll) {
                if (Object.hasOwnProperty.call(listIsAll, key)) {
                    listIsAll[key] = false
                }
            }
        } else {
            for (const key in listIsAll) {
                if (Object.hasOwnProperty.call(listIsAll, key)) {
                    listIsAll[key] = type === 'none' ? false : true
                }
            }
        }
       
    } else if (type === 'none') {
        console.log('走这里');
        for (const key in listIsAll) {
            if (Object.hasOwnProperty.call(listIsAll, key)) {
                listIsAll[key] = false
            }
        }
    } else {
        // listIsAll[currLeftNav] = type === 'none' ? false: true;
        listIsAll[currLeftNav] = listIsAll[currLeftNav] ? false: true;
        
    }
    
    if (listIsAll[1] && listIsAll[2] && listIsAll[3] && listIsAll[4] && listIsAll[5]) {
        listIsAll[0] = true;
    } else if (!listIsAll[1] || !listIsAll[2] || !listIsAll[3] || !listIsAll[4] || !listIsAll[5]) {
        listIsAll[0] = false;
    }
   
}

var initNav = function () {
    currLeftNav = 0;
    var navLeft = $('.nav-options');
    navLeft.html('')
    var navList;
    if (isWar) {
        navList = allNavList.typeList;
    } else {
        navList = allNavList
    }
    var html = ''
    console.log(1111, allNavList);
    
    allNavList.forEach(function (item, index) {
        if (item.titleType === 'xdjqz') return;
        
        if (isWar) {
            html+= `
            <div class="nav-option-item nav-option-item-${index}  ${currLeftNav === index ? 'active': ''}" data-index="${index}">
                <div class="nav-option-i ${warNavText[item.title]}"></div>
                <div class="nav-option-text">${item.title}</div>
            </div>
            `
        } else {
            var tabIconCls = item.titleType === "首领" ? 'sl' : item.titleType;
            var tabIconExtra = '';
            // 鱼类 tab：CSS 无 yl 精灵，取该组第一条鱼的 lv3 图作图标
            if (item.titleType === 'yl' && Array.isArray(item.typeList) && item.typeList.length) {
                tabIconCls = 'nav-fish-tab';
                var fishRaw = String(item.typeList[0].icon || 'wz').replace(/^nav_/, '');
                tabIconExtra = `<img src="${FISH_ICON_URL + fishRaw}.png" style="width:70%;height:70%;object-fit:contain;display:block;margin:auto"/>`;
            }
            html+= `
            <div class="nav-option-item nav-option-item-${index} ${currLeftNav === index ? 'active': ''}" data-index="${index}">
                <div class="nav-option-i ${tabIconCls}" style="${item.titleType === 'yl' ? 'background:none' : ''}">${tabIconExtra}</div>
                <div class="nav-option-text">${item.title}</div>
            </div>
            `
        }
       
        // navLeft.append()

    })
    navLeft.html(html)

    var navOptItem = $('.nav-option-item')
    // 选择类型
    navOptItem.on('click', function (e) {
        var index = $(e.target).attr('data-index');
        currLeftNav = index;
        navOptItem.removeClass('active')
        $(`.nav-option-item-${index}`).addClass('active')
        console.log($(e.target).attr('data-index'));
        if (Number(index) === 0) {
            renderNavTypeList(allNavList[0].typeList, 0)
        } else {
            console.log('navTypeList[index]', navTypeList[index]);
            
            renderNavTypeList(navTypeList[index].typeList, index)
        }

        if (listIsAll[currLeftNav]) {
            $('.choose-all').attr('class', 'img_all_open choose-all')
        } else {
            $('.choose-all').attr('class', 'img_all_close choose-all')
        }
        console.log('initNav', currLeftNav, listIsAll);
        
        bindOptionEvent();

        // if (isWar) {
        //     warInit(currWarMap, currWarType);
        // }

    })
    
    renderNavTypeList(allNavList[0].typeList, 0)
    

        
    if (isWar) {
        regionList.html('')
        let length = window[currWarMap].info.sector
        for (let index = 0; index < length; index++) {
            regionList.append(`<div class="region-item-war region-item-war-${index} ${Number(window.warLv) === index ? 'active' : ''}" data-index="${index}">区域${regionText[index]}</div>`)
        }
        $('.region-item-war').on('click', function (e) {
            // $('.region-item-war').removeClass('active')
            $(this).addClass('active')
            console.log(2222, $(this));
            var index = $(e.target).attr('data-index');
            $(e.target).addClass('active')
            window.isLvChange = true;
            window.warLv = index
            changeWarMap(currWarMap, currWarType);
            // initNav();
            // bindOptionEvent();
            $('.lv-change-tips').text(`区域${window.warLv+1}`)
            $('.deploy-swiper').removeClass('show')
            map.flyTo([window[currWarMap].info.sectorInit[window.warLv].initX,  window[currWarMap].info.sectorInit[window.warLv].initY], window[currWarMap].info.sectorInit[window.warLv].initZoom)
            listIsAll[currLeftNav] = false;
            $('.choose-all').attr('class', 'img_all_close choose-all')
            setTimeout(() => {
                window.isLvChange = false;
            }, 1000)
        })
    } else {
        // regionList.html('')
        // selectRegion.forEach(function (item, index) {
        //     poiInfo.append(`<div class="region-item region-item-${index}" data-x="${item.x}" data-y="${item.y}">${item.name}</div>`)
        // })
    }
   
}

var renderNavTypeList = function (list, navIndex = 0){
    var html = ''
    if (list.length > 15 && list[1].titleType !== 'cbt') {
        html = '<div class="fgx top0 nav-wz">物资点</div>'
    } else {
        html = '<div class="fgx top0 nav-cbt">藏宝图</div>'
    }
    console.log(1111, list[1].titleType, list);
    
    list.forEach(function (item, index) {
        if (item.name === '行动接取站' || item.name === '高价值接取站') return;
        if (item.name === '付费撤离点' || item.name === '拉闸撤离点') {
            html+=`
            <div class="fgx ${list.length > 15 ? '' : 'top0'}">撤离点</div>
                <div class="nav-list-item nav-list-item-${index} ${nameClassMap[item.name] || ''} nav-list-${item.icon} ${visibleMarker[item.name] ? `img_${item.icon}_click active`: `img_${item.icon}`}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}">
                <div class="wz-bg">
                    <div class="wz-num">${item.num}</div>
                </div>
                <div class="wz-name">${item?.sub_name || item.name}</div>
            </div>`
        } else if (item.name === '进攻方基地') {
            html+=`
            <div class="fgx">基地部署点</div>
                <div class="nav-list-item nav-list-item-${index} nav-list-${item.icon} ${visibleMarker[item.name] ? `img_${item.icon}_click active`: `img_${item.icon}`}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}">
                <div class="wz-bg">
                    <div class="wz-num" ${item.num === 1? 'hide': ''}">${item.num}</div>
                </div>
                <div class="wz-name">${item?.sub_name || item.name}</div>
            </div>`
        }else if ((item.name === '据点A' || item.name === '据点B'|| item.name === '据点C'||item.name === '据点D'||item.name === '据点E'||item.name === '据点A1'||item.name === '据点B1'||item.name === '据点C1'||item.name === '据点D1'||item.name === '据点E1') && !window.occupy) {
            html+=`
            <div class="fgx">据点</div>
                <div class="nav-list-item nav-list-item-${index} nav-list-${item.icon} ${visibleMarker[item.name] ? `img_${item.icon}_click active`: `img_${item.icon}`}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}">
                <div class="wz-bg">
                    <div class="wz-num" ${item.num === 1? 'hide': ''}">${item.num}</div>
                </div>
                <div class="wz-name">${item?.sub_name || item.name}</div>
            </div>`
        } else if (item.name === '据点A'  && window.occupy) {
            html+=`
            <div class="fgx">据点</div>
                <div class="nav-list-item nav-list-item-${index} nav-list-${item.icon} ${visibleMarker[item.name] ? `img_${item.icon}_click active`: `img_${item.icon}`}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}">
                <div class="wz-bg">
                    <div class="wz-num" ${item.num === 1? 'hide': ''}">${item.num}</div>
                </div>
                <div class="wz-name">${item?.sub_name || item.name}</div>
            </div>`
        } else if (isWar && (item.name.indexOf('突击车') > -1 || item.name.indexOf('枪') > -1)) {
            html+=`
            <div class="fgx">${(item.name.indexOf('突击车') > -1) ? '载具' : '固定武器'}</div>
                <div class="nav-list-item nav-list-item-${index} nav-list-${item.icon} ${visibleMarker[item.name] ? `img_${item.icon}_click active`: `img_${item.icon}`} ${item.num > 0 ? '' : 'hide'}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}">
                <div class="wz-bg">
                    <div class="wz-num" ${item.num === 1? 'hide': ''}">${item.num}</div>
                </div>
                <div class="wz-name">${item?.sub_name || item.name}</div>
            </div>`
        } else if ('滑索'.indexOf(item.name) > -1) {
            html+=`
            <div class="fgx">装置</div>
                <div class="nav-list-item nav-list-item-${index} nav-list-${item.icon} ${visibleMarker[item.name] ? `img_${item.icon}_click active`: `img_${item.icon}`}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}">
                <div class="wz-bg">
                    <div class="wz-num" ${item.num === 1? 'hide': ''}">${item.num}</div>
                </div>
                <div class="wz-name">${item?.sub_name || item.name}</div>
            </div>`
        } else if (item.name === '出生点' || item.name === '撤离点' || item.name === '首领' || item.name === '行动接取站' || item.name === '固定弹药箱' || item.name === '载具补给站') {
            html+=`
            <div class="fgx ${(list.length > 15 || item.name === '固定弹药箱' || item.name === '载具补给站') ? '' : 'top0'}">${item.name}</div>
                <div class="nav-list-item nav-list-item-${index} ${nameClassMap[item.name] || ''} nav-list-${item.icon} ${visibleMarker[item.name] ? `img_${item.icon}_click active`: `img_${item.icon}`}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}">
                <div class="wz-bg">
                    <div class="wz-num">${item.num}</div>
                </div>
                <div class="wz-name">${item?.sub_name || item.name}</div>
            </div>`
        } else {
            html+=`
            <div class="nav-list-item nav-list-item-${index} ${nameClassMap[item.name] || ''} nav-list-${item.icon} ${visibleMarker[item.name] ? `img_${item.icon}_click active`: `img_${item.icon}`} ${item.num === 0? 'hide': ''}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}">
                <div class="wz-bg">
                    <div class="wz-num">${item.num}</div>
                </div>
                <div class="wz-name">${item?.sub_name || item.name}</div>
            </div>`
        }
       
        
       !typeListInit &&  (visibleMarker[item.name] = false)
       
    })
    if (isWar) {
        navTypyList.addClass('war')
        navTypyList.removeClass('normal')

    } else {
        navTypyList.addClass('normal')
        navTypyList.removeClass('war')
    }
    $('.nav-option-ctn').attr('data-map', currMap)
    navTypyList.html(html)
    typeListInit = true;
    visibleMarker2[navIndex].isInit = true;
}

function toastTips () {
    $('.m-toast').show();
    setTimeout(() => {
        $('.m-toast').hide();
    }, 800)
}

// 地图难度切换
// ... existing code ...
function changeMapLv(type) {
    console.log('难度', type);
    
    // 地图配置映射
    const mapConfigs = {
        // 零号大坝
        '00': {
            mapInfo: dabaInfo,
            navList: navList,
            navTypeList: navListInfo,
            mapIcons: mapArticle,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'map_db',
            getLvName: (name) => name.indexOf('夜') > -1 ? '前夜' : '常规'
        },
        '00_B1': {
            mapInfo: dabaInfo,
            navList: () => dabaInfo.floorInfo.navList_minus,
            navTypeList: () => dabaInfo.floorInfo.navList_minus,
            mapIcons: () => dabaInfo.floorInfo.mapArticle_minus,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'daba_0f',
            getLvName: (name) => name.indexOf('夜') > -1 ? '前夜' : '常规'
        },
        '00_1F': {
            mapInfo: dabaInfo,
            navList: () => dabaInfo.floorInfo.navList_firest,
            navTypeList: () => dabaInfo.floorInfo.navList_firest,
            mapIcons: () => dabaInfo.floorInfo.mapArticle_first,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'daba_1f',
            getLvName: (name) => name.indexOf('夜') > -1 ? '前夜' : '常规'
        },
        '00_2F': {
            mapInfo: dabaInfo,
            navList: () => dabaInfo.floorInfo.navList_second,
            navTypeList: () => dabaInfo.floorInfo.navList_second,
            mapIcons: () => dabaInfo.floorInfo.mapArticle_second,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'daba_2f',
            getLvName: (name) => name.indexOf('夜') > -1 ? '前夜' : '常规'
        },
        '01': {
            mapInfo: dabaInfo,
            navList: navList2,
            navTypeList: navListInfo2,
            mapIcons: mapArticle2,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'map_db',
            getLvName: (name) => name.indexOf('夜') > -1 ? '永夜' : '机密'
        },
        '01_B1': {
            mapInfo: dabaInfo,
            navList: () => dabaInfo.floorInfo.navList2_minus,
            navTypeList: () => dabaInfo.floorInfo.navList2_minus,
            mapIcons: () => dabaInfo.floorInfo.mapArticle2_minus,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'daba_0f',
            getLvName: (name) => name.indexOf('夜') > -1 ? '永夜' : '机密'
        },
        '01_1F': {
            mapInfo: dabaInfo,
            navList: () => dabaInfo.floorInfo.navList2_firest,
            navTypeList: () => dabaInfo.floorInfo.navList2_firest,
            mapIcons: () => dabaInfo.floorInfo.mapArticle2_first,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'daba_1f',
            getLvName: (name) => name.indexOf('夜') > -1 ? '永夜' : '机密'
        },
        '01_2F': {
            mapInfo: dabaInfo,
            navList: () => dabaInfo.floorInfo.navList2_second,
            navTypeList: () => dabaInfo.floorInfo.navList2_second,
            mapIcons: () => dabaInfo.floorInfo.mapArticle2_second,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'daba_2f',
            getLvName: (name) => name.indexOf('夜') > -1 ? '永夜' : '机密'
        },
        '02': {
            mapInfo: dabaInfo,
            navList: navList3,
            navTypeList: navListInfo3,
            mapIcons: mapArticle3,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'map_db',
            getLvName: (name) => name.indexOf('夜') > -1 ? '永夜' : '绝密'
        },
        '02_B1': {
            mapInfo: dabaInfo,
            navList: () => dabaInfo.floorInfo.navList3_minus,
            navTypeList: () => dabaInfo.floorInfo.navList3_minus,
            mapIcons: () => dabaInfo.floorInfo.mapArticle3_minus,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'daba_0f',
            getLvName: (name) => name.indexOf('夜') > -1 ? '永夜' : '绝密'
        },
        '02_1F': {
            mapInfo: dabaInfo,
            navList: () => dabaInfo.floorInfo.navList3_firest,
            navTypeList: () => dabaInfo.floorInfo.navList3_firest,
            mapIcons: () => dabaInfo.floorInfo.mapArticle3_first,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'daba_1f',
            getLvName: (name) => name.indexOf('夜') > -1 ? '永夜' : '绝密'
        },
        '02_2F': {
            mapInfo: dabaInfo,
            navList: () => dabaInfo.floorInfo.navList3_second,
            navTypeList: () => dabaInfo.floorInfo.navList3_second,
            mapIcons: () => dabaInfo.floorInfo.mapArticle3_second,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'daba_2f',
            getLvName: (name) => name.indexOf('夜') > -1 ? '永夜' : '绝密'
        },
        '03': {
            mapInfo: dabaInfo,
            navList: navList4,
            navTypeList: navListInfo4,
            mapIcons: mapArticle4,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'map_db',
            getLvName: (name) => name.indexOf('夜') > -1 ? '永夜' : '绝密'
        },
        '03_B1': {
            mapInfo: dabaInfo,
            navList: () => dabaInfo.floorInfo.navList3_minus,
            navTypeList: () => dabaInfo.floorInfo.navList3_minus,
            mapIcons: () => dabaInfo.floorInfo.mapArticle3_minus,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'daba_0f',
            getLvName: (name) => name.indexOf('夜') > -1 ? '永夜' : '绝密'
        },
        '03_1F': {
            mapInfo: dabaInfo,
            navList: () => dabaInfo.floorInfo.navList3_firest,
            navTypeList: () => dabaInfo.floorInfo.navList3_firest,
            mapIcons: () => dabaInfo.floorInfo.mapArticle3_first,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'daba_1f',
            getLvName: (name) => name.indexOf('夜') > -1 ? '永夜' : '绝密'
        },
        '03_2F': {
            mapInfo: dabaInfo,
            navList: () => dabaInfo.floorInfo.navList3_second,
            navTypeList: () => dabaInfo.floorInfo.navList3_second,
            mapIcons: () => dabaInfo.floorInfo.mapArticle3_second,
            poiInfo: selectRegion,
            mapName: '零号大坝',
            mapLayer: 'daba_2f',
            getLvName: (name) => name.indexOf('夜') > -1 ? '永夜' : '绝密'
        },
        
        // 长弓溪谷
        '10': {
            mapInfo: cgxgInfo,
            navList: navList_cgxg,
            navTypeList: navListInfo_cgxg,
            mapIcons: mapArticle_cgxg,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            mapLayer: 'map_yc',
            lvName: '常规',
            extraConfig: {
                zjText: '坠机事件',
                removeExistingLayer: true
            }
        },
        '10_1F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList_firest,
            navTypeList: () => cgxgInfo.floorInfo.navList_firest,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle_first,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            mapLayer: 'cgxg_1f',
            lvName: '常规'
        },
        '10_2F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList_second,
            navTypeList: () => cgxgInfo.floorInfo.navList_second,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle_second,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            mapLayer: 'cgxg_2f',
            lvName: '常规'
        },
        '10_s': {
            mapInfo: cgxgInfo,
            navList: navList2_cgxg,
            navTypeList: navListInfo2_cgxg,
            mapIcons: mapArticle2_cgxg,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            mapLayer: 'map_yc2',
            lvName: '常规',
            extraConfig: {
                zjText: '坠机事件',
                removeExistingLayer: true
            }
        },
        '10_s_1F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList_s_firest,
            navTypeList: () => cgxgInfo.floorInfo.navList_s_firest,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle_s_first,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            mapLayer: 'cgxg_1f',
            lvName: '常规'
        },
        '10_s_2F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList_s_second,
            navTypeList: () => cgxgInfo.floorInfo.navList_s_second,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle_s_second,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            mapLayer: 'cgxg_2f',
            lvName: '常规'
        },
        '10_ldz_1F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList_ldz_1f,
            navTypeList: () => cgxgInfo.floorInfo.navList_ldz_1f,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle_ldz_1f,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            lvName: '常规',
            mapLayer: 'cgxg_ldz_1f',
            needRemove: true
        },
        '10_ldz_2F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList_ldz_2f,
            navTypeList: () => cgxgInfo.floorInfo.navList_ldz_2f,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle_ldz_2f,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            lvName: '常规',
            mapLayer: 'cgxg_ldz_2f',
            needRemove: true
        },
        '10_ldz_3F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList_ldz_3f,
            navTypeList: () => cgxgInfo.floorInfo.navList_ldz_3f,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle_ldz_3f,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            lvName: '常规',
            mapLayer: 'cgxg_ldz_3f',
            needRemove: true
        },
        '10_ldz_4F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList_ldz_4f,
            navTypeList: () => cgxgInfo.floorInfo.navList_ldz_4f,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle_ldz_4f,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            lvName: '常规',
            mapLayer: 'cgxg_ldz_4f',
            needRemove: true
        },
        '10_ldz_B1': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList_firest,
            navTypeList: () => cgxgInfo.floorInfo.navList_firest,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle_first,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            lvName: '常规',
            mapLayer: 'cgxg_ldz_b1',
            needRemove: true
        },
        '11': {
            mapInfo: cgxgInfo,
            navList: navList3_cgxg,
            navTypeList: navListInfo3_cgxg,
            mapIcons: mapArticle3_cgxg,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            mapLayer: 'map_yc',
            lvName: '机密',
            extraConfig: {
                zjText: '坠机事件',
                removeExistingLayer: true
            }
        },
        '11_1F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList2_firest,
            navTypeList: () => cgxgInfo.floorInfo.navList2_firest,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle2_first,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            mapLayer: 'cgxg_1f',
            lvName: '机密'
        },
        '11_2F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList2_second,
            navTypeList: () => cgxgInfo.floorInfo.navList2_second,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle2_second,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            mapLayer: 'cgxg_2f',
            lvName: '机密'
        },
        '11_s': {
            mapInfo: cgxgInfo,
            navList: navList4_cgxg,
            navTypeList: navListInfo4_cgxg,
            mapIcons: mapArticle4_cgxg,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            mapLayer: 'map_yc2',
            lvName: '机密',
            extraConfig: {
                zjText: '坠机事件',
                removeExistingLayer: true
            }
        },
        '11_s_1F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList2_s_firest,
            navTypeList: () => cgxgInfo.floorInfo.navList2_s_firest,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle2_s_first,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            mapLayer: 'cgxg_1f',
            lvName: '机密'
        },
        '11_s_2F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList2_s_second,
            navTypeList: () => cgxgInfo.floorInfo.navList2_s_second,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle2_s_second,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            mapLayer: 'cgxg_2f',
            lvName: '机密'
        },
        '11_ldz_1F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList2_ldz_1f,
            navTypeList: () => cgxgInfo.floorInfo.navList2_ldz_1f,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle2_ldz_1f,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            lvName: '机密',
            mapLayer: 'cgxg_ldz_1f',
            needRemove: true
        },
        '11_ldz_2F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList2_ldz_2f,
            navTypeList: () => cgxgInfo.floorInfo.navList2_ldz_2f,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle2_ldz_2f,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            lvName: '机密',
            mapLayer: 'cgxg_ldz_2f',
            needRemove: true
        },
        '11_ldz_3F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList2_ldz_3f,
            navTypeList: () => cgxgInfo.floorInfo.navList2_ldz_3f,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle2_ldz_3f,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            lvName: '机密',
            mapLayer: 'cgxg_ldz_3f',
            needRemove: true
        },
        '11_ldz_4F': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList2_ldz_4f,
            navTypeList: () => cgxgInfo.floorInfo.navList2_ldz_4f,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle2_ldz_4f,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            lvName: '机密',
            mapLayer: 'cgxg_ldz_4f',
            needRemove: true
        },
        '11_ldz_B1': {
            mapInfo: cgxgInfo,
            navList: () => cgxgInfo.floorInfo.navList2_ldz_b1,
            navTypeList: () => cgxgInfo.floorInfo.navList2_ldz_b1,
            mapIcons: () => cgxgInfo.floorInfo.mapArticle2_ldz_b1,
            poiInfo: selectRegion_cgxg,
            mapName: '长弓溪谷',
            lvName: '机密',
            mapLayer: 'cgxg_ldz_b1',
            needRemove: true
        },
        
        // 航天基地
        '21': {
            mapInfo: htjdInfo,
            navList: navList_htjd,
            navTypeList: navListInfo_htjd,
            mapIcons: mapArticle_htjd,
            poiInfo: selectRegion_htjd,
            mapName: '航天基地',
            mapLayer: 'map_htjd',
            lvName: '机密',
            extraConfig: {
                zjText: '断桥事件',
                removeExistingLayer: true
            }
        },
        '21_s': {
            mapInfo: htjdInfo,
            navList: navList2_htjd,
            navTypeList: navListInfo2_htjd,
            mapIcons: mapArticle2_htjd,
            poiInfo: selectRegion_htjd,
            mapName: '航天基地',
            mapLayer: 'map_htjd2',
            lvName: '机密',
            extraConfig: {
                zjText: '断桥事件',
                removeExistingLayer: true
            }
        },
        '22': {
            mapInfo: htjdInfo,
            navList: navList3_htjd,
            navTypeList: navListInfo3_htjd,
            mapIcons: mapArticle3_htjd,
            poiInfo: selectRegion_htjd,
            mapName: '航天基地',
            mapLayer: 'map_htjd',
            lvName: '绝密',
            extraConfig: {
                zjText: '断桥事件',
                removeExistingLayer: true
            }
        },
        '22_s': {
            mapInfo: htjdInfo,
            navList: navList4_htjd,
            navTypeList: navListInfo4_htjd,
            mapIcons: mapArticle4_htjd,
            poiInfo: selectRegion_htjd,
            mapName: '航天基地',
            mapLayer: 'map_htjd2',
            lvName: '绝密',
            extraConfig: {
                zjText: '断桥事件',
                removeExistingLayer: true
            }
        },
        
        // 巴克什
        '30': {
            mapInfo: bksInfo,
            navList: navList_bks,
            navTypeList: navListInfo_bks,
            mapIcons: mapArticle_bks,
            poiInfo: selectRegion_bks,
            mapName: '巴克什',
            mapLayer: 'map_bks2',
            lvName: '常规',
            extraConfig: {
                removeExistingLayer: true
            }
        },
        '30_B1': {
            mapInfo: bksInfo,
            navList: () => bksInfo.floorInfo.navList_three,
            navTypeList: () => bksInfo.floorInfo.navList_three,
            mapIcons: () => bksInfo.floorInfo.mapArticle_three,
            poiInfo: selectRegion_bks,
            mapName: '巴克什',
            mapLayer: 'bks_b1',
            lvName: '常规'
        },
        '30_1F': {
            mapInfo: bksInfo,
            navList: () => bksInfo.floorInfo.navList_firest,
            navTypeList: () => bksInfo.floorInfo.navList_firest,
            mapIcons: () => bksInfo.floorInfo.mapArticle_first,
            poiInfo: selectRegion_bks,
            mapName: '巴克什',
            mapLayer: 'bks_1f',
            lvName: '常规'
        },
        '30_2F': {
            mapInfo: bksInfo,
            navList: () => bksInfo.floorInfo.navList_second,
            navTypeList: () => bksInfo.floorInfo.navList_second,
            mapIcons: () => bksInfo.floorInfo.mapArticle_second,
            poiInfo: selectRegion_bks,
            mapName: '巴克什',
            mapLayer: 'bks_2f',
            lvName: '常规'
        },
        '31': {
            mapInfo: bksInfo,
            navList: navList_bks,
            navTypeList: navListInfo_bks,
            mapIcons: mapArticle_bks,
            poiInfo: selectRegion_bks,
            mapName: '巴克什',
            mapLayer: 'map_bks2',
            lvName: '机密',
            extraConfig: {
                removeExistingLayer: true
            }
        },
        '31_B1': {
            mapInfo: bksInfo,
            navList: () => bksInfo.floorInfo.navList_firest,
            navTypeList: () => bksInfo.floorInfo.navList_firest,
            mapIcons: () => bksInfo.floorInfo.mapArticle_first,
            poiInfo: selectRegion_bks,
            mapName: '巴克什',
            mapLayer: 'bks_1f',
            lvName: '机密'
        },
        '31_1F': {
            mapInfo: bksInfo,
            navList: () => bksInfo.floorInfo.navList_second,
            navTypeList: () => bksInfo.floorInfo.navList_second,
            mapIcons: () => bksInfo.floorInfo.mapArticle_second,
            poiInfo: selectRegion_bks,
            mapName: '巴克什',
            mapLayer: 'bks_2f',
            lvName: '机密'
        },
        '31_2F': {
            mapInfo: bksInfo,
            navList: () => bksInfo.floorInfo.navList_three,
            navTypeList: () => bksInfo.floorInfo.navList_three,
            mapIcons: () => bksInfo.floorInfo.mapArticle_three,
            poiInfo: selectRegion_bks,
            mapName: '巴克什',
            mapLayer: 'bks_3f',
            lvName: '机密'
        },
        '32': {
            mapInfo: bksInfo,
            navList: navList2_bks,
            navTypeList: navListInfo2_bks,
            mapIcons: mapArticle2_bks,
            poiInfo: selectRegion_bks,
            mapName: '巴克什',
            mapLayer: 'map_bks2',
            lvName: '绝密',
            extraConfig: {
                removeExistingLayer: true
            }
        },
        '32_B1': {
            mapInfo: bksInfo,
            navList: () => bksInfo.floorInfo.navList2_firest,
            navTypeList: () => bksInfo.floorInfo.navList2_firest,
            mapIcons: () => bksInfo.floorInfo.mapArticle2_first,
            poiInfo: selectRegion_bks,
            mapName: '巴克什',
            mapLayer: 'bks_1f',
            lvName: '机密'
        },
        '32_1F': {
            mapInfo: bksInfo,
            navList: () => bksInfo.floorInfo.navList2_second,
            navTypeList: () => bksInfo.floorInfo.navList2_second,
            mapIcons: () => bksInfo.floorInfo.mapArticle2_second,
            poiInfo: selectRegion_bks,
            mapName: '巴克什',
            mapLayer: 'bks_2f',
            lvName: '机密'
        },
        '32_2F': {
            mapInfo: bksInfo,
            navList: () => bksInfo.floorInfo.navList2_three,
            navTypeList: () => bksInfo.floorInfo.navList2_three,
            mapIcons: () => bksInfo.floorInfo.mapArticle2_three,
            poiInfo: selectRegion_bks,
            mapName: '巴克什',
            mapLayer: 'bks_3f',
            lvName: '机密'
        },
        // 潮汐监狱
        '42': {
            mapInfo: cxjyInfo,
            navList: navList_cxjy,
            navTypeList: navListInfo_cxjy,
            mapIcons: mapArticle_cxjy,
            poiInfo: selectRegion_cxjy,
            mapName: '潮汐监狱',
            mapLayer: 'map_cxjy',
            lvName: '绝密',
            extraConfig: {
                removeExistingLayer: true
            }
        },
        '42_1F': {
            mapInfo: cxjyInfo,
            navList: () => cxjyInfo.floorInfo.navList_first,
            navTypeList: () => cxjyInfo.floorInfo.navList_first,
            mapIcons: () => cxjyInfo.floorInfo.mapArticle_first,
            poiInfo: selectRegion_cxjy,
            mapName: '潮汐监狱',
            mapLayer: 'cxjy_1f',
            lvName: '绝密'
        },
        '42_2F': {  
            mapInfo: cxjyInfo,
            navList: () => cxjyInfo.floorInfo.navList_second,
            navTypeList: () => cxjyInfo.floorInfo.navList_second,
            mapIcons: () => cxjyInfo.floorInfo.mapArticle_second,
            poiInfo: selectRegion_cxjy,
            mapName: '潮汐监狱',
            mapLayer: 'cxjy_2f',
            lvName: '绝密'
        },
        '42_3F': {
            mapInfo: cxjyInfo,
            navList: () => cxjyInfo.floorInfo.navList_three,
            navTypeList: () => cxjyInfo.floorInfo.navList_three,
            mapIcons: () => cxjyInfo.floorInfo.mapArticle_three,
            poiInfo: selectRegion_cxjy,
            mapName: '潮汐监狱',
            mapLayer: 'cxjy_3f',
            lvName: '绝密'
        },
        '42_4F': {
            mapInfo: cxjyInfo,
            navList: () => cxjyInfo.floorInfo.navList_four,
            navTypeList: () => cxjyInfo.floorInfo.navList_four,
            mapIcons: () => cxjyInfo.floorInfo.mapArticle_four,
            poiInfo: selectRegion_cxjy,
            mapName: '潮汐监狱',
            mapLayer: 'cxjy_4f',
            lvName: '绝密'
        },
        // az3
        '50': {
            mapInfo: az3Info,
            navList: navList_az3,
            navTypeList: navListInfo_az3,
            mapIcons: mapArticle_az3,
            poiInfo: selectRegion_az3,
            mapName: 'AZ3',
            mapLayer: 'map_az3',
            lvName: '常规',
            extraConfig: {
                removeExistingLayer: true
            }
        },
        '50_1_1F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList_firest1,
            navTypeList: () => az3Info.floorInfo.navList_firest1,
            mapIcons: () => az3Info.floorInfo.mapArticle_first1,
            poiInfo: selectRegion_az3,
            mapName: 'RBMK反应堆',
            mapLayer: 'az3_1_1f',
            lvName: '常规'
        },
         '50_1_2F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList_second1,
            navTypeList: () => az3Info.floorInfo.navList_second1,
            mapIcons: () => az3Info.floorInfo.mapArticle_second1,
            poiInfo: selectRegion_az3,
            mapName: 'RBMK反应堆',
            mapLayer: 'az3_1_2f',
            lvName: '常规'
        },
        '50_1_3F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList_three1,
            navTypeList: () => az3Info.floorInfo.navList_three1,
            mapIcons: () => az3Info.floorInfo.mapArticle_three1,
            poiInfo: selectRegion_az3,
            mapName: 'RBMK反应堆',
            mapLayer: 'az3_1_3f',
            lvName: '常规'
        },
        '50_2_1F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList_firest2,
            navTypeList: () => az3Info.floorInfo.navList_firest2,
            mapIcons: () => az3Info.floorInfo.mapArticle_first2,
            poiInfo: selectRegion_az3,
            mapName: 'RBMK反应堆',
            mapLayer: 'az3_2_1f',
            lvName: '常规'
        },
         '50_2_2F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList_second2,
            navTypeList: () => az3Info.floorInfo.navList_second2,
            mapIcons: () => az3Info.floorInfo.mapArticle_second2,
            poiInfo: selectRegion_az3,
            mapName: 'RBMK反应堆',
            mapLayer: 'az3_2_2f',
            lvName: '常规'
        },
        '50_3_1F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList_firest3,
            navTypeList: () => az3Info.floorInfo.navList_firest3,
            mapIcons: () => az3Info.floorInfo.mapArticle_first3,
            poiInfo: selectRegion_az3,
            mapName: 'RBMK反应堆',
            mapLayer: 'az3_3_1f',
            lvName: '常规'
        },
         '50_3_2F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList_second3,
            navTypeList: () => az3Info.floorInfo.navList_second3,
            mapIcons: () => az3Info.floorInfo.mapArticle_second3,
            poiInfo: selectRegion_az3,
            mapName: 'RBMK反应堆',
            mapLayer: 'az3_3_2f',
            lvName: '常规'
        },
        '51': {
            mapInfo: az3Info,
            navList: navList2_az3,
            navTypeList: navListInfo2_az3,
            mapIcons: mapArticle2_az3,
            poiInfo: selectRegion_az3,
            mapName: 'AZ3',
            mapLayer: 'map_az3',
            lvName: '机密',
            extraConfig: {
                removeExistingLayer: true
            }
        },
        '51_1_1F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList2_firest1,
            navTypeList: () => az3Info.floorInfo.navList2_firest1,
            mapIcons: () => az3Info.floorInfo.mapArticle2_first1,
            poiInfo: selectRegion_az3,
            mapName: 'RBMK反应堆',
            mapLayer: 'az3_1_1f',
            lvName: '机密'
        },
         '51_1_2F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList2_second1,
            navTypeList: () => az3Info.floorInfo.navList2_second1,
            mapIcons: () => az3Info.floorInfo.mapArticle2_second1,
            poiInfo: selectRegion_az3,
            mapName: 'RBMK反应堆',
            mapLayer: 'az3_1_2f',
            lvName: '机密'
        },
        '51_1_3F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList2_three1,
            navTypeList: () => az3Info.floorInfo.navList2_three1,
            mapIcons: () => az3Info.floorInfo.mapArticle2_three1,
            poiInfo: selectRegion_az3,
            mapName: 'RBMK反应堆',
            mapLayer: 'az3_1_3f',
            lvName: '机密'
        },
        '51_2_1F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList2_firest2,
            navTypeList: () => az3Info.floorInfo.navList2_firest2,
            mapIcons: () => az3Info.floorInfo.mapArticle2_first2,
            poiInfo: selectRegion_az3,
            mapName: '老科学院',
            mapLayer: 'az3_2_1f',
            lvName: '机密'
        },
         '51_2_2F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList2_second2,
            navTypeList: () => az3Info.floorInfo.navList2_second2,
            mapIcons: () => az3Info.floorInfo.mapArticle2_second2,
            poiInfo: selectRegion_az3,
            mapName: '老科学院',
            mapLayer: 'az3_2_2f',
            lvName: '机密'
        },
        '51_3_1F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList2_firest3,
            navTypeList: () => az3Info.floorInfo.navList2_firest3,
            mapIcons: () => az3Info.floorInfo.mapArticle2_first3,
            poiInfo: selectRegion_az3,
            mapName: '压水堆',
            mapLayer: 'az3_3_1f',
            lvName: '机密'
        },
         '51_3_2F': {
            mapInfo: az3Info,
            navList: () => az3Info.floorInfo.navList2_second3,
            navTypeList: () => az3Info.floorInfo.navList2_second3,
            mapIcons: () => az3Info.floorInfo.mapArticle2_second3,
            poiInfo: selectRegion_az3,
            mapName: '压水堆',
            mapLayer: 'az3_3_2f',
            lvName: '机密'
        },
        // 注意：原代码中32以下有一些重复的case(31_B1, 31_1F, 31_2F)，看起来可能是错误
    };

    // 处理地图配置切换
    const applyMapConfig = (config) => {
        if (!config) {
            toastTips();
            return false;
        }

        isZj = false;
        // 设置基本信息
        mapScaleInfo = config.mapInfo;
        poiInfo = config.poiInfo;

        // 设置导航列表
        allNavList = typeof config.navList === 'function' ? config.navList() : config.navList;
        navTypeList = typeof config.navTypeList === 'function' ? config.navTypeList() : config.navTypeList;
        mapIcons = typeof config.mapIcons === 'function' ? config.mapIcons() : config.mapIcons;

        // ★ PC 版修复：机密难度(11)随机事件过滤只针对"主图"大地图：山火/坠机替换 mapIcons 并重算分类 nav。
        // 楼层视图（isFloor）必须跳过——否则 dataFilter 的 arrInfo（分类组数组）会覆盖掉扁平 navList，
        // 楼层点位列表全空（10/11_ldz_*F 曾踩同款 bug）。
        if (!isFloor && Number(currMap) === 1 && Number(currLv) === 1) {
            if ($('.random-act').text().indexOf('山火') > -1) {
                mapIcons = mapArticle5_cgxg;
            }
            if ($('.random-act').text().indexOf('坠机') > -1 && $('.random-act').text().indexOf('山火') > -1) {
                mapIcons = mapArticle6_cgxg;
                console.log('mapArticle6_cgxg');
            }
            const { arr, arrInfo } = dataFilter(mapIcons);
            allNavList = arrInfo;
            navTypeList = arrInfo;
        }

        // ★ 鱼类导航组（PC 版迁移）：仅主图挂载（楼层扁平 nav / 战争 navRegion 均不处理）；
        // ensureFishGroup 幂等、无鱼不追加；inject 把鱼并入"全部"组、恒返新数组不污染静态 nav。
        if (!isWar && !isFloor) {
            allNavList = ensureFishGroup(allNavList, mapIcons);
            navTypeList = ensureFishGroup(navTypeList, mapIcons);
            allNavList = injectFishIntoAll(allNavList, getFishTypeList(allNavList));
        }


        console.log('allNavList', allNavList);
        console.log('navTypeList', navTypeList);
        // 设置地图名称和难度
        const lvName = config.lvName || (config.getLvName ? config.getLvName(chooseItemLvName) : '常规');
        console.log('changeMapLv', config.mapName, lvName, config.lvName);
        
        $('.curr-map-name').text(config.mapName);
        $('.map-lv').text(`( ${lvName} )`);
        $('.curr-map-lv').text(lvName);

        // 处理额外配置
        if (config.extraConfig) {
            if (config.extraConfig.zjText) {
                $('.zj-text').text(config.extraConfig.zjText);
            }
            
            if (config.extraConfig.removeExistingLayer) {
                map.removeLayer(currLayer);
            }
        }

        // 切换地图图层
        if (currLayer.name !== config.mapLayer) {
            addLayer(config.mapLayer);
        }
        
        // 必要时添加图层
        if (config.extraConfig && config.extraConfig.removeExistingLayer) {
            map.addLayer(currLayer);
        }

        // 导航装配（按 nav 形态分流，避免误删子楼层的分类 tab）：
        // - 主图 / 分组形态楼层（酒店 navList_firest 等，[{titleType,title,typeList}]）→ initNav 正常建分类 tab；
        // - 扁平形态楼层（雷达站 navList_ldz_*，纯条目数组，无组概念）→ 不建 tab，清掉主图残留一级 tab（如"鱼类"），尾部整列渲染
        if (!isFloor || isGroupedNav(navTypeList)) {
            initNav();
        } else {
            $('.nav-options').empty();
        }

        return true;
    };

    // 应用地图配置
    const configApplied = applyMapConfig(mapConfigs[type]);


    if (!configApplied) return;

    // 重置和初始化
    typeListInit = false;
    if (outFloor) {
        resetAll('none');
    }
    


     
    // 初始化楼层
    if (mapScaleInfo.floorInfo) {
        initFloor();
    } else {
        $('.btn-floor-mod').removeClass('show');
    }

    // 设置导航状态
    if (listIsAll[currLeftNav]) {
        toggleVisible(`${currLeftNav}_all`, currLeftNav);
        $('.choose-all').attr('class', 'img_all_open choose-all');
    } else {
        toggleVisible(`${currLeftNav}_none`, currLeftNav);
        $('.choose-all').attr('class', 'img_all_close choose-all');
    }
    console.log('changeMapLv', currLeftNav, listIsAll);
    // 渲染导航类型列表
    if (isFloor && !isGroupedNav(navTypeList)) {
        // ★ 扁平楼层 nav（雷达站 navList_ldz_*）：整列直接渲染；无组 tab、无 group0 概念
        renderNavTypeList(allNavList, 0);
    } else if (Number(currLeftNav) === 0) {
        renderNavTypeList(allNavList[0]?.typeList || [], 0);
    } else {
        renderNavTypeList((navTypeList[currLeftNav] && navTypeList[currLeftNav].typeList) || [], currLeftNav);
    }

    // 绑定选项事件
    bindOptionEvent();
}
// ... existing code ...

function fuzzyMatch(text, pattern) {
    // 将模糊词转换为正则表达式
    const regex = new RegExp(pattern.split('').join('.*'), 'i');
    return regex.test(text);
  }

var mapSelectCtn = $('.map-select')
var selectCtn = $('.select-ctn');
// 搜索
function selectmarker(name) {
    if (name === '') {
        mapSelectCtn.removeClass('show');
        return;
    };
    console.log('name', name, allNavList);
    var markerList = []
    var html = '';
    for (let index = 0; index < allNavList[0].typeList.length; index++) {
        const element = allNavList[0].typeList[index];
        console.log(element);
        fuzzyMatch(element.name, name) && markerList.push(element)
    }
    console.log('markerList', markerList);
    markerList.length && markerList.forEach(function (item, index) {
        // console.log(visibleMarker[item.name], item.name);
        html+=`
        <div class="nav-list-item nav-list-item-${index} nav-list-${item.icon} ${visibleMarker[item.name] ? `img_${item.icon}_click active`: `img_${item.icon}`}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}">
            <div class="wz-bg">
                <div class="wz-num">${item.num}</div>
            </div>
            <div class="wz-name">${item?.sub_name || item.name}</div>
        </div>`
    })
    // navTypyList.html(html)
    selectCtn.html(html)
    mapSelectCtn.addClass('show');

    bindOptionEvent();
}

function bindOptionEvent () {
    var NavListItem = $('.nav-list-item')
    
    // 选择标签
    NavListItem.on('click', function (e) {
        var icon = $(e.target).attr('data-icon');
        var name = $(e.target).attr('data-name');
        var NavListItemNum = $(e.target).find('.wz-num')
        if (NavListItemNum.text() == 0) return;
        if (!visibleMarker[name]) {
            $(this).addClass(`img_${icon}_click active`)
        } else {
            $(this).removeClass(`img_${icon}_click active`)
            $(this).addClass(`img_${icon}`)
        }
        currNavIcon = name;
        NavCliciIndex++;
        toggleVisible(name, currLeftNav);
        saveMarker = Object.assign({}, visibleMarker);
        
        let chooseNum = $('.nav-type-list').find('.active').length;
        console.log(123, chooseNum, navTypeList[currLeftNav].typeList.length);
        if (chooseNum === navTypeList[currLeftNav].typeList.length) {
            console.log('走这里');
            
            $('.choose-all').attr('class', 'img_all_open choose-all')
        } else {
            if (listIsAll[currLeftNav]) {
                listIsAll[currLeftNav] = false;
                listIsAll[0] = false;
                $('.choose-all').attr('class', 'img_all_close choose-all')
            } else {
                $('.choose-all').attr('class', 'img_all_close choose-all')
            }
        }
        console.log('点击');
    })
}

function showMsg (text) {
    console.log(text);
    
}

// 事件
var bindEvent = function () {
    // 导航栏状态
    var navState = false;
    var navCtn = $('.nav-ctn')
    var navCtnBg = $('.nav-ctn-bg')
    var navOptItem = $('.nav-option-item')
    var NavListItem = $('.nav-list-item')
    var btnNavState = $('.btn-nav-state');

    // 搜索地区
    $('.region-item').on('click', anchorRegion)

    // 全选
    var isAll = false;
    $('.choose-all').on('click', function (e) {
        e.stopPropagation();
        // resetNav();
        // isAll = !isAll;
        resetAll()
        
        if (listIsAll[currLeftNav]) {
            toggleVisible(`${currLeftNav}_all`, currLeftNav);
            console.log('走这里2', currLeftNav);
            
            $('.choose-all').attr('class', 'img_all_open choose-all')
        } else {
            toggleVisible(`${currLeftNav}_none`, currLeftNav);
            $('.choose-all').attr('class', 'img_all_close choose-all')
        }
        // renderNavTypeList(navList[0].typeList)
        if (Number(currLeftNav) === 0) {
            renderNavTypeList(allNavList[0].typeList, 0)
        } else {
            renderNavTypeList(navTypeList[currLeftNav].typeList, currLeftNav)
        }

        bindOptionEvent();
       
    })

    $('.reset-choose').on('click', function (e) {
        e.stopPropagation();
        resetAll('none')
        toggleVisible(`none`, currLeftNav);
        $('.choose-all').attr('class', 'img_all_close choose-all')
        // renderNavTypeList(navList[0].typeList)
        if (Number(currLeftNav) === 0) {
            renderNavTypeList(allNavList[0].typeList, 0)
        } else {
            renderNavTypeList(navTypeList[currLeftNav].typeList, currLeftNav)
        }

        bindOptionEvent();
    })

    // 选择类型
    navOptItem.on('click', function (e) {
        e.stopPropagation();
        var index = $(e.target).attr('data-index');
        currLeftNav = index;
        navOptItem.removeClass('active')
        $(`.nav-option-item-${index}`).addClass('active')
        console.log($(e.target).attr('data-index'));
        if (Number(index) === 0) {
            renderNavTypeList(allNavList[0].typeList, 0)
        } else {
            renderNavTypeList(navTypeList[index].typeList, index)
        }

        if (listIsAll[currLeftNav]) {
            console.log('走这里3');
            
            $('.choose-all').attr('class', 'img_all_open choose-all')
        } else {
            $('.choose-all').attr('class', 'img_all_close choose-all')
        }
        
        bindOptionEvent();
    })

     // 选择标签
    bindOptionEvent();

   
    // 打开关闭导航
    btnNavState.on('click', function (e) {
        e.stopPropagation();
        navState = !navState;
        console.log('navState', navState);
        
        if (navState) {
            findPad() ? navCtn.addClass('open_max') : navCtn.addClass('open')
        } else {
            findPad() ? navCtn.removeClass('open_max') : navCtn.removeClass('open')
        }
    })

    $('.btn-nav-state-top').on('click', function (e) {
        e.stopPropagation();
        navState = !navState;
        console.log('navState', navState);
        
        if (navState) {
            findPad() ? navCtn.addClass('open_max') : navCtn.addClass('open')
        } else {
            findPad() ? navCtn.removeClass('open_max') : navCtn.removeClass('open')
        }
    })

    $('.btn-check-marker').on('click', function (e) {
        e.stopPropagation();
        navState = !navState;
        if (navState) {
            findPad() ? navCtn.addClass('open_max') : navCtn.addClass('open')
        } else {
            findPad() ? navCtn.removeClass('open_max') : navCtn.removeClass('open')
        }
    })




    $('.m-index').on('click', function (e) {
        console.log(e, $(e.target).attr('class'));
       
        if ($(e.target).attr('class') === 'nav-ctn open') {
            navState = false;
            findPad() ? navCtn.removeClass('open_max') : navCtn.removeClass('open')
        }

        if ($(e.target).attr('class') === 'nav-ctn open open_max') {
            // navState = false;
            findPad() ? navCtn.removeClass('open_max') : navCtn.removeClass('open')
        }

         if ($(e.target).attr('class') === 'nav-ctn open_max') {
            navState = false;
            findPad() ? navCtn.removeClass('open_max') : navCtn.removeClass('open')
        }
        

        $('.select-region-ctn').removeClass('click')

        dom_mapList.removeClass('show')
        dom_warList.removeClass('show')
        $('.war-lv-list').removeClass('show')
        dom_changeMapBtn.removeClass('click')
        dom_map_lv_list.attr('class', 'map-lv-list')
        dom_map_lv.removeClass('click')
        clickMap = currMap;
        $('.map-item').removeClass('action')
        $(`.map-item-${currMap}`).addClass('action')

        mapLvIsClick = false;
        mapChangeIsClick = false;
        mapMenuIsShow = false;
        if (rightNavIsClick) {
            rightNavIsClick = false;
            $('.right-nav').removeClass('click')
        }


        // 地图选择控制
        if (!mapChangeIsClick) {
            mapChangeIsClick = false;
            mapMenuIsShow = false;
            $('.map-list').removeClass('show')
        }
    })
    let startY = 0;
    navCtn.on('touchstart', (e) => {
        if ($(e.target).attr('class').indexOf('nav-ctn') === -1) return;
        console.log($(e.target).attr('class'));
        e.stopPropagation();
        startY = e.originalEvent.touches[0].clientY;
    })

    function moveNavCtn (e) {
        if ($(e.target).attr('class').indexOf('nav-ctn') === -1) return;
        var currentTouchY = e.originalEvent.touches[0].clientY;
        var touchDifferenceY = currentTouchY - startY;
        navCtn.off("touchmove", moveNavCtn);
        if (touchDifferenceY < 0) {
            // that.toLeft();
            
            findPad() ? navCtn.addClass('open_max') : navCtn.addClass('open')
            console.log('上');
        } else {
            console.log(navCtn.attr('class'));
            if ( navCtn.attr('class') === 'nav-ctn open') {
                navState = false;
                findPad() ? navCtn.removeClass('open_max') : navCtn.removeClass('open')
            } else {
                navState = false;
                findPad() ? navCtn.removeClass('open_max') : navCtn.removeClass('open')
            } 
        }
        setTimeout(autoRoll, 100);
    }

    function autoRoll() {
        // that.canvas.addEventListener("touchmove", touch);
        // that.canvas.addEventListener("touchmove", move);
        navCtn.on('touchmove', moveNavCtn)
        
      }
      autoRoll();

    // 地图选择控制
    dom_changeMapBtn.on('click', function (e) {
        e.stopPropagation();

        mapChangeIsClick = !mapChangeIsClick
        if (mapChangeIsClick) {
            if (isWar) {
                dom_warList.addClass('show')
                dom_war_lv_list.removeClass('top0')
            } else {
                dom_mapList.addClass('show')
                dom_map_lv_list.removeClass('top0')
            }
          
           
            dom_changeMapBtn.addClass('click')
       
            mapMenuIsShow = true;
        } else {
            if (isWar) {
                dom_warList.removeClass('show')
                dom_war_lv_list.attr('class', 'war-lv-list')
            } else {
                dom_mapList.removeClass('show')
                dom_map_lv_list.attr('class', 'map-lv-list')
          
            }
        
            dom_changeMapBtn.removeClass('click')
            // dom_map_lv_list.removeClass('show')
            dom_map_lv.removeClass('click')
            mapLvIsClick = false;
            mapMenuIsShow = false;
        }
        
    })

    dom_map_lv.on('click', function (e) {
        e.stopPropagation();
        mapLvIsClick = !mapLvIsClick
        if (mapLvIsClick) {
            if (isWar) {
                mapMenuIsShow ? dom_war_lv_list.addClass(`show show-${clickMap}`) : dom_war_lv_list.addClass(`show show-${clickMap} top0`)
            } else {
                mapMenuIsShow ? dom_map_lv_list.addClass(`show show-${clickMap}`) : dom_map_lv_list.addClass(`show show-${clickMap} top0`)

            }
           
            
            dom_map_lv.addClass('click')
            // dom_mapList.addClass('show')
            // dom_changeMapBtn.addClass('click')
            // mapChangeIsClick = true;
            // $('.war-lv-list').add('show')
        } else {
            // dom_map_lv_list.removeClass('show')
            dom_map_lv_list.attr('class', 'map-lv-list')
            dom_map_lv.removeClass('click')
            $('.war-lv-list').removeClass('show')
            clickMap = currMap;
        }

        
    })

    // 随机事件列表
    $('.curr-random').on('click', function (e) {
        e.stopPropagation();
        $('.random-list').toggleClass(`map-${currMap}-${currLv}`)
        
    })

    $('.btn-right-nav').on('click', function (e) {
        e.stopPropagation();
        rightNavIsClick = !rightNavIsClick
        rightNavIsClick ? $('.right-nav').addClass('click') : $('.right-nav').removeClass('click')
    })
    
    dom_mapList.on('click', function (e) {
        e.stopPropagation();
        var index = $(e.target).attr('data-index')
        var warMap = $(e.target).attr('data-map')

        if (index) {
            clickMap = index;
            dom_map_lv_list.attr('class', `map-lv-list show show-${clickMap}`)
            mapChangeIsClick = false;
            mapMenuIsShow = false;
            $('.map-item').removeClass('action')
            $('.map-lv-item').removeClass('action')
            dom_map_lv.addClass('click')
            if (clickMap === currMap) {
                if (chooseItemLvName.indexOf('前夜') > -1) {
                    $(`.map-lv-item-3`).addClass('action')
                } else if (chooseItemLvName.indexOf('永夜') > -1) {
                    $(`.map-lv-item-4`).addClass('action')
                } else if (chooseItemLvName.indexOf('永夜') > -1) {
                    $(`.map-lv-item-5`).addClass('action')
                } else {
                    $(`.map-lv-item-${currLv}`).addClass('action')
                }
            }
            $(e.target).addClass('action')
            // dom_mapList.attr('class', `map-list-ctn hover_${index}`)

         
        }
        if (warMap) {
            currWarMap = warMap;
        }
        // dom_mapList.css('width', '2.1rem');
        // isMoveMapList = true;
    })
    dom_warList.on('click', function (e) {
        e.stopPropagation();
        var index = $(e.target).attr('data-index')
        var warMap = $(e.target).attr('data-map')

        if (index) {
            clickMap = index;
            dom_war_lv_list.attr('class', `war-lv-list show show-${clickMap}`)
            mapChangeIsClick = false;
            mapMenuIsShow = false;
            $('.map-item').removeClass('action')
            $('.map-lv-item').removeClass('action')
            dom_map_lv.addClass('click')
            clickMap === currMap && $(`.map-lv-item-${currLv}`).addClass('action')
            $(e.target).addClass('action')

            // dom_mapList.attr('class', `map-list-ctn hover_${index}`)

         
        }
        if (warMap) {
            currWarMap = warMap;
        }
        // dom_mapList.css('width', '2.1rem');
        // isMoveMapList = true;
    })

    var lvText = ['常规', '机密', '绝密']
    var warText = ['PC', '移动']
    // 选择难度等级
    $('.map-lv-item').on('click', function (e) {
        e.stopPropagation();
        var lv = $(e.target).attr('data-lv')
        var type = $(e.target).attr('data-type')
        
        chooseItemLvName = $(e.target).text()
        // 退出楼层
        $('.btn-floor-mod').removeClass('act')
        $('.floor-list').removeClass('show')
        $('.floor-text').text('切换楼层')
        
        if (isFloor) {
            isFloor = false;
            currFloorIndex = -1
            changeMapLv(`${currMap + lv}`)
            enterFloorSave();
            outFloor = true;
        }
        $('.nav-option-ctn').removeClass('floor')

        if (isWar) {
            resetAll('none')
            toggleVisible(`none`, currLeftNav);
            changeWarMap(currWarMap, type)
            $('.type-change-ctn').addClass('show')  
            // initNav();
            // bindOptionEvent();
        } else if (clickMap == 1 || clickMap == 2) {
            if ((clickMap == 1 || clickMap == 2) && isZj) {
                changeMapLv(clickMap + lv + '_s');
            } else {
                changeMapLv(clickMap + lv);
            }
            $('.zj-ctn').addClass('show')   
            $('.type-change-ctn').removeClass('show')  
            $('.curr-random').css('display', 'block')
            $('.random-list').removeClass('close')
            
        } else {
            console.log('这里', clickMap);
            
            changeMapLv(clickMap + lv);
            $('.zj-ctn').removeClass('show')   
            $('.type-change-ctn').removeClass('show') 
             $('.curr-random').css('display', 'none')
            $('.random-list').addClass('close')
           
        }
       
        console.log(123, currMap + lv);
        if (currMap + currLv !== currMap + lv) {
            if (isWar) {
                $('.curr-map-lv').text(warText[Number(lv)] )
            }
            if (window.pervInitX !== window.occupy ? mapScaleInfo.initX_s : mapScaleInfo.initX){
                map.flyTo([window.occupy ? mapScaleInfo.initX_s : mapScaleInfo.initX,  window.occupy ? mapScaleInfo.initY_s : mapScaleInfo.initY], window.occupy ? mapScaleInfo.initZoom_s : mapScaleInfo.initZoom)
          
            
                window.pervInitX = window.occupy ? mapScaleInfo.initX_s : mapScaleInfo.initX
            }
           
        }
        currMap = clickMap;
        currLv = lv;
        currWarType = type

        $('.map-lv-item').removeClass('action')
        if (chooseItemLvName.indexOf('前夜') > -1) {
            $(`.map-lv-item-3`).addClass('action')
        } else if (chooseItemLvName.indexOf('永夜') > -1) {
            $(`.map-lv-item-4`).addClass('action')
        } else if (chooseItemLvName.indexOf('永夜') > -1) {
            $(`.map-lv-item-5`).addClass('action')
        } else {
            $(`.map-lv-item-${currLv}`).addClass('action')
        }
       
        

        dom_mapList.removeClass('show')
        dom_warList.removeClass('show')
        $('.war-lv-list').removeClass('show')
        dom_changeMapBtn.removeClass('click')
        dom_map_lv_list.attr('class', 'map-lv-list')
        dom_war_lv_list.attr('class', 'war-lv-list')
        dom_map_lv.removeClass('click')
        mapLvIsClick = false;
        if (!isWar) {
            resetAll('none')
            toggleVisible(`none`, currLeftNav);
        }

        // 清除随机事件
        $('.random-item').removeClass('random-act')
        $('.random-list').attr('class', 'random-list')
    })

        // 坠机事件
        $('.zj-ctn').on('click', function () {
            isZj = !isZj;
            isZj ? $('.zj-ctn').addClass('open') : $('.zj-ctn').removeClass('open')
            
            enterRandomEvent();
        })

        let currRandomText = ''
        // 多选随机事件
        $('.random-item').on('click', function () {
            $(this).toggleClass('random-act')
            let length = $('.random-act').length
            if (length) {
                $('.random-list').removeClass('close')
                isZj = true;
            } else {
                $('.random-list').addClass('close')
                isZj = false;
            }
            $('.random-list').attr('class', 'random-list')
            enterRandomEvent();
            // currMap = currMoveMap;
        })
        
        // 关闭随机事件
        $('.random-item-close').on('click', () => {
            $('.random-item').removeClass('random-act')
            $('.random-list').addClass('close')
            isZj = false;
            enterRandomEvent();
        })

        // 弹窗进入楼层
        $('.btn-pop-floor').on('click', function () {
            var name = $(this).attr('data-name')
            var floor = $(this).attr('data-floor')
            var index = Number($(this).attr('data-index'))
            var floorRegion = $(this).attr('data-region')
            console.log('name', currMap, currLv, floor, index);
            outFloor = false;
            isFloor = true;
            var currentFloorList = getCurrentFloorList(floorRegion);
            currFloorIndex = getFloorIndexByCode(currentFloorList, floor, index);
            if (currFloorIndex === -1) return;
            var currentFloor = currentFloorList[currFloorIndex];
            currFloorRegion = normalizeFloorRegionName(floorRegion || currentFloor.floor_name);
            $('.nav-option-ctn').addClass('floor')
            saveMarker = Object.assign({}, visibleMarker);
            changeMapLv(buildFloorMapPath(currentFloor, floor))
            enterFloorSave();
            $('.m-index').addClass('floor')
            $('.floor-text').text('退出楼层')
            $('.btn-floor-mod').addClass('act')
            $('.floor-list').addClass('show')
        })

    // 打开日志
    $('.btn-log').on('click', function (e) {
        e.stopPropagation();
        // toastTips();
        $('.log-pop').fadeIn();
    })

    // 关闭日志弹窗
    $('.btn-close-pop').on('click', function () {
        $('.log-pop').fadeOut();
    })

    $('.btn-share').on('click', function () {
        // $('.bottom-bar').fadeIn();
        // $('.bottom-bar').addClass('show')
        
        if (browser.versions.QQ || browser.versions.Wechat) {
            $('.share-tips').fadeIn();
        } else {
            $('.pop-copy').fadeIn();
        }
    })
    $('.share-tips').on('click', function () {
        $('.share-tips').fadeOut();
    })
    $('.bottom-bar').on('click', function() {
        $('.bottom-bar').removeClass('show')
        $('.bottom-bar').fadeOut();
    })

    // 快速定位
    $('.select-region-ctn').on('click', function (e) {
        e.stopPropagation();
        $(this).attr('class').indexOf('click') > -1? $(this).removeClass('click') : $(this).addClass('click')
        
    });

    $('.region-item').on('click', anchorRegion)
    // $('.region-item').on('click',  function (e) {
    //     e.stopPropagation();
    //     var x = $(e.target).attr('data-x');
    //     var y = $(e.target).attr('data-y');
    //     var pos = getMapPos(x, y)
    //     map.flyTo([pos.y, pos.x], 5)
    //     $('.region-item').removeClass('action')
    //     $(this).addClass('action')
    // })
    

    // 搜索
    $('.select-iput').on('input',  debounce(function (e) {
        var name = $(e.target).val()
        selectmarker(name)
    }, 500));
    

    // 关闭搜索
    $('.btn-close-select').on('click', function () {
        
        if ($('.select-iput').val() === '') {
            navState = false;
            navCtn.attr('class').indexOf('open_max') > -1 ? navCtn.removeClass('open_max') : navCtn.removeClass('open')
        } else {
            $('.select-iput').val('')
            $('.map-select').removeClass('show')
        }

        if (Number(currLeftNav) === 0) {
            renderNavTypeList(allNavList[0].typeList, 0)
        } else {
            renderNavTypeList(navTypeList[currLeftNav].typeList, currLeftNav)
        }
        bindOptionEvent();
    })

    $('.btn-tutorial').on('click', function () {
        toastTips();
    })

    // 反馈
    $('.btn-feedback').on('click', function () {
        window.open('https://wj.qq.com/s2/15023838/70c7/')
    })

    $('.bottom-bar-list').on('click', function () {
        toastTips();
    })

    $('.btn-cfm-copy').on('click', () => {
         // 获取输入框的最新值
         var shareLink = document.getElementById('shareLink');
         var text = shareLink ? (shareLink.textContent || shareLink.innerText ||shareLink.value) : '';

        if (navigator.clipboard && window.isSecureContext) {
            // 对于支持 Clipboard API 的现代浏览器
            navigator.clipboard.writeText(text).then(function() {
                showMsg('链接已复制到剪贴板');
            }, function(err) {
                console.error('无法复制文本: ', err);
            });
        } else {
            // 回退方案：创建一个临时文本区域
            var textArea = document.createElement("textarea");
            textArea.value = text;

            // 避免滚动到底部
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                var successful = document.execCommand('copy');
                var msg = successful ? '链接已复制到剪贴板' : '复制失败';
                showMsg(msg);

            } catch (err) {
                console.error('无法复制文本: ', err);
            }

            document.body.removeChild(textArea);
        }
        $('.m-toast2').fadeIn();
        $('.pop-copy').fadeOut();
        setTimeout(() => {
            $('.m-toast2').fadeOut();
        }, 1500)
    })

    // navCtn.on('touchstart', (e) => {
    //     console.log(e);
    // })


    // 全面战场
    $('.btn-war-change').on('click', () => {
        enterWarMap();
    })
    
    // 切换视角
    $('.btn-view-change').on('click', () => {
        window.viewChange = !window.viewChange
        window.isViewChange = true;
        if (window.viewChange) {
            $('.nav-option-ctn').addClass('g');
            $('.nav-option-ctn').removeClass('f');
            $('.war-lv-change-list').attr('class', 'war-lv-change-list g')
        } else {
            $('.nav-option-ctn').addClass('f');
            $('.nav-option-ctn').removeClass('g');
            $('.war-lv-change-list').attr('class', 'war-lv-change-list f')

        }
        warInit(currWarMap, currWarType, true);
        viewChangeToMap();
        setTimeout(() => {
            window.isViewChange = false;
        }, 800);
    })
    // 进攻方视角
    $('.view-change1').on('click', () => {
        if (!window.viewChange) {
            window.viewChange = true;
            $('.btn-view-change').addClass('g')
            $('.btn-view-change').removeClass('f')
            $('.nav-option-ctn').addClass('g');
            $('.nav-option-ctn').removeClass('f');
            $('.war-lv-change-list').attr('class', 'war-lv-change-list g')
            warInit(currWarMap, currWarType, true);
            viewChangeToMap();
        }
    })

    // 防守方视角
    $('.view-change2').on('click', () => {
        if (window.viewChange) {
            window.viewChange = false;
            $('.btn-view-change').addClass('f')
            $('.btn-view-change').removeClass('g')
            $('.nav-option-ctn').addClass('f');
            $('.nav-option-ctn').removeClass('g');
            $('.war-lv-change-list').attr('class', 'war-lv-change-list f')
            warInit(currWarMap, currWarType, true);
            // console.log(cacheMarker);
            viewChangeToMap();
        }
    })

    $('.type-change-ctn').on('click', () => {
        window.occupy = !window.occupy;
        if (window.occupy) {
            console.log(11111, window.occupy);
            
            $('.type-change-ctn').addClass('open')
            $('.lv-change-ctn').css('display', 'none')
            $('.select-region-ctn').css('display', 'none')
        } else {
            $('.type-change-ctn').removeClass('open')
            $('.lv-change-ctn').css('display', 'flex')
            $('.select-region-ctn').css('display', 'block')
        }
        
        console.log('事件', currWarMap, currWarType);
        
        changeWarMap(currWarMap, currWarType);
        // initNav();
        // bindOptionEvent();
        // warInit(currWarMap, currWarType);
    })

    $('.lv-change-prev').on('click', () => {
        if (window.isLvChange) return;
        if (window.warLv === 0) return;
        window.isLvChange = true;
        window.warLv--;
        changeWarMap(currWarMap, currWarType);
        // initNav();
        // bindOptionEvent();
        $('.lv-change-tips').text(`区域${window.warLv+1}`)
        $('.deploy-swiper').removeClass('show')
        map.flyTo([window[currWarMap].info.sectorInit[window.warLv].initX,  window[currWarMap].info.sectorInit[window.warLv].initY], window[currWarMap].info.sectorInit[window.warLv].initZoom)
        setTimeout(() => {
            window.isLvChange = false;
        }, 1000)
    })

    $('.lv-change-next').on('click', () => {
        if (window.isLvChange) return;
        if (window.warLv === window[currWarMap].info.sector - 1) return;
        window.isLvChange = true;
        window.warLv++;
        changeWarMap(currWarMap, currWarType);
        // initNav();
        // bindOptionEvent();
        $('.lv-change-tips').text(`区域${window.warLv+1}`)
        $('.deploy-swiper').removeClass('show')
        console.log('currWarMap', currWarMap);
        
        map.flyTo([window[currWarMap].info.sectorInit[window.warLv].initX,  window[currWarMap].info.sectorInit[window.warLv].initY], window[currWarMap].info.sectorInit[window.warLv].initZoom)
        setTimeout(() => {
            window.isLvChange = false;
        }, 1000)
    })

    $('.btn-swiper-prev').on('click', () => {
        window.warSwiper.slidePrev();
    })

    $('.btn-swiper-next').on('click', () => {
        window.warSwiper.slideNext();
    })

    // 切换楼层部分
    const btn_floor = $('.btn-floor-mod')
    btn_floor.on('click', () => {
        enterFloor();
       
    })
    
}

// 视角切换
function viewChangeToMap () {
    
    $.each(cacheMarker, function (index) {
        console.log(window.viewChange, this.options.icon);
        if (this.options.icon.name === "进攻方基地" ) {
            console.log(`${window.viewChange ? 'g_jdbsd_g': 'g_jdbsd_r'}`);
            var icon = L.divIcon({
                className: ` map-war-icon`,
                html: `<div class="map-icon-bg"><img src="../img/dzc_i/${window.viewChange ? 'g_jdbsd_g': 'g_jdbsd_r'}.png"/></div>`,
                iconSize: [30, 30],			//设置图标大小
                iconAnchor: [15, 15],		//设置图标偏移
            })
            icon.name = '进攻方基地'
            this.setIcon(icon);
        } else if (this.options.icon.name === "防守方基地") {
            var icon = L.divIcon({
                className: ` map-war-icon`,
                html: `<div class="map-icon-bg"><img src="../img/dzc_i/${window.viewChange ? 'f_jdbsd_r': 'f_jdbsd_g'}.png"/></div>`,
                iconSize: [30, 30],			//设置图标大小
                iconAnchor: [15, 15],		//设置图标偏移
            })
            icon.name = '防守方基地'
            this.setIcon(icon);
        }
    })
}

// 进入楼层通用方法
function enterFloor (regionName) {
    const floorList = $('.floor-list')
    const floor_text = $('.floor-text')
    floorList.attr('class').indexOf('show') > -1 ? floorList.removeClass('show') : floorList.addClass('show')
    if ($('.btn-floor-mod').attr('class').indexOf('act') > -1) {
        const skipKeepAllOnExit = shouldSkipAllSelectionWhenExitFloor();
        $('.btn-floor-mod').removeClass('act')
        floor_text.text('切换楼层')
        if (isFloor) {
            isFloor = false;
            currFloorIndex = -1;
            // ★ 清除建筑/楼层记忆：避免上一栋楼（如雷达站 B1）残留，导致退出后楼层切换列表被过滤/缺失
            currFloorRegion = '';
            if (skipKeepAllOnExit) {
                resetAll('none');
                saveMarker = {};
            }
            changeMapLv(`${currMap + currLv}`)
            if (!skipKeepAllOnExit) {
                enterFloorSave();
            }
            outFloor = true;
            // 回主图后按整图重建楼层切换列表（覆盖雷达站残留的单栋楼子列表）
            if (mapScaleInfo && (mapScaleInfo.floorInfo || (mapScaleInfo.floor && mapScaleInfo.floor.length))) {
                initFloor();
            }
        }
        $('.nav-option-ctn').removeClass('floor')
        $('.m-index').removeClass('floor')
    } else {
        $('.btn-floor-mod').addClass('act')
        floor_text.text('退出楼层')
        $('.m-index').addClass('floor')
    }
}

// 重制楼层
function resetFloor () {
    $('.map-floor-change-ctn').removeClass('show')
    isFloor = false;
    outFloor = true;
    currFloorIndex = -1;
    currFloorRegion = '';
}

// 查找是否有楼层
function findFloor (regionName) {
    let floorInfo = resolveFloorList(regionName, false);
    if (floorInfo && floorInfo.length) {
        enterFloor();
        $('.btn-floor-mod').addClass('show')

    }
}

function enterWarMap () {
        isWar = !isWar;
        isFloor = false;
        outFloor = true;
        window.occupy = false;
        window.viewChange = true;
        $('.btn-view-change').addClass('g')
        $('.btn-view-change').removeClass('f')
        $('.nav-option-ctn').addClass('g');
        $('.nav-option-ctn').removeClass('f');
        $('.war-lv-change-list').attr('class', 'war-lv-change-list g')
        $('.zj-ctn').removeClass('show')

        if (isWar) {
            // dom_changeMapBtn.addClass('war')
            $('.map-list-ctn').addClass('war')
            $('.btn-change-map-ctn').addClass('war')
            $('.btn-war-change').addClass('war')
            $('.btn-view-change').addClass('show')
            $('.btn-floor-mod').removeClass('show')
            $('#MapContainer').removeClass('map')
            $('.floor-list').removeClass('show')
            // changeWarMap('jq', 'pc');
            currWarMap = 'pc';
            currWarType = 'pc';
            if (getQuery('map').indexOf('dzc') !== -1) {
                // 从第4位开始截取getQuery('map')
                const mapName = getQuery('map').substring(4);
                currWarMap = mapName === 'fby' ? 'hdz': mapName;
                console.log('currWarMap', currWarMap);
                changeWarMap(currWarMap, 'pc');
                
            } else {
                changeWarMap('pc', 'pc');
            }
            $('.random-list').addClass('close')

            // initNav();
            // bindOptionEvent();
            $('.war-lv-change-ctn').addClass('show')
            $('.curr-map-lv').text('PC')
            $('.type-change-ctn').addClass('show')  
            navTypyList.addClass('war')
            $('.war-change-text').text('烽火地带')
            $('.random-list').addClass('close')
            $('.curr-random').css('display', 'none')
            $('.war-list').show();

        } else {
            // dom_changeMapBtn.removeClass('war')
            $('.map-list-ctn').removeClass('war')
            $('.btn-change-map-ctn').removeClass('war')
            $('.btn-war-change').removeClass('war')
            $('.btn-view-change').removeClass('show')
            $('.type-change-ctn').attr('class', 'type-change-ctn') 
            $('.btn-floor-mod').addClass('show')
            $('#MapContainer').addClass('map')
            // $('.floor-list').addClass('show')
            changeMapLv('00');
            warRemove();
            currMap = '0';
            clickMap = '0';
            currLv = '0'
            initNav();
            bindOptionEvent();
            $('.war-lv-change-ctn').removeClass('show')
            $('.curr-map-lv').text('常规')
            navTypyList.removeClass('war')
            $('.check-title').text('快速定位')
            $('.war-change-text').text('全面战场')
            dom_war_lv_list.attr('class', 'war-lv-list')
            $('.select-region-ctn').css('display', 'block')
            $('.map-item').removeClass('action')
            $('.map-item-0').addClass('action')
            $('.war-list').hide();
            if (currMap === '1' || currMap === '2') {
                 $('.curr-random').css('display', 'block')
                $('.random-list').removeClass('close')
            }
           
        }
}

// 战场切换
function changeWarMap(mapName, type) {
    console.log('mapName', mapName, type, window.occupy, window[mapName]);
    
    visibleMarker = {}
    mapScaleInfo = window[mapName].info;
    poiInfo =  window[mapName].region;
    currWarType = type;
    if (window.occupy) {
        currWarType = type;
        poiInfo = window[mapName].region
        mapIcons = window[`${mapName}_${type}_s`].mapArticle;
        allNavList = window[`${mapName}_${type}_s`].navRegion;
        navTypeList = window[`${mapName}_${type}_s`].navRegionInfo;
        if (currLayer.name !== mapScaleInfo.names) {
            map.removeLayer(currLayer)
            addLayer(mapScaleInfo[`names_${currWarType}`])
        }
    } else {
        mapIcons = window[`${mapName}_${type}`].mapArticle[window.warLv];
        allNavList = window[`${mapName}_${type}`].navRegion[window.warLv];
        navTypeList = window[`${mapName}_${type}`].navRegionInfo[window.warLv];
        if (currLayer.name !== mapScaleInfo.name) {
            map.removeLayer(currLayer)
            addLayer(mapScaleInfo[`name_${currWarType}`])
        }
    }
   
    console.log(window[`${mapName}_${type}`].title);
    
    $('.curr-map-name').html(`${window[`${mapName}_${type}`].title}`)
    
    
   
    typeListInit = false;

    initNav();
    warInit(currWarMap, currWarType);


    bindOptionEvent();
}

// 战场初始化
function warInit (mapName, type, isBorder = false) {

    var init;
    init = window.occupy ? window[`${mapName}_${type}_s`].init : window[`${mapName}_${type}`].init
    // if (window.viewChange) {
    //     init = window.occupy ? window[`${mapName}_${type}_s`].init_g : window[`${mapName}_${type}`].init_g
    // } else {
    //     init = window.occupy ? window[`${mapName}_${type}_s`].init_s : window[`${mapName}_${type}`].init_s
    // }
    if (!window.isViewChange) {
        listIsAll[currLeftNav] = false;
        $('.choose-all').attr('class', 'img_all_close choose-all')
    }
    
    $.each(borderList, function () {
        this.remove();
    
    });

    if (!isBorder) {
        $.each(warMark, function () {
            this.remove();
        
        });
    
        $.each(cacheMarker, function () {
            this.remove();
        
        });
    } else {
        $.each(cacheMarker, function () {
            if (this.options.icon.name) {
                if (this.options.icon.name.indexOf('据点') > -1) {
                
                    this.remove();
                }
            }
            if (this.options.icon.options.html.indexOf('jd') > -1) {
                this.remove();
            }
        });
    }

    // visibleMarker = []
    
    borderList = []

    var initList = [];
    // 是否是占领模式
    if (window.occupy) {
        initList = init
    } else {
        initList = init[window.warLv].typeList
    }

    let lineHtmlg = ''
    let lineHtmlf = ''
    let lineHtmlz = ''

    
    
    for (let index = 0; index < initList.length; index++) {
        const element = initList[index];
        
        if (element.border) {
            // if (element.region.indexOf('进攻') > -1) {
            //     drawBorder('red', element.border)
            // }

            //  if (element.region.indexOf('防守') > -1){
            //     drawBorder('green', element.border)
            // }

            // if (element.isRegion === 'true') {
            //     drawBorder('white', element.border)
            // }

            if (element.name.indexOf('据点') > -1) {
                drawBorder(window.occupy ? 'white' : 'green', element.border, true)
            } else {
                if (element.region.indexOf('进攻') > -1 || element.region.indexOf('GTI') > -1) {
                    drawBorder(window.viewChange ? 'green' : 'red', element.border)
                } else if (element.region.indexOf('防守') > -1 || element.region.indexOf('HAAVK') > -1){
                    drawBorder(window.viewChange ? 'red' : 'green', element.border)
                } else {
                    drawBorder('white', element.border)
                }
            }
            

           
        }

        if (element.isRegion === "false") {
            
            var pos = getMapPos(element.x, element.y)
            let myIcon;
            if (element.name.indexOf('据点') > -1) {
                lineHtmlz += `<div class="war-lv-jd img_nav_jd_${element['自定义区域']}"></div>`
            } else {
                if (element.region.indexOf('进攻') > -1 || element.region.indexOf('GTI') > -1) {
                    lineHtmlg += `<div class="war-lv-item ${window.viewChange ? 'green' : 'red'}"></div>`
                } else if (element.region.indexOf('防守') > -1 || element.region.indexOf('HAAVK') > -1){
                    lineHtmlf += `<div class="war-lv-item ${window.viewChange ? 'red' : 'green'}"></div>`
                }
            }
           let icon;
           if (element.name === "进攻方基地" ) {
                icon = window.viewChange ? 'g_jdbsd_g': 'g_jdbsd_r'
            } else if (element.name === "防守方基地") {
                icon = window.viewChange ? 'f_jdbsd_r': 'f_jdbsd_g'
            } else {
                icon = element.icon
            }

            if (element.rotate) {
                let rotate = currWarMap === 'qhz' ? 90 : 180
                myIcon = L.divIcon({
                    className: ` map-war-icon`,
                    html: `<div class="map-icon-bg" style="transform: translate3d(-50%, -50%, 0) rotate(${Number(element.rotate) + rotate}deg)"><img src="../img/dzc_i/${icon}.png"/></div>`,
                    iconSize: [30, 30],			//设置图标大小
                    iconAnchor: [15, 15],		//设置图标偏移
                })
            } else {
                myIcon = L.divIcon({
                    className: ` map-war-icon`,
                    html: `<div class="map-icon-bg"><img src="../img/dzc_i/${icon}.png"/></div>`,
                    iconSize: [30, 30],			//设置图标大小
                    iconAnchor: [15, 15],		//设置图标偏移
                })
            }
            myIcon.name = element.name;
            myIcon.icon = icon;
            visibleMarker[element.name] = true;
            
            $(`.nav-list-nav${icon.substring(1)}`).addClass(`img_nav${icon.substring(1)}_click active`)
            var popupHtml = `
                <div class="name">${element?.sub_name || element.name}</div>
            `;
            // popupHtml += '</div>';
            cacheMarker.push(L.marker([pos.y, pos.x], {icon: myIcon}).bindPopup(popupHtml).addTo(map).on({
                click: function () {
                    currClickMarker?.setIcon(currClickMarker?.myIcon)
                    this.isClick = true;
                    this.myIcon = myIcon;
                    let rotate = currWarMap === 'qhz' ? 90 : 180
                    this.openPopup();
                    this.setIcon( L.divIcon({
                        className: ` map-war-icon click`,
                        html: `<div class="map-icon-bg" style="${element?.rotate ? `transform: translate3d(-50%, -50%, 0) rotate(${Number(element?.rotate) + rotate}deg)` : ''}"><img src="../img/dzc_i/${icon}.png"/></div>`,
                        iconSize: [50, 50],			//设置图标大小
                        iconAnchor: [25, 25],		//设置图标偏移
                    }));
                    currClickMarker = this;
                    $(this.getElement()).addClass('click')
                    if (element['随机']) {
                        markerName.html(`${element?.sub_name || element.name}${element['拾取条件'] && element['拾取条件'] !== ''? `<span> ( ${element['拾取条件']} ) </span>`: ` [${element['随机']}]`}`)
                    } else {
                        markerName.html(`${element?.sub_name || element.name}${element['拾取条件'] && element['拾取条件'] !== ''? `<span> ( ${element['拾取条件']} ) </span>`: ''}`)
                    }
                    
                    if (this.myIcon.name.indexOf('基地') > -1 || (this.myIcon.name.indexOf('据点') > -1 && window.occupy)) {
                        initWarSwiper(this.myIcon.name, element);
                    }
                    addressName.html(element['自定义区域'])
                    markerPop.addClass('show')
                    
                    // this?.remove()
                },
                popupclose: function () {
                    markerPop.removeClass('show')
                }
            }))
            
            
           
        }

       
    }
    listIsAll[1] = true;
    listIsAll[2] = true;
   $('.war-lv-change-list').html(lineHtmlg + lineHtmlz + lineHtmlf)
    
}

// 清除战场
function warRemove () {
    $.each(borderList, function () {
        this.remove();
    
    });
    $.each(warMark, function () {
        this.remove();
    
    });
}

// 部署swiper
function initWarSwiper (name, data) {
    // if (window.warSwiper) {
    //     window.warSwiper.destroy(true);
    // }

    let html = '';
    console.log(data);
    let list = window.occupy ? window[currWarMap + '_' + currWarType + '_s'].deploy : window[currWarMap + '_' + currWarType].deploy[window.warLv]
    console.log(name, list);
    let length = 0;
    
   
    $.each(list, function(index) {
        
        if (name.indexOf(this['阵营']) > -1 && !window.occupy) {
            length++;
            if (this?.type) {
                html += ` <div class="swiper-slide">
                <div class="slide-name">${this.name}</div>
                <div class="slide-bot">
                    <div class="slide-img-ctn">
                        <div class="slide-img ${this.icon}"></div>
                    </div>
                    <div class="slide-info">
                        <div class="slide-help">所需积分:${this.num}</div>
                    </div>
                </div>
            </div>`
            } else {
                if (this['备注'] !== data['自定义区域'] && this['备注'] !== data['备注']) return;
                html += ` <div class="swiper-slide">
                <div class="slide-name">${this.name}</div>
                <div class="slide-bot">
                    <div class="slide-img-ctn">
                        <div class="slide-img ${this.icon}"></div>
                    </div>
                    <div class="slide-info">
                        <div class="slide-tiem">${this.CD}s</div>
                        <div class="slide-num">可部署:${this.num}</div>
                    </div>
                </div>
            </div>`
            }
        // } else if ((name.indexOf(this['阵营']) > -1) && window.occupy) {
        } else if (this['备注'] === data['自定义区域'] && window.occupy) {
        //     length++;
        //     if (this?.type) {
        //         html += ` <div class="swiper-slide">
        //         <div class="slide-name">${this.name}</div>
        //         <div class="slide-bot">
        //             <div class="slide-img-ctn">
        //                 <div class="slide-img ${this.icon}"></div>
        //             </div>
        //             <div class="slide-info">
        //                 <div class="slide-help">所需积分:${this.num}</div>
        //             </div>
        //         </div>
        //     </div>`
        //     } else {
        //         console.log('潜质判断', this['备注'], (this['备注'] !== data['备注']) && this['阵营'] !== name, name.indexOf(this['阵营']));
                
        //         if (this['备注'] && this['备注'] !== '' && (this['备注'] !== data['备注']) && this['阵营'] !== name) return;
                
        //         console.log('占领有', this['备注'], data['备注'], name, (this['备注'] !== data['备注']) && this['阵营'] !== name);
        //         html += ` <div class="swiper-slide">
        //         <div class="slide-name">${this.name}</div>
        //         <div class="slide-bot">
        //             <div class="slide-img-ctn">
        //                 <div class="slide-img ${this.icon}"></div>
        //             </div>
        //             <div class="slide-info">
        //                 <div class="slide-tiem">${this.CD}s</div>
        //                 <div class="slide-num">可部署:${this.num}</div>
        //             </div>
        //         </div>
        //     </div>`
        //     }
        // }
        length++;
                html += ` <div class="swiper-slide">
                <div class="slide-name">${this.name}</div>
                <div class="slide-bot">
                    <div class="slide-img-ctn">
                        <div class="slide-img ${this.icon}"></div>
                    </div>
                    <div class="slide-info">
                        <div class="slide-tiem">${this.CD}s</div>
                        <div class="slide-num">可部署:${this.num}</div>
                    </div>
                </div>
            </div>`
        } else if (this['阵营'] === data['name']) {
            html += ` <div class="swiper-slide">
                <div class="slide-name">${this.name}</div>
                <div class="slide-bot">
                    <div class="slide-img-ctn">
                        <div class="slide-img ${this.icon}"></div>
                    </div>
                    <div class="slide-info">
                        <div class="slide-tiem">${this.CD}s</div>
                        <div class="slide-num">可部署:${this.num}</div>
                    </div>
                </div>
            </div>`
        }

        

        
    })

    // if (length < 7) {
    //     $('.btn-swiper-prev').css('display', 'none')
    //     $('.btn-swiper-next').css('display', 'none')
    // } else {
    //     $('.btn-swiper-prev').css('display', 'block')
    //     $('.btn-swiper-next').css('display', 'block')
    // }
    
 
    $('.swiper-wrapper').html(html)

    // window.warSwiper= new Swiper('.swiper-container', {
    //     slidesPerView: 'auto',
    // });

    if (html !== '') {
        $('.deploy-swiper').addClass('show')
    } else {
        $('.deploy-swiper').removeClass('show')
    }
  

    
}

// 进入随机事件
function enterRandomEvent (){
    if (isZj) {
         let randomText = $('.random-act').text()
        if ($('.curr-map-lv').text() === '常规' || $('.curr-map-lv').text() === '前夜') {
            console.log('有没有', $('.random-act').text().indexOf('坠机'));
            
            if (randomText.indexOf('坠机') > -1 || randomText.indexOf('断桥') > -1) {
                changeMapLv(currMap + currLv + '_s');
            } else{
                changeMapLv(currMap + currLv);
            }
         
            if (currMap + currLv !== '10_s' || currMap + currLv !== '21_s') {
                // map.setView([mapScaleInfo.initX, mapScaleInfo.initY], mapScaleInfo.initZoom)
                map.flyTo([mapScaleInfo.initX,  mapScaleInfo.initY], mapScaleInfo.initZoom)
            }
            currLv = '0'
        } else {
            if (randomText.indexOf('坠机') > -1 || randomText.indexOf('断桥') > -1) {
                changeMapLv(currMap + currLv + '_s');
            } else{
                changeMapLv(currMap + currLv);
            }
            if (currMap + currLv !== '11_s' || currMap + currLv !== '22_s') {
                map.flyTo([mapScaleInfo.initX,  mapScaleInfo.initY], mapScaleInfo.initZoom)
            }
            currLv = '1'
        }
        
    } else {
        if ($('.curr-map-lv').text() === '常规' || $('.curr-map-lv').text() === '前夜') {
            changeMapLv(currMap + currLv);
            if (currMap + currLv !== '10' || currMap + currLv !== '21') {
                // map.setView([mapScaleInfo.initX, mapScaleInfo.initY], mapScaleInfo.initZoom)
                map.flyTo([mapScaleInfo.initX,  mapScaleInfo.initY], mapScaleInfo.initZoom)
            }
            currLv = '0'
        } else {
            changeMapLv(currMap + currLv);
            if (currMap + currLv !== '11' || currMap + currLv !== '22') {
                map.flyTo([mapScaleInfo.initX,  mapScaleInfo.initY], mapScaleInfo.initZoom)
            }
            currLv = '1'
        }
    }
    resetAll('none')
    toggleVisible(`none`, currLeftNav);
}

// 数据分类
function dataFilter (mapArticle) {
    // 保险箱
    let arr = [
        {
        name: "保险箱"
      },
      {
        name: "小保险箱"
      },
      {
        name: "服务器"
      },
      {
        name: "电脑"
      },
      {
        name: "电脑机箱"
      },
      {
        name: "武器箱"
      },
      {
        name: "大武器箱"
      },
      {
        name: "弹药箱"
      },
      {
        name: "工具柜"
      },
      {
        name: "收纳盒"
      },
    //   {
    //     name: "一件衣服"
    //   },
      {
        name: "一件衣服"
      },
      {
        name: "军用医疗包"
      },
      {
        name: "医疗物资堆"
      },
      {
        name: "旅行包"
      },
      {
        name: "手提箱"
      },
      {
        name: "储物柜"
      },
      {
        name: "高级储物箱"
      },
      {
        name: "抽屉柜"
      },
      {
        name: "登山包"
      },
      {
        name: "快递箱"
      },
      {
        name: "航空储物箱"
      },
      {
        name: "垃圾桶"
      },
      {
        name: "搅拌车"
      },
      {
        name: "野外物资箱"
      },
      {
        name: "鸟窝"
      },
      {
        name: "藏匿物"
      },
      {
        name: "高级旅行箱"
      },
      {
        name: "出生点"
      },
      {
        name: "付费撤离点"
      },
      {
        name: "常规撤离点"
      },
      {
        name: "概率撤离点"
      },
      {
        name: "列车撤离点"
      },
      {
        name: "首领"
      }
    ]
    let arrInfo = [
         { 
            titleType: "all",
            title: "全部",
            typeList: []
        },
        { 
            titleType: "cbt",
            title: "藏宝图",
            typeList: []
        },
        { 
            titleType: "wzd",
            title: "物资点",
            typeList: []
        },
        {
            titleType: 'mode',
            title: '泄露区物资点',
            typeList: []
        },
        {
            titleType: 'my',
            title: '密钥刷新点',
            typeList: []
        },
        {
            titleType: 'qxj',
            title: '清洗间点位',
            typeList: []
        },
        {
            titleType: 'csd',
            title: '出生点',
            typeList: []
        },
        {
            titleType: "cld",
            title: "撤离点",
            typeList: []
        },
        {
            titleType: "首领",
            title: "首领",
            typeList: []
        }
    ];
    let numList = {}

    console.log('mapArticle', mapArticle);
    for (let index = 0; index < mapArticle.length; index++) {
        const element = mapArticle[index];
       
        if (element.name.indexOf('接取站') !== -1) {
            continue;
        }

        if (element.icon === 'boss') {
            element.name = '首领'
        }
         numList[element.name] = numList[element.name] ? numList[element.name] + 1 : 1
        // 检测数组中是否存在这一项,如果存在则不在添加
        if (!arr.some(item => item.name === element.name)) {
          
            arr.push({
                name: element.name,
                icon: 'nav_' + element.icon,
            })
            
        } else {
            // 存在则更新图标
            const existingItem = arr.find(item => item.name === element.name);
            existingItem.icon = 'nav_' + element.icon;
        }
    }
    
    for (let index = 0; index < arr.length; index++) {
        const element = arr[index];
        if (element.icon === 'boss') {
            element.name = '首领'
        }
        if (numList[element.name]) {
            element.num = numList[element.name]
        }
        

        if (element.name === '出生点') {
            arrInfo[2]['typeList'].push(element)
        } else if (element.name.indexOf('撤离点') > -1) {
            arrInfo[3]['typeList'].push(element)
        } else if (element.name === '首领') {
            arrInfo[4]['typeList'].push(element)
        } else {
            arrInfo[1]['typeList'].push(element)
        }
    }
    console.log('数据分类', arr);
    arrInfo[0]['typeList'] = arr
    console.log('数据分类2', arrInfo);
    return {
        arr,
        arrInfo
    }
    
}

renderNavTypeList = function (list, navIndex = 0) {
    list = Array.isArray(list) ? list : [];
    const seenFilterKeys = new Set();
    const categories = {
        cbt: { title: '藏宝图', html: '' },
        wz: { title: '物资点', html: '' },
        mode: { title: '泄露区物资点', html: '' },
        my: { title: '密钥刷新点', html: '' },
        qxj: { title: '清洗间点位', html: '' },
        csd: { title: '出生点', html: '' },
        cld: { title: '撤离点', html: '' },
        sl: { title: '首领', html: '' },
        jd: { title: '据点', html: '' },
        jdbsd: { title: '基地部署点', html: '' },
        zj: { title: '载具', html: '' },
        zjbjz: { title: '载具补给站', html: '' },
        gddyx: { title: '固定弹药箱', html: '' },
        gdwq: { title: '固定武器', html: '' },
        zz: { title: '装置', html: '' },
        yl: { title: '鱼类', html: '' }
    };

    function buildNavItem(item, index) {
        const extraClass = nameClassMap[item.name] || '';
        const filterKey = getMarkerFilterKey(item);
        const markerMode = getMarkerMode(item);
        const isFish = item.catalog === 'fish';
        return `
        <div class="nav-list-item nav-list-item-${index} ${extraClass} nav-list-${item.icon} ${visibleMarker[filterKey] ? `img_${item.icon}_click active`: `img_${item.icon}`} ${item.num === 0 ? 'hide' : ''} ${isFish ? 'nav-fish-item' : ''}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}" data-mode="${markerMode}" data-filter-key="${filterKey}">
            <div class="wz-bg">
                ${isFish ? fishIconImg(item) : ''}
                <div class="wz-num" ${item.num === 1 ? 'hide' : ''}>${item.num}</div>
            </div>
            <div class="wz-name">${item?.sub_name || item.name}</div>
        </div>`;
    }

    function addToCategory(item, index, category) {
        if (item.num === 0) return;
        categories[category].html += buildNavItem(item, index);
    }

    list.forEach(function (item, index) {
        if (item.name === '行动接取站' || item.name === '高价值接取站') return;
        const filterKey = getMarkerFilterKey(item);
        if (seenFilterKeys.has(filterKey)) return;
        seenFilterKeys.add(filterKey);

        if (item.catalog === 'fish') {
            addToCategory(item, index, 'yl');
        } else if (item.name.indexOf('撤离点') !== -1) {
            addToCategory(item, index, 'cld');
        } else if (item.name.indexOf('藏宝图') !== -1) {
            addToCategory(item, index, 'cbt');
        } else if (item?.mode?.indexOf('泄露区') > -1) {
            addToCategory(item, index, 'mode');
        } else if (item?.name?.indexOf('密钥') > -1) {
            addToCategory(item, index, 'my');
        } else if (item?.name?.indexOf('清洗间') > -1) {
            addToCategory(item, index, 'qxj');
        } else if (item.name.indexOf('出生点') !== -1) {
            addToCategory(item, index, 'csd');
        } else if (item.name.indexOf('首领') !== -1) {
            addToCategory(item, index, 'sl');
        } else if (item.name.indexOf('基地') > -1) {
            addToCategory(item, index, 'jdbsd');
        } else if (item.name.indexOf('据点') > -1) {
            addToCategory(item, index, 'jd');
        } else if (isWar && (item.name.indexOf('车') > -1 || item.name.indexOf('舟') > -1 || item.name.indexOf('轮式') > -1 || item.name.indexOf('直升机') > -1)) {
            addToCategory(item, index, 'zj');
        } else if (item.name.indexOf('载具补给站') > -1) {
            addToCategory(item, index, 'zjbjz');
        } else if (item.name.indexOf('固定弹药箱') > -1) {
            addToCategory(item, index, 'gddyx');
        } else if (isWar && (item.name.indexOf('枪') > -1 || item.name.indexOf('炮') > -1 || item.name.indexOf('密集阵') > -1)) {
            addToCategory(item, index, 'gdwq');
        } else if (item.name.indexOf('滑索') > -1 || item.name.indexOf('电梯') > -1) {
            addToCategory(item, index, 'zz');
        } else {
            addToCategory(item, index, 'wz');
        }

        !typeListInit && (visibleMarker[filterKey] = false)
    })

    let html = '';
    let isFirstCategory = true;
    Object.keys(categories).forEach(function (key) {
        if (!categories[key].html) return;
        html += `<div class="fgx ${isFirstCategory ? 'top0' : ''} nav-${key}">${categories[key].title}</div>${categories[key].html}`;
        isFirstCategory = false;
    });

    if (isWar) {
        navTypyList.addClass('war')
        navTypyList.removeClass('normal')
    } else {
        navTypyList.addClass('normal')
        navTypyList.removeClass('war')
    }
    $('.nav-option-ctn').attr('data-map', currMap)
    navTypyList.html(html)
    typeListInit = true;
    visibleMarker2[navIndex].isInit = true;
}

selectmarker = function (name) {
    if (name === '') {
        mapSelectCtn.removeClass('show');
        return;
    }
    var markerList = []
    var seenFilterKeys = new Set();
    var html = '';
    for (let index = 0; index < allNavList[0].typeList.length; index++) {
        const element = allNavList[0].typeList[index];
        const filterKey = getMarkerFilterKey(element);
        if (fuzzyMatch(element.name, name) && !seenFilterKeys.has(filterKey)) {
            seenFilterKeys.add(filterKey);
            markerList.push(element)
        }
    }
    markerList.length && markerList.forEach(function (item, index) {
        const filterKey = getMarkerFilterKey(item);
        const markerMode = getMarkerMode(item);
        const isFish = item.catalog === 'fish';
        html+=`
        <div class="nav-list-item nav-list-item-${index} nav-list-${item.icon} ${visibleMarker[filterKey] ? `img_${item.icon}_click active`: `img_${item.icon}`}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}" data-mode="${markerMode}" data-filter-key="${filterKey}">
            <div class="wz-bg">
                ${isFish ? fishIconImg(item) : ''}
                <div class="wz-num">${item.num}</div>
            </div>
            <div class="wz-name">${item?.sub_name || item.name}</div>
        </div>`
    })
    selectCtn.html(html)
    mapSelectCtn.addClass('show');

    bindOptionEvent();
}

bindOptionEvent = function () {
    var NavListItem = $('.nav-list-item')
    NavListItem.off('click').on('click', function (e) {
        var $target = $(e.currentTarget);
        var icon = $target.attr('data-icon');
        var name = $target.attr('data-name');
        var filterKey = $target.attr('data-filter-key') || name;
        var NavListItemNum = $target.find('.wz-num')
        if (NavListItemNum.text() == 0) return;
        if (!visibleMarker[filterKey]) {
            $target.addClass(`img_${icon}_click active`)
        } else {
            $target.removeClass(`img_${icon}_click active`)
            $target.addClass(`img_${icon}`)
        }
        currNavIcon = name;
        NavCliciIndex++;
        toggleVisible(filterKey, currLeftNav);
        saveMarker = Object.assign({}, visibleMarker);
        
        let chooseNum = $('.nav-type-list').find('.nav-list-item.active').length;
        let totalNum = $('.nav-type-list').find('.nav-list-item').not('.hide').length;
        if (chooseNum === totalNum) {
            $('.choose-all').attr('class', 'img_all_open choose-all')
        } else {
            if (listIsAll[currLeftNav]) {
                listIsAll[currLeftNav] = false;
                listIsAll[0] = false;
            }
            $('.choose-all').attr('class', 'img_all_close choose-all')
        }
    })
}

enterFloorSave = function () {
    for (const key in saveMarker) {
        if (Object.hasOwnProperty.call(saveMarker, key) && saveMarker[key]) {
            $(`.nav-list-item[data-filter-key="${key}"]`).addClass('active')
            toggleVisible(key, currLeftNav);
        }
    }
    visibleMarker = Object.assign({}, saveMarker);
}

dataFilter = function (mapArticle) {
    let arr = [
        { name: "保险箱" }, { name: "小保险箱" }, { name: "服务器" }, { name: "电脑" },
        { name: "电脑机箱" }, { name: "武器箱" }, { name: "大武器箱" }, { name: "弹药箱" },
        { name: "工具柜" }, { name: "收纳盒" }, { name: "一件衣服" }, { name: "军用医疗包" },
        { name: "医疗物资堆" }, { name: "旅行包" }, { name: "手提箱" }, { name: "储物柜" },
        { name: "高级储物箱" }, { name: "抽屉柜" }, { name: "登山包" }, { name: "快递箱" },
        { name: "航空储物箱" }, { name: "垃圾桶" }, { name: "搅拌车" }, { name: "野外物资箱" },
        { name: "鸟窝" }, { name: "藏匿物" }, { name: "高级旅行箱" }, { name: "出生点" },
        { name: "付费撤离点" }, { name: "常规撤离点" }, { name: "概率撤离点" }, { name: "列车撤离点" },
        { name: "首领" }
    ]
    let arrInfo = [
        { titleType: "all", title: "全部", typeList: [] },
        { titleType: "cbt", title: "藏宝图", typeList: [] },
        { titleType: "wzd", title: "物资点", typeList: [] },
        { titleType: 'mode', title: '泄露区物资点', typeList: [] },
        { titleType: 'my', title: '密钥刷新点', typeList: [] },
        { titleType: 'qxj', title: '清洗间点位', typeList: [] },
        { titleType: 'csd', title: '出生点', typeList: [] },
        { titleType: "cld", title: "撤离点", typeList: [] },
        { titleType: "首领", title: "首领", typeList: [] },
        { titleType: 'yl', title: '鱼类', typeList: [] }
    ];
    let numList = {}

    for (let index = 0; index < mapArticle.length; index++) {
        const element = mapArticle[index];
        if (element.name.indexOf('接取站') !== -1) {
            continue;
        }
        if (element.icon === 'boss') {
            element.name = '首领'
        }
        const filterKey = getMarkerFilterKey(element)
        numList[filterKey] = numList[filterKey] ? numList[filterKey] + 1 : 1
        if (!arr.some(item => getMarkerFilterKey(item) === filterKey)) {
            arr.push({
                name: element.name,
                icon: 'nav_' + element.icon,
                mode: getMarkerMode(element),
                catalog: element.catalog   // ★ 保留 catalog：机密难度经 dataFilter 重建 nav 时鱼不丢分类
            })
        } else {
            const existingItem = arr.find(item => getMarkerFilterKey(item) === filterKey);
            existingItem.icon = 'nav_' + element.icon;
            existingItem.mode = getMarkerMode(element);
            if (element.catalog) existingItem.catalog = element.catalog;
        }
    }
    
    for (let index = 0; index < arr.length; index++) {
        const element = arr[index];
        const filterKey = getMarkerFilterKey(element)
        if (numList[filterKey]) {
            element.num = numList[filterKey]
        } else {
            element.num = element.num || 0
        }

        if (element.catalog === 'fish') {
            arrInfo[8]['typeList'].push(element)
        } else if (element.name === '出生点') {
            arrInfo[5]['typeList'].push(element)
        } else if (element.mode && element.mode.indexOf('泄露区') > -1) {
            arrInfo[2]['typeList'].push(element)
        } else if (element.mode && element.name.indexOf('密钥') > -1) {
            arrInfo[3]['typeList'].push(element)
        } else if (element.mode && element.name.indexOf('清洗间') > -1) {
            arrInfo[4]['typeList'].push(element)
        } else if (element.name.indexOf('撤离点') > -1) {
            arrInfo[6]['typeList'].push(element)
        } else if (element.name === '首领') {
            arrInfo[7]['typeList'].push(element)
        } else {
            arrInfo[1]['typeList'].push(element)
        }
    }

    arrInfo[0]['typeList'] = arr
    return {
        arr,
        arrInfo
    }
}


$('.btn-close-marker-pop').on('click', function () {

    markerPop.removeClass('show')
    $('.deploy-swiper').removeClass('show')
    currClickMarker.setIcon(currClickMarker.myIcon)
})


window.addEventListener('load', () => {
    init();
    console.log(document.querySelector('.left-nav-ctn'));
});
