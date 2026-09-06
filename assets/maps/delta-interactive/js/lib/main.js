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
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            var msg = text.length > 15 ? text.slice(0, 15) + '...' : text;
            // // console.log('已经'+msg+'复制到剪贴板！');
        }).catch(function(err) {
            // // console.error('无法复制到剪贴板', err);
        });
    } else {
        let textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            var msg = text.length > 15 ? text.slice(0, 15) + '...' : text;
            // // console.log('已经'+msg+'复制到剪贴板！');
        } catch (err) {
            // // console.error('无法复制到剪贴板', err);
        }
        document.body.removeChild(textArea);
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



/**变量 */
const navCtn = $('.left-nav-ctn');
let pageSwiper = null;
let part3ListTop = true;
let part3ListBot = false;
let movePart3List = false;
let currScrollIndex = 0;
let footShow = false;

const warLvText = [
    'A','B','C','D','E'
]

var queryMap = {
    'daba': '00',
    'cgxg': '10',
    'htjd': '21',
    'bks': '31',
    'cxjy': '42',
    'az3': '50'
}

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

var hoverMarker = {};
var clickMarker = {}
var ciLayer = null;
var typeListInit = false;
var NavCliciIndex = 1;
function Page() {
    var _this = this;
    _this.$page = $('.m-index')

    // _this.$page.css('height', window.innerHeight)
    _this.init = function () {
        // // console.log(11111);
        $('.global-loading').hide();
        $('.region-ctn').show();
        // // console.log('init');
        if (!browser.versions.mobile) {
           
            _this.resizeDom();
            if (window.innerWidth / window.innerHeight > 1920 / 1080) {
                $('.select_map_video').css({ 'width': '100%', 'height': 'auto'})
            } else {
                $('.select_map_video').css({ 'width': 'auto', 'height': '100%'})
            }
        }
       
        _this.isInit = true;
    }
    _this.sizeList = { 'ar' : true, 'en': true, 'zh-tw': true, 'ko': true, 'tr': true}
    var sizeAutoList = $('.sizeAuto');
    var scaleAutoList = $('.scaleAuto')
    _this.resizeDom = () => {
        if (window.innerHeight > window.innerWidth) return;
        var size = window.innerWidth / 1920  > 1 ? 1 : window.innerWidth / 1920;
        if (window.innerWidth / window.innerHeight - 1920 / 1080 > 0) {
            // let scale = window.innerWidth / window.innerHeight - 1920 / 1080
            // scaleAutoList.css('bottom', `${scale * 250}px`)
            // topCtn[0].style.top = `${scale * 250}px`
        } else {
            scaleAutoList.css('bottom', '0px')
        }

        
    };

    window.onresize = function(e) {
        if (!browser.versions.mobile) {
            _this.resizeDom();
        }
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
    
    // console.log('mapScaleInfo', mapScaleInfo);
    
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

function getSourceMapPos(lat, lng) {
    var bj = isFloor ? mapScaleInfo.floorInfo.info.bj : 128
    var xB2 = mapScaleInfo.width / bj
    var yB2 = mapScaleInfo.height / bj

    if (currLayer.name.indexOf('cgxg') !== -1 || currLayer.name === 'map_yc2' || currLayer.name === 'map_yc' || mapScaleInfo.rotate == 90) {
        return {
            x: mapScaleInfo.centerX - (lat + bj) * xB2,
            y: (bj - lng) * yB2 - mapScaleInfo.centerY
        }
    } else if (mapScaleInfo.rotate === -90) {
        return {
            x: mapScaleInfo.centerX + (lat + bj) * xB2,
            y: (lng - bj) * yB2 - mapScaleInfo.centerY
        }
    } else {
        return {
            x: mapScaleInfo.centerX + (lng - bj) * xB2,
            y: -(lat + bj) * yB2 - mapScaleInfo.centerY
        }
    }
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

// 当前地图信息
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

// 随机事件
var randomEvent = {
    // '0': {
    //     name: '炸毁大坝',
    //     lv: '0'
    // },
    '1': [
        {
            name: '坠机事件',
            lv: '0'
        },
        {
            name: '坠机事件',
            lv: '0'
        }
    ],
    '2': {
        name: '断桥事件',
        lv: '0'
    }
}


// 当前地图
var currLayer;

// 切换地图
var dom_changeMapBtn = $('.btn-change-map-ctn')
var dom_mapList = $('.map-list-ctn')
var isMoveMapList = false;
var currMap = '0';
var currLv = '0';
var currWarMap = 'pc';
var currWarType = 'pc';
var isZj = false;
var currRegion = ''; // 当前切换的区域
var saveMarker = {}; // 切换楼层前保存的点位
var currNavIcon = ''; // 当前选择的icon
var chooseItemLvName = ''; // 选择的难度名称

function getSafeRegionName(fallbackName) {
    return currRegion || currFloorRegion || poiInfo?.[0]?.name || fallbackName || '地图快速定位';
}

function setCurrRegion(regionName) {
    if (regionName) {
        currRegion = regionName;
        if (!isWar && mapScaleInfo?.floorInfo) {
            currFloorRegion = normalizeFloorRegionName(regionName);
        }
    }
    return getSafeRegionName();
}

// 全面战场模式
var isWar = false;
// 攻守方
var isAttack = true;

// 楼层模式
var isFloor = false;
var outFloor = true;
var currFloorIndex = -1;
var currFloorRegion = '';
var currMapFloor = dabaFloor;
var isMoveFloor = false;

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
    var resolvedRegionName = regionName || currFloorRegion || currRegion;
    var floorList = resolveFloorList(resolvedRegionName, true);
    if (shouldUpdateRegion !== false && regionName) {
        currFloorRegion = normalizeFloorRegionName(regionName);
    }
    return floorList;
}

function getFloorItem(index, regionName, floorCode, shouldUpdateRegion) {
    var floorList = getCurrentFloorList(regionName, shouldUpdateRegion);
    if (floorCode) {
        for (var i = 0; i < floorList.length; i++) {
            if (floorList[i].floor_f === floorCode) {
                return floorList[i];
            }
        }
    }
    if (floorList[index]) {
        return floorList[index];
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

function getFloorIndexByCode(floorList, floorCode, fallbackIndex) {
    if (floorCode) {
        for (var i = 0; i < floorList.length; i++) {
            if (floorList[i].floor_f === floorCode) {
                return i;
            }
        }
    }
    if (floorList[fallbackIndex]) {
        return fallbackIndex;
    }
    return -1;
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

function bindFloorTipsExitEvent() {
    $('.floor-tips').off('click.floorExit', '.span2').on('click.floorExit', '.span2', function () {
        outFloorMode();
    });
}

// 全选
var isAll = false;

// 标点
var map
var mapFolder = '0_4/'
var cacheMarker = [];
var removeCacheMarker = [];
var markerList = [];
var currClickMarker;
var warMark = [];
var borderList = [];

// 检测楼层点位

// 定义多个兴趣点
// const pointsOfInterest = [
//     { x: 364598.812500, y: -787795.000000, name: "行政辖区", threshold: 10 },
//     // { x: 1500, y: 2500, name: "位置B", threshold: 150 },
//     // { x: 2000, y: 1800, name: "位置C", threshold: 80 }
// ];
var pointsOfInterest = {
    '0': { x: 364598.812500, y: -787795.000000, name: "行政辖区", threshold: 10 },
    '1': [{ x: 360745.000000, y: -630639.000000, name: "钻石皇后酒店", threshold: 10 },
        // {x: 298737.031250, y: -630639.000000, name: "储藏站", threshold: 10 },
        {x: 290285.000000,y: -643214.000000, name: "哈夫克雷达站", threshold: 10 },
    ],
    '3': { x: 378916.156250, y: -459727.375000, name: "皇家博物馆", threshold: 10 },
    '4': [{ x: 50681.226562, y: -46910.406250, name: "行政区", threshold: 10 },
        { x: 39098.882812, y: -46719.191406, name: "卸货区", threshold: 10 },
        { x: 54663.746094, y: -53846.558594, name: "东侧上层入口", threshold: 10 },
        { x: 45505.500000, y: -53846.558594, name: "西侧上层入口", threshold: 10 },
        { x: 50694.976562, y: -54296.472656, name: "电梯井", threshold: 10 },
        { x: 56148.140625, y: -46268.132812, name: "医疗实验区", threshold: 10 },
        { x: 61580.792969, y: -49258.835938, name: "禁闭区", threshold: 10 },
        { x: 59362.125000, y: -57157.156250, name: "牢房", threshold: 10 },
        { x: 62977.304688, y: -63904.835938, name: "施工区", threshold: 10 },
        { x: 51696.847656, y: -65976.921875, name: "潮汐控制室", threshold: 10 },
        { x: 75549.390625, y: -56491.523438, name: "东侧小岛", threshold: 10 },
        { x: 65006.808594, y: -36544.617188, name: "东瞭望台区", threshold: 10 },
        { x: 36673.597656, y: -39682.421875, name: "西瞭望台区", threshold: 10 },
        { x: 36673.597656, y: -39682.421875, name: "西瞭望台区", threshold: 10 },
        { x: 54200.113281, y: -33264.484375, name: "蓄水区", threshold: 10 },
        { x: 42722.664062, y: -60414.343750, name: "囚犯活动区", threshold: 10 },
        { x: 39293.273438, y: -57157.156250, name: "水动力渠", threshold: 10 },
    ],
    '5': [
        { x: 215006.000000, y: "-204707.000000", name: "RBMK反应堆", threshold: 10 },
        { x: 191250.000000, y: "-227472.000000", name: "老科学院", threshold: 10 },
        { x: 227609.000000, y: "-170624.000000", name: "压水堆", threshold: 10 },
    ]
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

// 绘制一个自定义区域（poi 条目驱动）+ 名称标注；只画不清，配合 clearRegions 使用：
//   导航模式 = 勾选道具时由 syncRegions 统一按勾选集调用（drawnRegions 幂等，同区域同屏只画一份）
//   条目带 children 时：父 polygon/标题 + 所有子区域 polygon/子标题 一并渲染（子区域不可被 activeRegion 独立引用）
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
    //   锚点用 child.x/y（或 labelX/labelY），颜色缺省继承父色；无 points 也无锚点的项跳过
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
// 有 points 画 polygon + 标题；仅 {name,x,y}（children 简化态）时跳过 polygon、只渲染标题
// 样式：item.style / item.color 可覆盖缺省色；名称锚点：labelX/labelY > item.x/y（children 即 child.x/y）> 顶点均值
function drawOneRegion(item, labelText) {
    var latlngs = null;
    // 顶点解析（与 drawBorder 同链路：filterPos → getMapPos）；无 points 时跳过 polygon 绘制
    if (item.points && item.points.length) {
        latlngs = item.points.map(function (str) {
            var pos = getMapPos(filterPos(str, 'X', ','), filterPos(str, 'Y', ',', 1));
            return [pos.y, pos.x];
        });
        // 区域 polygon（区域色 + 半透明填充；interactive:false 避免遮挡 marker/地图操作）
        // style 可覆盖默认样式（水域：2px 点状虚线 + 淡蓝半透明）；无 style 时行为与原来一致
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
    // 名称标注：优先用 labelX/labelY，其次用条目自带 x/y（selectRegion 条目即手工标注点），缺省取顶点均值；interactive:false 避免遮挡
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
        return; // 无 points 也无 x/y 锚点：无可画内容，放弃
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
// 遍历当前地图道具数组 mapIcons：visibleMarker[getMarkerFilterKey(item)] 为 true 且带 activeRegion 的条目，
// 展开字符串/数组并去重，返回区域名数组（不含重复项）
function collectActiveRegions() {
    var set = {};
    (Array.isArray(mapIcons) ? mapIcons : []).forEach(function (item) {
        if (!item || !item.activeRegion || !visibleMarker[getMarkerFilterKey(item)]) return;
        var list = Array.isArray(item.activeRegion) ? item.activeRegion : [item.activeRegion];
        list.forEach(function (rn) { if (rn) set[rn] = true; });
    });
    return Object.keys(set);
}

// 按当前勾选道具集合重绘自定义区域（导航勾选/取消/全选/切图统一入口，refreshMarker2 末尾调用）
// 仅烽火模式生效（isWar=全面战场不走区域渲染）；先清空再重画 = "取消勾选 → set 剩余集合 → 渲染"
// drawRegion 内部幂等，同一区域同屏只画一份
function syncRegions() {
    if (isWar) return;
    clearRegions();
    collectActiveRegions().forEach(function (rn) { drawRegion(rn); });
}

    function refreshMarker2(from, arr) {
        $.each(cacheMarker, function () {
            if (this.options.icon?.polyline) {
                this.options.icon?.polyline.remove();
                this.options.icon?.polyline2.remove();
            }
            this.remove();
        
        });
        // $.each(borderList, function () {
        //     this.remove();
        
        // });
        
        
        // ★ 清理自定义区域图层（activeRegion 绘制），避免切图/切楼层/切难度残留（自 PC 版迁移）
        clearRegions();
        isRemove = true;
        cacheMarker = [];
        markerList = []

        
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
            // // console.log(this);
            
            if (visible) {
                var floorButtonInfo = getFloorItem(this.floor, item['自定义区域'], null, false);
                var floorButtonAttrs = floorButtonInfo
                    ? ` data-nav="nav-list-nav_${this.icon}" data-name="${this.name}" data-region="${item['自定义区域'] || ''}" data-floor="${floorButtonInfo.floor_f}" data-index="${this.floor}"`
                    : '';
                if (item['k1']) {
                    // ★ 鱼类等 k1/k2 键值对条目（自 PC 版迁移）：name + 两行 key:value（k2 存在时补第二行），不再渲染其他标签行
                    var popupHtml = `
                        <div class="name fish" title="${this?.sub_name ? this.sub_name : this.name}">${this?.sub_name ? this.sub_name : this.name}</div>
                        <div class="open-text">${item['k1']}:<span>${item['v1']}</span></div>
                        ${item['k2'] ? `<div class="open-text">${item['k2']}:<span>${item['v2']}</span></div>` : ''}
                    `;
                } else if (item['随机']) {
                    var popupHtml = mapScaleInfo?.floor ? `
                    <div class="name ${(this.name === '[地狱黑鲨]雷斯—雷达站摧毁者' || this.name === '[地狱黑鲨]雷斯—酒店守卫者') && 'max'}">${this?.sub_name ? this.sub_name : this.name}<span> ( ${item['随机']} )</span></div>
                    <div class="btn-floor"${floorButtonAttrs}></div>
                    <div class="address">地点：<span>${item['自定义区域']}</span></div>
                    <div class="open-text ${(!item['拾取条件'] || item['拾取条件'] === '') ? 'hide': ''}">开启条件：<span>${item['拾取条件']}</span></div>
                    <div class="open-text ${(!item['撤离条件'] || item['撤离条件'] === '') ? 'hide': ''}">撤离条件<span>${item['撤离条件']}</span></div>` :
                    ` <div class="name ${(this.name === '[地狱黑鲨]雷斯—雷达站摧毁者' || this.name === '[地狱黑鲨]雷斯—酒店守卫者') && 'max'}">${this?.sub_name ? this.sub_name : this.name}<span> ( ${item['随机']} )</span></div>
                    <div class="address">地点：<span>${item['自定义区域']}</span></div>
                    <div class="open-text ${(!item['拾取条件'] || item['拾取条件'] === '') ? 'hide': ''}">开启条件：<span>${item['拾取条件']}</span></div>
                    <div class="open-text ${(!item['撤离条件'] || item['撤离条件'] === '') ? 'hide': ''}">撤离条件：<span>${item['撤离条件']}</span></div>`;
                } else if (item['自定义区域']) {
                    var popupHtml = mapScaleInfo?.floor ? `
                    <div class="name ${(this.name === '[地狱黑鲨]雷斯—雷达站摧毁者' || this.name === '[地狱黑鲨]雷斯—酒店守卫者') && 'max'}">${this?.sub_name ? this.sub_name : this.name}</div>
                    <div class="btn-floor"${floorButtonAttrs}></div>
                    <div class="address">地点：<span>${item['自定义区域']}</span></div>
                    <div class="open-text ${(!item['拾取条件'] || item['拾取条件'] === '') ? 'hide': ''}">开启条件：<span>${item['拾取条件']}</span></div>
                    <div class="open-text ${(!item['出现条件'] || item['出现条件'] === '') ? 'hide': ''}">出现条件：<span>${item['出现条件']}</span></div>
                    <div class="open-text ${(!item['撤离条件'] || item['撤离条件'] === '') ? 'hide': ''}">撤离条件：<span>${item['撤离条件']}</span></div>` : 
                    ` <div class="name ${(this.name === '[地狱黑鲨]雷斯—雷达站摧毁者' || this.name === '[地狱黑鲨]雷斯—酒店守卫者') && 'max'}">${this?.sub_name ? this.sub_name : this.name}</div>
                    <div class="address">地点：<span>${item['自定义区域']}</span></div>
                    <div class="open-text ${(!item['拾取条件'] || item['拾取条件'] === '') ? 'hide': ''}">开启条件：<span>${item['拾取条件']}</span></div>
                    <div class="open-text ${(!item['出现条件'] || item['出现条件'] === '') ? 'hide': ''}">出现条件：<span>${item['出现条件']}</span></div>
                    <div class="open-text ${(!item['撤离条件'] || item['撤离条件'] === '') ? 'hide': ''}">撤离条件：<span>${item['撤离条件']}</span></div>`;
                } else if (item['激活条件']) {
                    var popupHtml =`
                            <div class="name">${this?.sub_name ? this.sub_name : this.name}</div>
                         <div class="open-text war ${(!item['激活条件'] || item['激活条件'] === '' || item['激活条件'] === '-') ? 'hide': ''}">激活条件：<span>${item['激活条件']}</span></div>
                         `
                   
                } else if (item['img']) {
                    var popupHtml = `
                    <div class="name">${this?.sub_name ? this.sub_name : this.name}</div>
                    <div class="marker-preview">
                        <img src="${item['img']}" />
                    </div>
                `;
                console.log('走着了');
                
                } else {
                    var popupHtml = `
                    <div class="name">${this?.sub_name ? this.sub_name : this.name}</div>
                `;
                console.log('走了这里');
                
                }
              


                popupHtml += '</div>';

                var className = ''
                if (item?.type) {
                    className =  item.type
                } else {
                    className =  'article'
                }
                var pos = getMapPos(this.x, this.y)
                if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
                    return;
                }
                // console.log(this.x, this.y, pos);
                
                var path = isWar ? `${IMG_PRE}/img/dzc_i/` : `${IMG_PRE}/img/lv3/`
                var iconName;
                if (that.name === "进攻方基地" ) {
                    iconName = window.viewChange ? 'g_jdbsd_g': 'g_jdbsd_r'
                } else if (that.name === "防守方基地") {
                    iconName = window.viewChange ? 'f_jdbsd_r': 'f_jdbsd_g'
                } else {
                    iconName = that.icon
                }
                
                if (this.icon) {
                    // style=`transform: translate3d(-50%, -50%, 0) rotate(${element.rotate}deg)`
                    let rotate = currWarMap === 'qhz' ? 90 : 180
                    // console.log('rotate', currWarMap, NavCliciIndex);
                    var myIcon =  L.divIcon({
                        className: ` ${isWar ? 'map-war-icon' : 'map-icon'} ${nameClassMap[that.name] || ''}`,
                        html: `<div class="map-icon-bg" style="${that?.rotate ? `transform: translate3d(-50%, -50%, 0) rotate(${Number(that?.rotate) + rotate}deg) ` : ''}"><img src="${path + iconName}.png"/><text class="order" style="${that?.index ? 'display: block' : 'display: none'}" >#${that?.index}</text></div>`,
                        iconSize: [30, 30],			//设置图标大小
                        iconAnchor: [15, 15],		//设置图标偏移
                    })
                    console.log(that);
                    
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
                    // console.log('myIcon', that.name);
                    
                    var marker = L.marker([pos.y, pos.x], {icon:  myIcon, zIndexOffset: that.name === currNavIcon ? NavCliciIndex + 1 : NavCliciIndex}).bindPopup(popupHtml).addTo(map).on({
                        click: function () {
                            document.getElementById('MapContainer').classList.remove('zooming');
                            currClickMarker?.setIcon(currClickMarker?.myIcon)
                            this.isClick = true;
                            console.log(that['z坐标'], that.name, that.y);
                            let rotate = currWarMap === 'qhz' ? 90 : 180
                            this.myIcon = myIcon;
                            if (that?.floor || that?.floor === 0) {
                                $('.leaflet-popup').addClass('floor')
                            } else if (that?.index) {
                                $('.leaflet-popup').addClass('preview')
                            } else {
                                $('.leaflet-popup').removeClass('floor')
                            }
                            $('.leaflet-popup-close-button').html('')
                            this.openPopup();
                            this.setIcon( L.divIcon({
                                className: ` ${isWar ? 'map-war-icon' : 'map-icon'} click ${nameClassMap[that.name] || ''}`,
                                html: `<div class="map-icon-bg" ><img src="${path + iconName}.png" style="${that?.rotate ? `transform:  rotate(${Number(that?.rotate) + rotate}deg)` : ''}"/> <text class="order" style="${that?.index ? 'display: block' : 'display: none'}" >#${that?.index}</text></div>`,
                                iconSize: [30, 30],			//设置图标大小
                                iconAnchor: [15, 15],		//设置图标偏移
                            }));
                            currClickMarker = this;
                            $(this.getElement()).addClass('click')
                            console.log(this.myIcon, item);
                            if (this.myIcon.name.indexOf('基地') > -1 || (this.myIcon.name.indexOf('据点') > -1 && window.occupy)) {
                                initWarSwiper(this.myIcon.name, that);
                            }



                            $('.btn-floor').on('click', enterFloorMode)
                            // this?.remove()
                        }
                    })
                    // console.log( marker);
                    // marker.setZIndexOffset(NavCliciIndex)
                    // marker.getElement().style.zIndex = NavCliciIndex;
                    cacheMarker.push(marker)
                }
                
            }
          
        });
        isRemove = false;
        // ★ 自定义区域与勾选状态绑定：末尾按当前勾选集重绘（开头已 clearRegions 清旧，天然"取消→重建剩余"）（自 PC 版迁移）
        syncRegions();
        // console.log(cacheMarker.length);
    }



    function toggleVisible(type, index) {
        switch (type) {
            case "0_all":
            case "1_all":
            case "2_all":
            case "3_all":
            case "4_all":
            case "5_all":
            case "6_all":
                // ★ 6 = "鱼类"组索引（静态 nav 6 组后追加，自 PC 版迁移）
                renderMarker()
                break;
            case "0_none":
            case "1_none":
            case "2_none":
            case "3_none":
            case "4_none":
            case "5_none":
            case "6_none":
              
                renderMarker()
                isWar ? $('.map-war-icon').remove() : $('.map-icon').remove();
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
        // console.log('type', type);
        function renderMarker () {
            if (Number(currLeftNav) === 0) {
                // console.log(111, navTypeList, visibleMarker);
                
                for (var o in visibleMarker) {
                    if (visibleMarker.hasOwnProperty(o)) {
                        visibleMarker[o] = (type.indexOf('all') > 0 ? true : false);
                    }
                }
            } else {
                for (let index = 0; index < navTypeList[currLeftNav].typeList.length; index++) {
                    const element = navTypeList[currLeftNav].typeList[index];
                    // // console.log(element);
                    // if (element.num === 0) return;
                    
                    visibleMarker[getMarkerFilterKey(element)] = (type.indexOf('all') > 0 ? true : false);
                }
            }
            saveMarker = Object.assign({}, visibleMarker);
        }

        function renderMarker2 () {
            for (var o in visibleMarker) {
                if (visibleMarker.hasOwnProperty(o)) {
                    visibleMarker[o] = (type.indexOf('all') > 0 ? true : false);
                }
            }
            saveMarker = Object.assign({}, visibleMarker);
        }

        refreshMarker2("filter", mapIcons);
    }




var init = function () {
    // var mapWidth = -250;  
    // var mapHeight = 250;  
    let nearbyPoint, prevNearbyPoint;

    var mapWidth = isFloor ? mapScaleInfo.floorInfo.info.boundsW : mapScaleInfo.boundsW;  
    var mapHeight = isFloor ? mapScaleInfo.floorInfo.info.boundsH :mapScaleInfo.boundsH;  
    console.log('mapWidth', mapWidth);
    console.log('mapHeight', mapHeight);
    
    var mapOrigin = isWar ? L.latLng(0, -80) : L.latLng(0, 0);
    var pixelToLatLngRatio = -1;
    var southWest = mapOrigin; // 左上角  
    var northEast = L.latLng((mapHeight - 70) * pixelToLatLngRatio, mapWidth * pixelToLatLngRatio); // 右下角  
    var bounds = L.latLngBounds(southWest, northEast);  
    // zoomAnimation: !0,
    // zoomAnimationThreshold: 4,
    // fadeAnimation: !0,
    // markerZoomAnimation: !0,
    // transform3DLimit: 8388608,
    // zoomSnap: 1,
    // zoomDelta: 1,
    // trackResize: !0

    map = L.map('MapContainer', {
        crs: L.CRS.Simple,
        attributionControl: false,
        zoomControl: false,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0,
        minZoom: mapScaleInfo.minZoom,
        maxZoom: 8,
        preferCanvas: true,
        detectRetina: true,
        smoothSensitivity: 1,   // zoom speed. default is 1
        // zoomSnap: .1,
        wheelDebounceTime: 10,
        // 新增
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        zoomAnimationThreshold: 2,
        transform3DLimit: 8388608,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        // zoomSnap: 0.1,
        // zoomDelta: 0.1,
        trackResize: !0
    }).setView([mapScaleInfo.initX,  mapScaleInfo.initY], mapScaleInfo.initZoom);
    let control = new L.Control.Zoomslider()
    map.addControl(control);
    window.pervInitX = mapScaleInfo.initX

    addLayer('map_db');
    if (queryMap[getQuery('map')]) {
        let getMap = queryMap[getQuery('map')];
        currMap = getMap[0];
        currLv = getMap[1];
        if (getQuery('map') === 'cgxg' || getQuery('map') === 'htjd') {
            // $('.random-name').text(randomEvent[currMap].name)
            $('.random-name').text('不开启特殊事件')
            $('.btn-random').removeClass('hide')
            $('.random-list').attr('class', `random-list map-${currMap}-${currLv} close`)
        }
        changeMapLv(getMap);
        if (!isWar && mapScaleInfo?.floorInfo) {
         
            prevNearbyPoint = nearbyPoint;
            if (Number(currMap) === 4 && prevNearbyPoint?.name === nearbyPoint?.name) {
                isMoveFloor = false;
            }
            console.log('isMoveFloor', isMoveFloor);
            
            nearbyPoint = checkNearbyPoints();
            setCurrRegion(nearbyPoint?.name);
            checkMoveFloor(nearbyPoint);
        }
    }
    if (getQuery('map').indexOf('dzc') !== -1) {
        enterWarMap();
    }
    currRegion = '行政辖区'
    map.on('zoomanim', function(e) {
        document.getElementById('MapContainer').classList.add('zooming');
        // console.log(e);
        // if (e.zoom < 4) {
        //     $('.curr-reigon').text('地图快速定位');
        // }
    });
    
    // 如果还需要在缩放时检查
    // map.on('zoomend', function() {
    //     const nearbyPoint = checkNearbyPoints();
    //     if (nearbyPoint) {
    //         // console.log(`缩放结束，用户位于"${nearbyPoint.name}"区域！距离: ${nearbyPoint.distance.toFixed(2)}`);
    //         // 在这里执行你需要的操作
    //     }
    // });
    
    // 地图移动时使用节流版本的检查函数
    // map.on('move', throttledCheckNearbyPoints);

    // 移动结束时总是检查一次，确保不会漏掉最终位置
    map.on('moveend', function(e) {
        // console.log(e); 
        if (!isWar && mapScaleInfo?.floorInfo) {
         
            prevNearbyPoint = nearbyPoint;
            console.log('prevNearbyPoint', prevNearbyPoint);
            console.log('nearbyPoint', nearbyPoint);
            if (Number(currMap) === 4 && prevNearbyPoint?.name === nearbyPoint?.name) {
                isMoveFloor = false;
            }
            console.log('isMoveFloor', isMoveFloor);
            
            nearbyPoint = checkNearbyPoints();
            setCurrRegion(nearbyPoint?.name);
            checkMoveFloor(nearbyPoint);
            
            // if (Number(currMap) === 4 && isFloor) {
            //     $('.curr-reigon').text(nearbyPoint?.name);
            //     $('.floor-tips .span1').text(nearbyPoint?.name)
            // }
        }
    });



    map.on('click', function(e) {
       var sourcePos = getSourceMapPos(e.latlng.lat, e.latlng.lng);
       console.log('map click position', {
           x: Math.round(sourcePos.x),
           y: Math.round(sourcePos.y),
           lat: e.latlng.lat,
           lng: e.latlng.lng,
           isFloor: isFloor,
           layer: currLayer.name
       });
       // console.log(currClickMarker);
       if (currClickMarker) {
        currClickMarker.setIcon(currClickMarker.myIcon)
        $('.deploy-swiper').removeClass('show')
        document.getElementById('MapContainer').classList.remove('zooming');
       }
     
    });

    $('.leaflet-popup-pane').on('click', (e) => {
        // console.log(e);
        // console.log(currClickMarker);
        currClickMarker.closePopup();
        currClickMarker.setIcon(currClickMarker.myIcon)
        $('.deploy-swiper').removeClass('show')
        document.getElementById('MapContainer').classList.remove('zooming');
    })
    // initFloor();
    initNav();

    bindEvent();
    initQuickPosition();
};

// 边界数组转换
function filterPos (str, char1, char2, i) {
    var index = str.indexOf(char1);
    var index2 = str.indexOf(char2, index + 1);
    // // console.log(index, index2);
    
    if (index != -1 && index2 != -1) {
        return str.slice(index + 2, index2);
    }
    return str;
}


function drawBorderPub (color, border, border2) {
    var latlngs = [];
    var latlngs2 = [];
    var latlng = []

    for (let index = 0; index < border.length; index++) {
        const element = border[index];
        let x = filterPos(element, 'X', ',')
        let y = filterPos(element, 'Y', ',', 1)
        let pos = getMapPos(x, y)
        latlngs.push([pos.y, pos.x])
    }
    for (let index = 0; index < border2.length; index++) {
        const element = border2[index];
        let x = filterPos(element, 'X', ',')
        let y = filterPos(element, 'Y', ',', 1)
        let pos = getMapPos(x, y)
        latlngs2.push([pos.y, pos.x])
    }
    latlng.push(latlngs)
    latlng.push(latlngs2)
    const line = L.polygon(latlng, {color: color, fillColor: color, weight: 3, stroke: false}).addTo(map)
    borderList.push(line);
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
        // const line = L.polygon(latlngs, {color: 'white', fillColor: 'white', weight: 3, stroke: false}).addTo(map)
        // const line2 = L.polygon(latlngs, {color: 'white', fillColor: 'white', weight: 3, stroke: false}).addTo(map)
        // const line3 = L.polygon(latlngs, {color: 'white', fillColor: 'white', weight: 3, stroke: false}).addTo(map)

        let colors
        if (window.occupy) {
            colors = 'white'
        } else {
            colors = window.viewChange ? 'red' : color
        }
        // console.log('colors', colors);
        
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
    //     // console.log(1, e);
    //     polyline.setStyle({color: 'red'});
    // })
}

function addLayer (mapName) {
    // console.log('currFloorIndex', currFloorIndex);
    
    // $('.leaflet-container').attr('class', `leaflet-container leaflet-touch leaflet-fade-anim leaflet-grab leaflet-touch-drag leaflet-touch-zoom map-${currMap}-${currLv}`)
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
        var currentFloorConfig = getActiveFloorConfig(Number(currFloorIndex), currFloorRegion);
        if (!currentFloorConfig) return;
        mapWidth = currentFloorConfig.boundsW
        mapHeight = currentFloorConfig.boundsH
        // southWest = L.latLng(-25, 55)
        // pixelToLatLngRatio = -0.85
        // mapWidth = mapScaleInfo.boundsW
        // mapHeight = mapScaleInfo.boundsH
        southWest = L.latLng(currentFloorConfig.latLngX, currentFloorConfig.latLngY)
        pixelToLatLngRatio = currentFloorConfig.pixelToLatLngRatio
    } else if (isWar) {
        mapWidth = mapScaleInfo.boundsW
        mapHeight = mapScaleInfo.boundsH
        southWest = L.latLng(0, -80)
        pixelToLatLngRatio = -1
    } else {
        mapWidth = mapScaleInfo.boundsW
        mapHeight = mapScaleInfo.boundsH
        southWest = L.latLng(0, 0)
        pixelToLatLngRatio = -1
    }
    var northEast = L.latLng((mapHeight - 70) * pixelToLatLngRatio, mapWidth * pixelToLatLngRatio); // 右下角  
    var href = '';
    if (!isFloor && mapScaleInfo.href) {
        href = mapScaleInfo.href
    
    } else if (isFloor && mapScaleInfo.floorInfo?.info?.href) {
        href = mapScaleInfo.floorInfo?.info?.href
    } else {
        href = `${IMG_PRE}/img/`
        //  href = ' ./img/'
        //  href= '../../img/'
    }

    if (window.occupy) {
        minZoom = mapScaleInfo.minZoom_s
        initZoom = mapScaleInfo.initZoom_s
        initX = mapScaleInfo.initX_s
        initY = mapScaleInfo.initY_s
    } else if (isFloor) {
        minZoom = currentFloorConfig.minZoom
        initZoom = currentFloorConfig.initZoom
        initX = currentFloorConfig.initX
        initY = currentFloorConfig.initY;
        
    } else {
        minZoom = mapScaleInfo.minZoom
        initZoom =  mapScaleInfo.initZoom
        initX = mapScaleInfo.initX
        initY = mapScaleInfo.initY;
    }
    // console.log(minZoom, initZoom);
    var bounds = L.latLngBounds(southWest, northEast);  
    currLayer = L.tileLayer(href + `${mapName}/{z}_{x}_{y}.jpg`, {
        minZoom: minZoom,
        maxZoom: 8,
        maxNativeZoom: isFloor ? (mapScaleInfo.floorInfo.info?.maxZomm || 6) : 4,
        noWrap: false,
        attribution: '地图与数据 © 腾讯 / 三角洲行动',
        bounds: bounds,
        errorTileUrl: window.DELTA_ASSET_ROOT + 'blank.jpg',
        tileSize: isFloor ? 512 : 256,
        zoomOffset: isFloor ? -1 : 0
    }).addTo(map);
    currLayer.name = mapName
    map.setMaxBounds(bounds)
    map.options.minZoom = minZoom;
    // console.log('视角定位', initX, mapScaleInfo);
    if (!isFloor) {
        $('.curr-reigon').text(`地图快速定位`)
    } else {
        $('.curr-reigon').text(getSafeRegionName())
    }
    
    if (mapName === 'map_qhz' && currWarType === 'mobile') {
        map.setView([window.occupy ? mapScaleInfo.initX_mobile_s : mapScaleInfo.initX, window.occupy ? mapScaleInfo.initY_mobile_s : mapScaleInfo.initY], initZoom)
    } else {
        map.setView([initX, initY], initZoom)
    }
   

    window.pervInitX = window.occupy ? mapScaleInfo.initX_s : mapScaleInfo.initX


    initRegion()
    

    console.log('currRegion', currRegion);
    
    // if (currRegion === '行政区') {
    //     console.log('进入');
        
    //     checkMoveFloor(pointsOfInterest[4]);
    // }
}

// 初始化区域
function initRegion () {
    console.log('initRegion', poiInfo);
    $.each(poiList, function () {
        this.remove();
    
    });
    poiList = [];
    let html = ''
    let firstValidRegionName = '';
    if (poiInfo && poiInfo.length > 0) {
        console.log('poiInfo', poiInfo);
        
        poiInfo?.forEach((item, index) => {
        if (item.name === '行政西楼' || item.name === '行政东楼') return;
        if (!Number.isFinite(Number(item.x)) || !Number.isFinite(Number(item.y))) return;
        var myIcon =  L.divIcon({
            className: ` map-region-name`,
            html: `<div class="region-item"  data-x="${item.x}" data-y="${item.y}">${item.name}</div>`,
        })
        var pos = getMapPos(item.x, item.y)
        if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;
        if (!firstValidRegionName) {
            firstValidRegionName = item.name;
        }
        html+= `<div class="region-item region-item-${index}" data-x="${item.x}" data-y="${item.y}">${item.name}</div>`
        // // console.log(item.x, item.y);

    
        // regionList.append(`<div class="region-item region-item-${index}" data-x="${item.x}" data-y="${item.y}">${item.name}</div>`)
    
            poiList.push(L.marker([pos.y, pos.x], {icon: myIcon}).addTo(map))
        })
    }
    // console.log('poiListhtml', html);
    if (firstValidRegionName) {
        currRegion = firstValidRegionName;
    }
    // 锚点定位
    $('.region-list').html(html)
    initQuickPosition();
}

// 初始化楼层
function initFloor () {
    var currentFloorList = getCurrentFloorList();
    floorList.html('')
    floorList.append(`<div class="floor-item not-event act">大地图模式</div>`)
   
    // if (!mapScaleInfo.floor) return;
    // floorList.append(`<div class="floor-item not-event">大地图模式</div>`)
    floorTop = $('.map-floor-change-list')
    let html2 = '<div class="map-floor-item map-floor-item-normal btn_floor_mini_act" data-index="-1"></div>'
    currentFloorList.forEach((item, index) => {
        let html = `<div class="floor-item floor-item-${index} ${currFloorIndex === index ? 'act' : ''}" data-index="${index}" data-floor="${item.floor_f}">${item.floor_f}</div>`
        html2 += `<div class="map-floor-item floor_${item.floor_f} ${currFloorIndex === index ? 'act' : ''}" data-index="${index}" data-floor="${item.floor_f}"></div>`
        floorList.append(html)
       
    })
    floorTop.html(html2)
    console.log('initFloor', currRegion);
    
    $('.curr-reigon').text(getSafeRegionName());
    // 楼层切换按钮事件
    $('.map-floor-item').on('click', enterFloorMode);

    $('.floor-item').on('click', enterFloorMode)
    $('.floor-tips').css('display', 'block');
    bindFloorEvent();
}

function bindFloorEvent () {
    $('.not-event').off('click').on('click', function (e) {
        console.log('bindFloorEvent');
        
        outFloorMode()
    })
}

// 进入分层模式通用方法
function enterFloorMode(e) {
    if ($(e.target).hasClass('not-event')) return;
    isFloor = true;
    outFloor = false;
    let index = Number($(e.target).attr('data-index'));
    let floor = $(e.target).attr('data-floor');
    let floorRegion = $(e.target).attr('data-region') || currFloorRegion || currRegion;
    currFloorRegion = normalizeFloorRegionName(floorRegion);
    let currentFloorList = getCurrentFloorList(currFloorRegion);
    currFloorIndex = getFloorIndexByCode(currentFloorList, floor, index);
    if (currFloorIndex === -1) return;
    let currentFloor = currentFloorList[currFloorIndex];

    // console.log('进入分层', currRegion);
    
    $('#MapContainer').addClass('floor')
    
    $('.map-floor .btn-floor').html(`<p>正在查看 <span class="color">${currentFloor.floor_f}层</span></p>`)
    $('.map-floor .btn-floor').attr('class', `btn-floor btn_floor floor-${currentFloor.floor_f}`)
    $('.floor-item').removeClass('act');
    $(e.target).addClass('act');
    $('.map-floor-change-ctn').addClass('show');
    $('.map-floor-item').removeClass('act');
    $(`.floor_${currentFloor.floor_f}`).addClass('act');
    $('.curr-reigon').text(currentFloor.floor_name);
    $('.floor-tips').html(`您正在查看<span class="span1">${currentFloor.floor_name}</span><span class="span2">返回大地图</span>`)
    initFloor();
    // 楼层切换按钮事件
    // $('.map-floor-item').off('click').on('click', (e) => {
    //     // console.log(e);
    //     let index = $(e.target).attr('data-index');
    //     currFloorIndex = index;
    //     $('.map-floor-item').removeClass('act');
    //     $(`.floor_${mapScaleInfo.floor[index].floor_f}`).addClass('act');
    //     $('.floor-item').removeClass('act');
    //     $(`.floor-item-${index}`).addClass('act');
    //     $('.map-floor .btn-floor').attr('class', `btn-floor btn_floor floor-${mapScaleInfo.floor[index].floor_f}`)
    // });

    // 退出楼层模式
    bindFloorTipsExitEvent();
    saveMarker = Object.assign({}, visibleMarker);
    console.log(11111,saveMarker);
    const mapPath = buildFloorMapPath(currentFloor, floor);
    changeMapLv(mapPath);
    console.log('changeMapLv2', currMap, currLv);
    

    // if ($(e.target).hasClass('btn-floor')) {
    //     const nav = $(e.target).attr('data-nav');
    //     console.log(33333, saveMarker);
        
    //     visibleMarker = Object.assign({}, saveMarker);
    //     // console.log(22222, visibleMarker);
    //     // visibleMarker[name] = true;
    //     !visibleMarker[name] ? $(`.${nav}`).addClass('active'): $(`.${nav}`).removeClass('active')
    //     toggleVisible(name, currLeftNav);
    // }
    
    enterFloorSave();

    

}

// 进入楼层保留选项
function enterFloorSave () {
    // if (!isAll) return;
    console.log('enterFloorSave', saveMarker);
    for (const key in saveMarker) {
        if (saveMarker[key]) {
            console.log(1111, key);
            $(`.nav-list-item[data-filter-key="${key}"]`).addClass('active')
            toggleVisible(key, currLeftNav);
        }
    }
    visibleMarker = Object.assign({}, saveMarker);
    // !visibleMarker[name] ? $(`.${nav}`).addClass('active'): $(`.${nav}`).removeClass('active')
    // toggleVisible(name, currLeftNav);
}

function outFloorMode () {
    isFloor = false;
    $('#MapContainer').removeClass('floor')
    currFloorIndex = -1;
    currFloorRegion = normalizeFloorRegionName(currRegion);
    $('.not-event').addClass('act');
    $('.map-floor-change-ctn').removeClass('show');
    $('.map-floor .btn-floor').html(`<p>查看地图分层</p>`)
    $('.map-floor .btn-floor').attr('class', 'btn-floor btn_floor')
    floorList.html('')
    floorList.append(`<div class="floor-item not-event">大地图模式</div>`)
    $('.floor-tips').html(`<p> 您正在查看<span class="span1">${getSafeRegionName()}</span></p>`)
    changeMapLv(`${currMap + currLv}`);
    enterFloorSave();
    outFloor = true;
    console.log('changeMapLv3', currMap, currLv);
    // console.log('初始化currRegion2', currRegion);
    
}


// 重置全选
function resetAll (type) {
    console.log('resetAll', currLeftNav,type);
    
    if (currLeftNav == 0) {
        if (listIsAll[0]) {
            for (const key in listIsAll) {
                if (Object.hasOwnProperty.call(listIsAll, key)) {
                    listIsAll[key] = false
                }
            }
            console.log('走1');
            
        } else {
            for (const key in listIsAll) {
                if (Object.hasOwnProperty.call(listIsAll, key)) {
                    listIsAll[key] = type === 'none' ? false : true
                }
            }
            console.log('走2');
        }
       
    } else if (type === 'none') {
        // console.log('走这里');
        for (const key in listIsAll) {
            if (Object.hasOwnProperty.call(listIsAll, key)) {
                listIsAll[key] = false
            }
        }
        console.log('走3');
    } else {
        // listIsAll[currLeftNav] = type === 'none' ? false: true;
        listIsAll[currLeftNav] = listIsAll[currLeftNav] ? false: true;
        console.log('走4');
    }
    
    if (listIsAll[1] && listIsAll[2] && listIsAll[3] && listIsAll[4] && listIsAll[5]) {
        listIsAll[0] = true;
        console.log('走5');
    } else if (!listIsAll[1] || !listIsAll[2] || !listIsAll[3] || !listIsAll[4] || !listIsAll[5]) {
        listIsAll[0] = false;
        console.log('走6');
    }
   
}

var initNav = function () {
    currLeftNav = 0;
    var navLeft = $('.nav-options');
    // ★ 鱼类导航组补挂（幂等）：initNav 可能先于 changeMapLv 执行，此处兜底一次
    if (!isWar && !isFloor) {
        allNavList = ensureFishGroup(allNavList, mapIcons);
        navTypeList = ensureFishGroup(navTypeList, mapIcons);
        // ★ 与 changeMapLv 一致的"全部"组注入兜底（幂等，已注入则原样返回）
        allNavList = injectFishIntoAll(allNavList, getFishTypeList(allNavList));
    }
    navLeft.html('')
    var navList;
    if (isWar) {
        navList = allNavList.typeList;
    } else {
        navList = allNavList
    }
    

    
    allNavList.forEach(function (item, index) {
        // ★ 行动接取站恒隐藏；非战争模式下空"鱼类"组一并隐藏，避免无鱼地图出现空 tab（自 PC 版迁移）
        var hideNav = item.title === '行动接取站' || (!isWar && item.titleType === 'yl' && !(item.typeList && item.typeList.length));
        navLeft.append(`<div class="nav-option-item nav-option-item-${index} ${currLeftNav === index ? 'active': ''}" style="${hideNav ? 'display: none' : ''}" data-index="${index}">${item.title}</div>`)
       
    })

    var navOptItem = $('.nav-option-item')
    // 选择类型
    navOptItem.on('click', function (e) {
        var index = $(e.target).attr('data-index');
        currLeftNav = index;
        navOptItem.removeClass('active')
        // ★ 组越界兜底（自 PC 版迁移）：切到组数更少的地图后，残留 tab 点击回退第 0 组，避免取 undefined 崩溃
        if (Number(index) !== 0 && !navTypeList[index]) {
            index = '0';
            currLeftNav = '0';
        }
        $(`.nav-option-item-${index}`).addClass('active')
        // console.log($(e.target).attr('data-index'));
        if (Number(index) === 0) {
            renderNavTypeList(allNavList[0].typeList, 0)
        } else {
            // console.log('navTypeList[index]', navTypeList, index, navTypeList[index]);
            
            renderNavTypeList(navTypeList[index].typeList, index)
        }

        if (listIsAll[currLeftNav]) {
            $('.btn-choose-all-icon').attr('class', 'img_all_open btn-choose-all-icon')
        } else {
            $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon')
        }
        
        bindOptionEvent();

        // if (isWar) {
        //     warInit(currWarMap, currWarType);
        // }

    })
    
    renderNavTypeList(allNavList[0].typeList, 0)
    

        
    // regionList.html('')
    // selectRegion.forEach(function (item, index) {
    //     regionList.append(`<div class="region-item region-item-${index}" data-x="${item.x}" data-y="${item.y}">${item.name}</div>`)
    // })
}

// ========== ★ 鱼类导航组（自 PC 版 buildNavFromIcons 迁移，去国际化） ==========
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
// 背景：默认视图走 renderNavTypeList(allNavList[0].typeList, 0)（initNav L1732、点击 L1711），
// 而静态 nav（navList_az3[0]）里一条 catalog==='fish' 都没有 —— 只有点「鱼类」tab 才走 navTypeList[6]。
// 结果就是：navTypeList 里明明有鱼，首屏「全部」列表却一条鱼都看不到。
// 实现约束（重要）：恒返回**新数组**、只替换 [0]，绝不原地 push。
//   原因：allNavList 直接引用模块级 navList_az3（changeMapLv L3531），allNavList[0] 与 navList_az3[0] 是同一个对象；
//   原地写会永久污染静态数据，且每次 changeMapLv 重复注入 → typeList 无限膨胀、切到无鱼难度后鱼还赖着不走。
//   每次都从 config.nav 重新构造，天然幂等。
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

// ★ 鱼类 tab 同步（自 PC 版迁移）：一级 tab 条只在 initNav 时构建一次，静态 nav 切图/切难度不重建；
// 有鱼地图（ensureFishGroup 已在组尾追加 yl 组）若无鱼类 tab 则补一个，无鱼则摘除残留 tab，
// 避免"入口缺失"（从无鱼图切到有鱼图）或"残留空 tab"（从有鱼图切到无鱼图）。
// 鱼类组恒追加在组尾，data-index 与当前 navTypeList 对齐；用 data-fish-tab 标记避免按硬编码索引误伤其他组。
function syncFishNavTab() {
    var $navLeft = $('.nav-options');
    if (!$navLeft || !$navLeft.length) return;
    // 当前组布局中"鱼类"组索引（无鱼 = -1）
    var fishIdx = -1;
    (Array.isArray(allNavList) ? allNavList : []).forEach(function (g, i) {
        if (g && g.titleType === 'yl') fishIdx = i;
    });
    var $fishTab = $('.nav-option-item[data-fish-tab="1"]');
    if (fishIdx === -1) {
        // 当前地图无鱼：若有残留鱼类 tab（上一张有鱼地图遗留）则移除
        if ($fishTab.length) $fishTab.remove();
        return;
    }
    // 有鱼且 tab 已存在且索引一致 → 无需处理
    if ($fishTab.length && Number($fishTab.attr('data-index')) === fishIdx) return;
    // 索引错位或缺失 → 删除旧的，按当前索引重建（切换逻辑与 initNav 内一致）
    $fishTab.remove();
    var $tab = $('<div class="nav-option-item nav-option-item-' + fishIdx + ' ' + (Number(currLeftNav) === fishIdx ? 'active' : '') + '" data-index="' + fishIdx + '" data-fish-tab="1">鱼类</div>');
    $tab.appendTo($navLeft);
    $tab.on('click', function () {
        currLeftNav = String(fishIdx);
        $('.nav-option-item').removeClass('active');
        $(this).addClass('active');
        renderNavTypeList((navTypeList[fishIdx] && navTypeList[fishIdx].typeList) ? navTypeList[fishIdx].typeList : [], fishIdx);
        if (listIsAll[currLeftNav]) {
            $('.btn-choose-all-icon').attr('class', 'img_all_open btn-choose-all-icon')
        } else {
            $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon')
        }
        bindOptionEvent();
    });
}

var renderNavTypeList = function (list, navIndex = 0) {
    console.log('renderNavTypeList',list)
    list = Array.isArray(list) ? list : [];
    const seenFilterKeys = new Set();
    
    // 定义分类容器
    const categories = {
        cbt: { title: '藏宝图', html: '' },
        wz: { title: '物资点', html: '' },
        mode: { title: '泄露区物资点', html: '' },
        my: { title: '密钥刷新点', html: '' },
        xxj: { title: '清洗间点位', html: '' },
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

    // 分类处理函数
    function addToCategory(item, index, category) {
        if (item.num === 0) return;
        // 获取该item.name对应的额外类名
        const extraClass = nameClassMap[item.name] || '';
        const filterKey = getMarkerFilterKey(item);
        const markerMode = getMarkerMode(item);
        
        categories[category].html += `
            <div class="nav-list-item nav-list-item-${index} nav-list-${item.icon} ${visibleMarker[filterKey] ? 'active': ''} ${extraClass} ${item.num === 0? 'hide': ''}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}" data-mode="${markerMode}" data-filter-key="${filterKey}">
                <div class="wz-bg">
                    ${isWar ? `<div class="wz-icon img_${item.icon} "></div>` : `<div class="wz-icon"><img src="${`${IMG_PRE}/img/lv3/` + item.icon.replace(/^nav_/, '')}.png"/></div>`}
                    <div class="wz-num ${item.num === 1? 'hides': ''}">${item.num}</div>
                </div>
                <div class="wz-name">${item?.sub_name ? item.sub_name : item.name}</div>
            </div>`;
        }

    // 遍历列表并分类
    list.forEach((item, index) => {
        if (item.name === '行动接取站' || item.name === '高价值接取站') return;
        const filterKey = getMarkerFilterKey(item);
        if (seenFilterKeys.has(filterKey)) return;
        seenFilterKeys.add(filterKey);

        console.log('item',item);
        if(!item.name){
            return
        }
        
        if (item.catalog === 'fish') {
            addToCategory(item, index, 'yl');
        } else if (item.name.indexOf('撤离点') !== -1) {
            addToCategory(item, index, 'cld');
        }else if ( item?.name?.indexOf('藏宝图') > -1) {
            addToCategory(item, index, 'cbt');
        } else if (item?.mode?.indexOf('泄露区') > -1){
            addToCategory(item, index, 'mode');
        } else if (item?.name?.indexOf('密钥') > -1){
            addToCategory(item, index, 'my');
        } else if (item?.name?.indexOf('清洗间') > -1){
            addToCategory(item, index, 'xxj');
        } else if (item.name.indexOf('出生点') !== -1) {
            addToCategory(item, index, 'csd');
        } else if (item.name.indexOf('首领') !== -1) {
            addToCategory(item, index, 'sl');
        } else if (item.name.indexOf('基地') > -1) {
            addToCategory(item, index, 'jdbsd');
        // } else if (item.name.indexOf('据点') > -1 && !window.occupy) {
        } else if (item.name.indexOf('据点') > -1) {
            addToCategory(item, index, 'jd');
        } else if (isWar && (item.name.indexOf('车') > -1 || item.name.indexOf('舟') > -1 || item.name.indexOf('轮式') > -1 || item.name.indexOf('直升机') > -1 || item.name.indexOf('坦克') > -1)) {
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
        !typeListInit &&  (visibleMarker[getMarkerFilterKey(item)] = false)
    });

    $('.nav-option-ctn').attr('data-map', currMap)
    // 按指定顺序生成最终 HTML
    let finalHtml = '';
    Object.keys(categories).forEach(key => {
        // console.log(key);
        
        if (categories[key].html) {
            finalHtml += `<div class="nav-type-item nav-${key}"><div class="fgx top0 type-item-fgx" data-nav="${key}">${categories[key].title}</div>${categories[key].html}</div>`;
        }
    });
    if (isWar) {
        navTypyList.addClass('war')
        $('.nav-ctn').addClass('img_nav_bg_war')
        navTypyList.removeClass('normal')

    } else {
        navTypyList.addClass('normal')
        navTypyList.removeClass('war')
        $('.nav-ctn').removeClass('img_nav_bg_war')
    }
    navTypyList.html(finalHtml);

    typeListInit = true;
    visibleMarker2[navIndex].isInit = true;

    $('.type-item-fgx').on('click', (e) => {
        const type = $(e.target).attr('data-nav');
        $(`.nav-${type}`).attr('class').indexOf('close') > -1 ? $(`.nav-${type}`).removeClass('close') :  $(`.nav-${type}`).addClass('close')
    })
}

function toastTips () {
    $('.m-toast').show();
    setTimeout(() => {
        $('.m-toast').hide();
    }, 800)
}


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
    // console.log('name', name, allNavList);
    var markerList = []
    var seenFilterKeys = new Set();
    var html = '';
    for (let index = 0; index < allNavList[0].typeList.length; index++) {
        const element = allNavList[0].typeList[index];
        const filterKey = getMarkerFilterKey(element);
        // console.log(element);
        if (fuzzyMatch(element.name, name) && !seenFilterKeys.has(filterKey)) {
            seenFilterKeys.add(filterKey);
            markerList.push(element)
        }
    }
    
    // console.log('markerList', markerList);
    markerList.length && markerList.forEach(function (item, index) {
        if (item.num === 0) return;
        // 获取该item.name对应的额外类名
        const extraClass = nameClassMap[item.name] || '';
        const filterKey = getMarkerFilterKey(item);
        const markerMode = getMarkerMode(item);
        
        // // console.log(visibleMarker[item.name], item.name);
        html+=`
        <div class="nav-list-item nav-list-item-${index} nav-list-${item.icon} ${visibleMarker[filterKey] ? 'active': ''} ${extraClass} ${item.num === 0? 'hide': ''}" data-index="${index}" data-icon="${item.icon}" data-name="${item.name}" data-mode="${markerMode}" data-filter-key="${filterKey}">
            <div class="wz-bg">
                ${item.catalog === 'fish'
                    ? `<div class="wz-icon"><img src="${`${IMG_PRE}/img/lv3/` + item.icon.replace(/^nav_/, '')}.png"/></div>`
                    : `<div class="wz-icon img_${item.icon}"></div>`}
                <div class="wz-num">${item.num}</div>
            </div>
            <div class="wz-name">${item.name}</div>
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
        var index = $(this).attr('data-index');
        var name = $(this).attr('data-name');
        var icon = $(this).attr('data-icon')
        var filterKey = $(this).attr('data-filter-key') || name;
        // console.log('index', $(e.target).attr('data-icon'));
        NavCliciIndex++;
        currNavIcon = name;
        // if (isWar) {
        //     $(this).attr('class').indexOf('active') ===  -1 ?  $(this).addClass('active'): $(this).removeClass('active')
        // } else {
        //     !visibleMarker[name] ? $(this).addClass('active'): $(this).removeClass('active')
        //     toggleVisible(name, currLeftNav);
        // }
        !visibleMarker[filterKey] ? $(this).addClass('active'): $(this).removeClass('active')
        toggleVisible(filterKey, currLeftNav);
        saveMarker = Object.assign({}, visibleMarker);
        
        let chooseNum = $('.nav-type-list').find('.active').length;

        // console.log('chooseNum', chooseNum, currLeftNav, navTypeList, navTypeList[currLeftNav].typeList);
        
        if (isFloor && chooseNum === navTypeList) {
            $('.btn-choose-all-icon').attr('class', 'img_all_open btn-choose-all-icon')
        } else if (!isFloor && chooseNum === navTypeList[currLeftNav].typeList.length) {
            $('.btn-choose-all-icon').attr('class', 'img_all_open btn-choose-all-icon')
        } else {
            if (listIsAll[currLeftNav]) {
                listIsAll[currLeftNav] = false;
                listIsAll[0] = false;
                $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon')
            } else {
                $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon')
            }
        }
        // console.log('点击');
    })
}

// 事件
var bindEvent = function () {
    // 导航栏状态
    var navState = true;
    var navCtn = $('.nav-ctn')
    var navOptItem = $('.nav-option-item')
    var btnNavState = $('.btn-nav-state');
    var isTimer;
    // 搜索地区



    $('.choose-all').on('click', function () {
        // resetNav();
        isAll = !isAll;
        
        resetAll()
        // console.log('allNavList',listIsAll[currLeftNav], allNavList);
        
        if (isAll) {
            toggleVisible(`${currLeftNav}_all`, currLeftNav);
            $('.btn-choose-all-icon').attr('class', 'img_all_open btn-choose-all-icon')
        } else {
            toggleVisible(`${currLeftNav}_none`, currLeftNav);
            $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon')
        }
        // renderNavTypeList(navList[0].typeList)
        if (Number(currLeftNav) === 0) {
            // console.log('进入', allNavList[0].typeList);
            
            renderNavTypeList(isFloor ? navTypeList : allNavList[0].typeList, 0)
        } else {
            renderNavTypeList(navTypeList[currLeftNav].typeList, currLeftNav)
        }

        bindOptionEvent();

    })

    $('.reset-choose').on('click', function () {
        resetAll('none')
        toggleVisible(`none`, currLeftNav);
            $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon')
        // renderNavTypeList(navList[0].typeList)
        if (isFloor) {
            renderNavTypeList(navTypeList, 0)
        } else if (Number(currLeftNav) === 0) {
            renderNavTypeList(allNavList[0].typeList, 0)
        } else {
            renderNavTypeList(navTypeList[currLeftNav].typeList, currLeftNav)
        }

        bindOptionEvent();
    })

    // 选择类型
    navOptItem.on('click', function (e) {
        var index = $(e.target).attr('data-index');
        currLeftNav = index;
        navOptItem.removeClass('active')
        // ★ 组越界兜底（自 PC 版迁移）：切到组数更少的地图后，残留 tab 点击回退第 0 组，避免取 undefined 崩溃
        if (Number(index) !== 0 && !isFloor && !navTypeList[index]) {
            index = '0';
            currLeftNav = '0';
        }
        $(`.nav-option-item-${index}`).addClass('active')
        // console.log($(e.target).attr('data-index'));
        if (isFloor) {
            renderNavTypeList(navTypeList, 0)
        } else if (Number(index) === 0) {
            renderNavTypeList(allNavList[0].typeList, 0)
        } else {
            renderNavTypeList(navTypeList[index].typeList, index)
        }

        if (listIsAll[currLeftNav]) {
            $('.btn-choose-all-icon').attr('class', 'img_all_open btn-choose-all-icon')
        } else {
            $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon')
        }

        bindOptionEvent();

    })

    bindOptionEvent();
    bindFloorEvent();

    // 打开关闭导航
    btnNavState.on('click', function () {
        navState = !navState;
        if (navState) {
            navCtn.attr('class', 'open img_nav_bg nav-ctn')
        } else {
            navCtn.attr('class', 'close img_nav_bg nav-ctn')
        }
    })



    // 切换地图移入事件
    let currMoveMap = currMap, currMoveWarMap = currWarMap, currWarMap_s;
    dom_changeMapBtn.on('mouseenter', function () {
        dom_mapList.css({height: '4.5rem', width: '1.2rem'});
        dom_changeMapBtn.css('height', '1.5rem')
        dom_changeMapBtn.addClass('hover')
        $('.curr-map-ctn').css('z-index', 7)
    })

    dom_changeMapBtn.on('mouseleave', function () {
        // dom_mapList.css('height', '0px');
        // console.log('移出');
        // console.log('currMoveWarMap', currMoveWarMap);
        if (!isMoveMapList) {
            dom_mapList.css('height', '0px');
            dom_mapList.css('width', '1.2rem');
            dom_changeMapBtn.css('height', '0.3rem')
            dom_changeMapBtn.removeClass('hover')
            dom_mapList.attr('class', `map-list-ctn hover_0`)
            $('.curr-map-ctn').css('z-index', 6)
        }
    })
    let mapItem =  $('.map-item');

    dom_mapList.on('mouseover', function (e) {
        var index = $(e.target).attr('data-index')
        var warMap = $(e.target).attr('data-map')
        // console.log(index, warMap);

        if (index || index == 0) {
            currMoveMap = index;
            currMoveWarMap = warMap;
            console.log('赋值1',currMoveMap );
            
            // currMap = index;
            // currWarMap_s = warMap;
            // currWarMap = warMap
            dom_mapList.attr('class', `map-list-ctn hover_${index}`)
            
        }

        if (warMap) {
            mapItem.removeClass('action')
            // currWarMap = warMap;
            currMoveWarMap = warMap;
            // console.log('赋值2',currMoveWarMap );
            $(e.target).addClass('action')
        }
        dom_mapList.css('width', '4rem');
        isMoveMapList = true;
    })

    dom_mapList.on('mouseleave', function () {
        dom_mapList.css('height', '0px');
        dom_mapList.css('width', '1.2rem');
        dom_changeMapBtn.css('height', '0.3rem')
        dom_changeMapBtn.removeClass('hover')
        dom_mapList.attr('class', `map-list-ctn hover_0`)
        isMoveMapList = false;
        // // console.log('这里移入啥');
        
        // currWarMap_s = currMoveMap;
        // // console.log('赋值4',currWarMap_s );
        $('.map-lv-item').removeClass('action')
        mapItem.removeClass('action')
    })

    $('.map-lv-item').on('mouseover', function (e) {
        var lv = $(e.target).attr('data-lv')
        var type = $(e.target).attr('data-type')
        
        if (lv && Number(lv) > 0) {
            // console.log(lv);
            $('.btn-type-change').attr('class').indexOf('top') === -1 && $('.btn-type-change').addClass('top')
        } else {
            $('.btn-type-change').removeClass('top')
        }

        if (type) {
            $('.map-lv-item').removeClass('action')
            currMoveWarMap = currMoveWarMap;
            // console.log('赋值3',currMoveWarMap );
            currWarType = type;
            $(e.target).addClass('action')
        }
    })

    // 选择难度等级
    $('.map-lv-item').on('click', function (e) {
        var lv = $(e.target).attr('data-lv')
        currLv = lv
        var type = $(e.target).attr('data-type')
        // console.log('isZj', isZj);
        isAll = false;
        isZj = false;
        currMap = currMoveMap;
        currWarMap = currMoveWarMap;

        if (isFloor) {
            resetFloor();
            // outFloorMode(); // 重复执行
        }

        chooseItemLvName = $(e.target).text();
        if (isWar) {
            window.warLv = 0
            $('.lv-change-tips').text(`区域${warLvText[window.warLv]}`)
            
            resetAll('none')
            toggleVisible(`none`, currLeftNav);
            changeWarMap(currWarMap, type)
    
            
            // initNav();
            // bindOptionEvent();
        } else if (isZj && randomEvent[currMap]) {
            changeMapLv(currMap + lv + '_s');
            
        } else {
            changeMapLv(currMap + lv);
        }
        console.log('changeMapLv4', currMap, currLv);

        

        if (randomEvent[currMap]) {
            $('.random-name').text('不开启特殊事件')
            $('.btn-random').removeClass('hide')
            $('.random-list').attr('class', `random-list map-${currMap}-${currLv} close`)
        } else {
            $('.random-name').text('暂无特殊事件')
            $('.btn-random').addClass('hide')
            $('.random-list').attr('class', `random-list map-${currMap}-${currLv} normal`)
        }

        console.log('选择难度后', currMap, currLv, lv, currMoveMap);
        $('.random-list').attr('class', `random-list map-${currMap}-${currLv}`)
        if (currMap + currLv !== currMap + lv) {
            // console.log('走了这里');
            
            // currLv = lv
            currWarType = type
            if (window.pervInitX === window.occupy ? mapScaleInfo.initX_s : mapScaleInfo.initX) return;
            map.flyTo([window.occupy ? mapScaleInfo.initX_s : mapScaleInfo.initX,  window.occupy ? mapScaleInfo.initY_s : mapScaleInfo.initY], window.occupy ? mapScaleInfo.initZoom_s : mapScaleInfo.initZoom)
            window.pervInitX = window.occupy ? mapScaleInfo.initX_s : mapScaleInfo.initX
        }

        dom_mapList.css('height', '0px');
        dom_mapList.css('width', '1.2rem');
        dom_changeMapBtn.css('height', '0.3rem')
        dom_changeMapBtn.removeClass('hover')
        dom_mapList.attr('class', `map-list-ctn hover_0`)
        isMoveMapList = false;
        $('.random-item').removeClass('random-act')
        // $('.btn-random').removeClass('open')
        if (!isWar) {
            resetAll('none')
            toggleVisible(`none`, currLeftNav);
        }

    })

    // 坠机事件
    $('.btn-random').on('click', function () {
        // 切换随机状态
        isZj = !isZj;
        // currMap = currMoveMap;
        isFloor && resetFloor();
        
        // 确定目标地图层级
        let targetMapLv;
        if (isZj) {
            // 随机模式下的地图层级
            targetMapLv = currMap + currLv + '_s';
        } else {
            // 常规模式下的地图层级
            targetMapLv = currMap + currLv;
        }
        
        
        // 切换地图层级
        changeMapLv(targetMapLv);
        
        // 如果当前地图与目标不同，则飞到初始位置
        // if (currMap + currLv !== targetMapLv) {
        //     map.flyTo([mapScaleInfo.initX, mapScaleInfo.initY], mapScaleInfo.initZoom);
        // }
        
        // 重置标记和可见性
        resetAll('none');
        toggleVisible(`none`, currLeftNav);
    });


    let currRandomText = ''
    // 多选随机事件
    $('.random-item').on('click', function () {
        $(this).toggleClass('random-act')
        let length = $('.random-act').length
        if (length) {
            $('.random-list').removeClass('close')
            currRandomText = $('.random-act').text()
            isZj = true;
        } else {
            $('.random-list').addClass('close')
            currRandomText = '不开启特殊事件'
            isZj = false;
        }
        $('.random-name').text(currRandomText)

        enterRandomEvent();
        // currMap = currMoveMap;
    })
    
    // 关闭随机事件
    $('.random-item-close').on('click', () => {
        $('.random-item').removeClass('random-act')
        $('.random-list').addClass('close')
        $('.random-name').text('不开启特殊事件')
        isZj = false;
        enterRandomEvent();
    })
    // 打开日志
    $('.btn-log').on('click', function () {
        $('.log-pop').fadeIn();
        // toastTips();
    })

    // 关闭日志弹窗
    $('.btn-close-pop').on('click', function () {
        $('.log-pop').fadeOut();
    })

    // 打开教程
    $('.btn-tutorial').on('click', function () {
        toastTips();
    })

    // 反馈
    $('.btn-feedback').on('click', function () {
        window.open('https://wj.qq.com/s2/15023838/70c7/')
    })

    $('.bottom-bar-ctn').on('click', function (e) {
        // toastTips();
        e.stopPropagation();
    })


    $('.btn-share').on('click', function () {
        $('.bottom-bar').fadeIn();
        $('.bottom-bar').addClass('show')
    })
    $('.bottom-bar').on('click', function() {
        $('.bottom-bar').removeClass('show')
        $('.bottom-bar').fadeOut();
    })


    // 搜索
    $('.select-iput').on('input',  debounce(function (e) {
        var name = $(e.target).val()
        selectmarker(name)
    }, 500));

    // 关闭搜索
    $('.btn-close-select').on('click', function () {
        $('.select-iput').val('')
        $('.map-select').removeClass('show')
        if (Number(currLeftNav) === 0) {
            renderNavTypeList(allNavList[0].typeList, 0)
        } else {
            renderNavTypeList(navTypeList[currLeftNav].typeList, currLeftNav)
        }
        bindOptionEvent();
        typeof PTTSendClick === 'function' && PTTSendClick('btn', 'close', '关闭弹窗');
    })

    $('.lj').on('click', () => {
        copyToClipboard(window.location.href)
        $('.toast-copy').css('display', 'block');
        setTimeout(() => {
            $('.toast-copy').css('display', 'none');
        }, 800)
    })


    navTypyList.on('scroll', function (e) {

        var aScrollHeight = document.querySelector('.nav-type-list').scrollHeight - document.querySelector('.nav-type-list').clientHeight;
        if ((aScrollHeight - navTypyList.scrollTop() >= -10 && aScrollHeight - navTypyList.scrollTop() <= 10)) {
            navTypyList.addClass('bot')
        } else {
            navTypyList.removeClass('bot')
        }
    })

    var regionName = $('.map-region-name')
    window.addEventListener('zoom', function (e) {
        regionName.attr('class', `map-region-name lv-${e.detail}`)
        // // console.log(Number(e.detail), e.detail);
        // if (Number(e.detail) >= 2) {
        //     // console.log(1111);
        //     mapFolder = '5/';
        //     currLayer.setUrl(` ./img/map_db/5/{z}_{x}_{y}.jpg`);
          
        // } else {
        //     currLayer.setUrl(` ./img/map_db/0_4/{z}_{x}_{y}.jpg`);
        // }
    })

    // 进攻方视角
    $('.view-change1').on('click', () => {
        if (!window.viewChange) {
            window.viewChange = true;
            window.isViewChange = true;
            $('.btn-view-change').addClass('g')
            $('.btn-view-change').removeClass('f')
            $('.nav-option-ctn').addClass('g');
            $('.nav-option-ctn').removeClass('f');
            $('.war-lv-change-list').attr('class', 'war-lv-change-list g')
           
            warInit(currWarMap, currWarType, true);
            viewChangeToMap();


            setTimeout(() => {
                window.isViewChange = false;
            }, 800);
        }
    })

    // 防守方视角
    $('.view-change2').on('click', () => {
        if (window.viewChange) {
            window.viewChange = false;
            window.isViewChange = true;
            $('.btn-view-change').addClass('f')
            $('.btn-view-change').removeClass('g')
            $('.nav-option-ctn').addClass('f');
            $('.nav-option-ctn').removeClass('g');
            $('.war-lv-change-list').attr('class', 'war-lv-change-list f')


            warInit(currWarMap, currWarType, true);
            // // console.log(cacheMarker);
            viewChangeToMap();
            setTimeout(() => {
                window.isViewChange = false;
            }, 800);

        }
    })

    $('.btn-type-change').on('click', (e) => {
        var type = $(e.target).attr('data-type')
        type === 'occupy' ? (window.occupy = true) : (window.occupy = false)
        // console.log('window.occupy', window.occupy, currMoveWarMap);
        currWarMap = currMoveWarMap;
        // window.occupy = !window.occupy;
        window.warLv = 0
        console.log('changeWarMap', currWarMap, currWarType);
        $('.lv-change-tips').text(`区域${warLvText[window.warLv]}`)
        if (window.occupy) {
            $('.btn-type-change').addClass('open')
            // $('.war-lv-change-ctn').addClass('show')
            $('.war-lv-change-ctn').removeClass('show')
        } else {
            $('.btn-type-change').removeClass('open')
            $('.war-lv-change-ctn').addClass('show')
         
        }
        // console.log('currWarMap', currWarMap, currWarType);
        
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
        $('.lv-change-tips').text(`区域${warLvText[window.warLv]}`)
        $('.deploy-swiper').removeClass('show')
        map.flyTo([window[currWarMap].info.sectorInit[window.warLv].initX,  window[currWarMap].info.sectorInit[window.warLv].initY], window[currWarMap].info.sectorInit[window.warLv].initZoom)
        listIsAll[currLeftNav] = false;
        $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon')
        setTimeout(() => {
            window.isLvChange = false;
        }, 500)
    })

    $('.lv-change-next').on('click', () => {
        if (window.isLvChange) return;
        if (window.warLv === window[currWarMap].info.sector - 1) return;
        window.isLvChange = true;
        window.warLv++;
        changeWarMap(currWarMap, currWarType);
        // initNav();
        // bindOptionEvent();
        $('.lv-change-tips').text(`区域${warLvText[window.warLv]}`)
        $('.deploy-swiper').removeClass('show')
        // console.log('currWarMap', currWarMap);

        map.flyTo([window[currWarMap].info.sectorInit[window.warLv].initX,  window[currWarMap].info.sectorInit[window.warLv].initY], window[currWarMap].info.sectorInit[window.warLv].initZoom)
        listIsAll[currLeftNav] = false;
        $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon')
        setTimeout(() => {
            window.isLvChange = false;
        }, 500)
    })

    $('.btn-swiper-prev').on('click', () => {
        window.warSwiper.slidePrev();
    })

    $('.btn-swiper-next').on('click', () => {
        window.warSwiper.slideNext();
    })

    $('.war-change-text').on('click', () => {
        if (isWar) return;
        enterWarMap();
    })

    $('.map-change-text').on('click', () => {
        if (!isWar) return;
        isWar = false;
        
        $('#MapContainer').addClass('map')
        window.occupy = false;
        window.viewChange = true;
        $('.btn-view-change').addClass('g')
        $('.btn-view-change').removeClass('f')
        $('.nav-option-ctn').addClass('g');
        $('.nav-option-ctn').removeClass('f');
        $('.war-lv-change-list').attr('class', 'war-lv-change-list g')
        $('.map-floor').css('display', 'block');
        $('.random-ctn').css('display', 'flex');

        dom_changeMapBtn.removeClass('war')
        $('.btn-war-change').addClass('fh')
        $('.btn-war-change').removeClass('war')
        $('.nav-ctn').removeClass('img_nav_bg_war')
        $('.btn-view-change').attr('class', 'btn-view-change')
        resetAll('none');
        toggleVisible(`none`, currLeftNav);
        changeMapLv('00');
        warRemove();
        currMap = '0';
        currLv = '0'
        initNav();
        bindOptionEvent();
        initQuickPosition();
        $('.war-lv-change-ctn').removeClass('show')
        $('.select-region-ctn').css('display', 'block')
        $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon');
    })



    // 处理楼层切换的通用函数
    function handleFloorChange(index) {
        var currentFloorList = getCurrentFloorList();
        console.log('currentFloorList', currentFloorList);
        var currentFloor = currentFloorList[index];
        if (!currentFloor) return;
        $('.map-floor-item, .floor-item').removeClass('act');
        $(`.floor_${currentFloor.floor_f}`).addClass('act');
        $(`.floor-item-${index}`).addClass('act');
        $('.floor-tips .span1').text(currentFloor.floor_name);
        changeMapLv(buildFloorMapPath(currentFloor));
        console.log('初始化后', currMap, currLv);
        console.log('changeMapLv5', currMap, currLv);
        enterFloorSave();
    }

    // 上一层
    $('.floor-change-prev').on('click', () => {
        var currentFloorList = getCurrentFloorList();
        if (!currentFloorList.length) return;
        if (currFloorIndex > 0) {
            currFloorIndex--;
            handleFloorChange(currFloorIndex);
            $('.map-floor .btn-floor').html(`<p>正在查看 <span class="color">${currentFloorList[currFloorIndex].floor_f}层</span></p>`)
            $('.map-floor .btn-floor').attr('class', `btn-floor btn_floor floor-${currentFloorList[currFloorIndex].floor_f}`)
        } else if (currFloorIndex === -1) {
            isFloor = true;
            outFloor = false;
            saveMarker = Object.assign({}, visibleMarker);
            currFloorIndex = 0
            handleFloorChange(currFloorIndex);
            $('.floor-tips').html(`您正在查看<span class="span1">${currentFloorList[currFloorIndex].floor_name}</span><span class="span2">返回大地图</span>`)
            $('.map-floor .btn-floor').attr('class', `btn-floor btn_floor floor-${currentFloorList[currFloorIndex].floor_f}`)
           
        } else {
            currFloorIndex = currentFloorList.length - 1
            handleFloorChange(currFloorIndex);
            $('.floor-tips').html(`您正在查看<span class="span1">${currentFloorList[currFloorIndex].floor_name}</span><span class="span2">返回大地图</span>`)
            $('.map-floor .btn-floor').attr('class', `btn-floor btn_floor floor-${currentFloorList[currFloorIndex].floor_f}`)
        }
        bindFloorTipsExitEvent();
    });

    // 下一层
    $('.floor-change-next').on('click', () => {
        var currentFloorList = getCurrentFloorList();
        if (!currentFloorList.length) return;
        if (currFloorIndex === -1) {
            isFloor = true;
            outFloor = false;
            saveMarker = Object.assign({}, visibleMarker);
            // console.log('进入前', saveMarker);
            
        }

        if (currFloorIndex < currentFloorList.length - 1) {
            currFloorIndex++;
            $('.floor-tips').html(`您正在查看<span class="span1">${currentFloorList[currFloorIndex].floor_name}</span><span class="span2">返回大地图</span>`)
            handleFloorChange(currFloorIndex);
            $('.map-floor .btn-floor').html(`<p>正在查看 <span class="color">${currentFloorList[currFloorIndex].floor_f}层</span></p>`)
            $('.map-floor .btn-floor').attr('class', `btn-floor btn_floor floor-${currentFloorList[currFloorIndex].floor_f}`)
            
        } else {
            currFloorIndex = 0
            isFloor = true;
            outFloor = false;
            saveMarker = Object.assign({}, visibleMarker);
            handleFloorChange(currFloorIndex);
            $('.floor-tips').html(`您正在查看<span class="span1">${currentFloorList[currFloorIndex].floor_name}</span><span class="span2">返回大地图</span>`)
            $('.map-floor .btn-floor').attr('class', `btn-floor btn_floor floor-${currentFloorList[currFloorIndex].floor_f}`)
            
        }
        bindFloorTipsExitEvent();
        $('#MapContainer').addClass('floor')
        $('.floor-tips').css('display', 'block');
    });

}

// 快速定位事件绑定
function initQuickPosition () {
    let isTimer;
    $('.region-item').off('click').on('click', function (e) {
        $('#MapContainer').removeClass('map')
        clearTimeout(isTimer);
        var x = $(e.target).attr('data-x');
        var y = $(e.target).attr('data-y');
        var pos = getMapPos(x, y)
        if (isFloor) {
            outFloorMode(); 
                setTimeout(() => {
                    map.flyTo([pos.y * 2, pos.x * 2], 5)
                }, 500)
            
        } else {
            map.flyTo([pos.y, pos.x], 5)
        }
        // console.log(pos);
        isTimer = setTimeout(() => {
            $('#MapContainer').addClass('map')
        }, 2000)
        setCurrRegion($(e.target).text());
        currFloorRegion = normalizeFloorRegionName(currRegion);
        $('.curr-reigon').text(getSafeRegionName());
        if (findFloor(currRegion)) {
           // console.log('进入楼层', currFloorIndex);
           
            initFloor();
            // isFloor = true;
            // $('#MapContainer').addClass('floor')
            $('.not-event').addClass('act');
            $('.map-floor-change-ctn').addClass('show');
            $('.map-floor .btn-floor').html(`<p>请选择楼层</p>`)
            $('.floor-tips').html(`<p> 您正在查看<span class="span1">${getSafeRegionName()}</span></p>`)
        } else {
            isFloor = false;
            currFloorIndex = -1;
            // console.log('进入这里2', currFloorIndex);
            
            floorList.html('')
            floorList.append(`<div class="floor-item not-event">大地图模式</div>`)
            $('.map-floor-change-ctn').removeClass('show');
        }
    })
}


// 进入大战场
function enterWarMap () { 
    isWar = true;
    resetFloor();
    $('#MapContainer').removeClass('map')
    dom_changeMapBtn.addClass('war')
    $('.btn-war-change').addClass('war')
    $('.nav-ctn').addClass('img_nav_bg_war')
    $('.btn-war-change').removeClass('fh')
    $('.btn-view-change').addClass('g')
    $('.map-floor').css('display', 'none');
    $('.random-ctn').css('display', 'none');
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
    
   


    // initNav();
    // bindOptionEvent();
    $('.war-lv-change-ctn').addClass('show')
    $('.select-region-ctn').css('display', 'none')
 }

// 视角切换
function viewChangeToMap () {

    $.each(cacheMarker, function (index) {
        if (this.options.icon.name === "进攻方基地" ) {
            // console.log(`${window.viewChange ? 'g_jdbsd_g': 'g_jdbsd_r'}`);
            var icon = L.divIcon({
                className: ` map-war-icon`,
                html: `<div class="map-icon-bg"><img src="${IMG_PRE}/img/dzc_i/${window.viewChange ? 'g_jdbsd_g': 'g_jdbsd_r'}.png"/></div>`,
                iconSize: [30, 30],			//设置图标大小
                iconAnchor: [15, 15],		//设置图标偏移
            })
            icon.name = '进攻方基地'
            this.setIcon(icon);
        } else if (this.options.icon.name === "防守方基地") {
            var icon = L.divIcon({
                className: ` map-war-icon`,
                html: `<div class="map-icon-bg"><img src="${IMG_PRE}/img/dzc_i/${window.viewChange ? 'f_jdbsd_r': 'f_jdbsd_g'}.png"/></div>`,
                iconSize: [30, 30],			//设置图标大小
                iconAnchor: [15, 15],		//设置图标偏移
            })
            icon.name = '防守方基地'
            this.setIcon(icon);
        }
    })
}

// 查找是否有楼层
function findFloor (regionName) {
    return resolveFloorList(regionName, false).length > 0;
}

// 重制楼层
function resetFloor () {
    $('.map-floor-change-ctn').removeClass('show')
    isFloor = false;
    $('.map-floor .btn-floor').html(`<p>查看地图分层</p>`)
    $('.map-floor .btn-floor').attr('class', 'btn-floor btn_floor')
    currFloorIndex = -1;
    currFloorRegion = '';
    $('#MapContainer').removeClass('floor')
}

// 地图难度切换
function changeMapLv(type) {
    console.log('changeMapLv ', type);
    
    // 地图配置映射表
    const mapConfigs = {
        // 零号大坝配置
        '00': {
            info: dabaInfo,
            nav: navList,
            navInfo: navListInfo,
            icons: mapArticle,
            poi: selectRegion,
            name: '零号大坝',
            level: '常规',
            layer: 'map_db',
            needRemove: true,
        },
        '00_B1': {
            info: dabaInfo,
            nav: dabaInfo.floorInfo.navList_minus,
            navInfo: dabaInfo.floorInfo.navList_minus,
            icons: dabaInfo.floorInfo.mapArticle_minus,
            poi: selectRegion,
            name: '零号大坝',
            level: '常规',
            layer: 'daba_0f',
            needRemove: true
        },
        '00_1F': {
            info: dabaInfo,
            nav: dabaInfo.floorInfo.navList_firest,
            navInfo: dabaInfo.floorInfo.navList_firest,
            icons: dabaInfo.floorInfo.mapArticle_first,
            poi: selectRegion,
            name: '零号大坝',
            level: '常规',
            layer: 'daba_1f',
            needRemove: true
        },
        '00_2F': {
            info: dabaInfo,
            nav: dabaInfo.floorInfo.navList_second,
            navInfo: dabaInfo.floorInfo.navList_second,
            icons: dabaInfo.floorInfo.mapArticle_second,
            poi: selectRegion,
            name: '零号大坝',
            level: '常规',
            layer: 'daba_2f',
            needRemove: true
        },
        '01': {
            info: dabaInfo,
            nav: navList2,
            navInfo: navListInfo2,
            icons: mapArticle2,
            poi: selectRegion,
            name: '零号大坝',
            level: '机密',
            layer: 'map_db',
            needRemove: true
        },
        '01_B1': {
            info: dabaInfo,
            nav: dabaInfo.floorInfo.navList2_minus,
            navInfo: dabaInfo.floorInfo.navList2_minus,
            icons: dabaInfo.floorInfo.mapArticle2_minus,
            poi: selectRegion,
            name: '零号大坝',
            level: '机密',
            layer: 'daba_0f',
            needRemove: true
        },
        '01_1F': {
            info: dabaInfo,
            nav: dabaInfo.floorInfo.navList2_firest,
            navInfo: dabaInfo.floorInfo.navList2_firest,
            icons: dabaInfo.floorInfo.mapArticle2_first,
            poi: selectRegion,
            name: '零号大坝',
            level: '机密',
            layer: 'daba_1f',
            needRemove: true
        },
        '01_2F': {
            info: dabaInfo,
            nav: dabaInfo.floorInfo.navList2_second,
            navInfo: dabaInfo.floorInfo.navList2_second,
            icons: dabaInfo.floorInfo.mapArticle2_second,
            poi: selectRegion,
            name: '零号大坝',
            level: '机密',
            layer: 'daba_2f',
            needRemove: true
        },
        '02': {
            info: dabaInfo,
            nav: navList3,
            navInfo: navListInfo3,
            icons: mapArticle3,
            poi: selectRegion,
            name: '零号大坝',
            level: '终夜',
            layer: 'map_db',
            needRemove: true
        },
        '02_B1': {
            info: dabaInfo,
            nav: dabaInfo.floorInfo.navList3_minus,
            navInfo: dabaInfo.floorInfo.navList3_minus,
            icons: dabaInfo.floorInfo.mapArticle3_minus,
            poi: selectRegion,
            name: '零号大坝',
            level: '终夜',
            layer: 'daba_0f',
            needRemove: true
        },
        '02_1F': {
            info: dabaInfo,
            nav: dabaInfo.floorInfo.navList3_firest,
            navInfo: dabaInfo.floorInfo.navList3_firest,
            icons: dabaInfo.floorInfo.mapArticle3_first,
            poi: selectRegion,
            name: '零号大坝',
            level: '终夜',
            layer: 'daba_1f',
            needRemove: true
        },
        '02_2F': {
            info: dabaInfo,
            nav: dabaInfo.floorInfo.navList3_second,
            navInfo: dabaInfo.floorInfo.navList3_second,
            icons: dabaInfo.floorInfo.mapArticle3_second,
            poi: selectRegion,
            name: '零号大坝',
            level: '终夜',
            layer: 'daba_2f',
            needRemove: true
        },
        '03': {
            info: dabaInfo,
            nav: navList4,
            navInfo: navListInfo4,
            icons: mapArticle4,
            poi: selectRegion,
            name: '零号大坝',
            level: '永夜',
            layer: 'map_db',
            needRemove: true,
        },
        '03_B1': {
            info: dabaInfo,
            nav: dabaInfo.floorInfo.navList_minus,
            navInfo: dabaInfo.floorInfo.navList_minus,
            icons: dabaInfo.floorInfo.mapArticle_minus,
            poi: selectRegion,
            name: '零号大坝',
            level: '永夜',
            layer: 'daba_0f',
            needRemove: true
        },
        '03_1F': {
            info: dabaInfo,
            nav: dabaInfo.floorInfo.navList_firest,
            navInfo: dabaInfo.floorInfo.navList_firest,
            icons: dabaInfo.floorInfo.mapArticle_first,
            poi: selectRegion,
            name: '零号大坝',
            level: '永夜',
            layer: 'daba_1f',
            needRemove: true
        },
        '03_2F': {
            info: dabaInfo,
            nav: dabaInfo.floorInfo.navList_second,
            navInfo: dabaInfo.floorInfo.navList_second,
            icons: dabaInfo.floorInfo.mapArticle_second,
            poi: selectRegion,
            name: '零号大坝',
            level: '永夜',
            layer: 'daba_2f',
            needRemove: true
        },
        // 长弓溪谷配置
        '10': {
            info: cgxgInfo,
            nav: navList_cgxg,
            navInfo: navListInfo_cgxg,
            icons: mapArticle_cgxg,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '常规',
            layer: 'map_yc',
            needRemove: true
        },
        '10_1F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList_firest,
            navInfo: cgxgInfo.floorInfo.navList_firest,
            icons: cgxgInfo.floorInfo.mapArticle_first,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '常规',
            layer: 'cgxg_1f',
            needRemove: true
        },
        '10_2F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList_second,
            navInfo: cgxgInfo.floorInfo.navList_second,
            icons: cgxgInfo.floorInfo.mapArticle_second,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '常规',
            layer: 'cgxg_2f',
            needRemove: true
        },
        '10_s': {
            info: cgxgInfo,
            nav: navList2_cgxg,
            navInfo: navListInfo2_cgxg,
            icons: mapArticle2_cgxg,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '常规｜坠机事件',
            layer: 'map_yc2',
            needRemove: true
        },
        '10_s_1F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList_s_firest,
            navInfo: cgxgInfo.floorInfo.navList_s_firest,
            icons: cgxgInfo.floorInfo.mapArticle_s_first,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '常规｜坠机事件',
            layer: 'cgxg_1f',
            needRemove: true
        },
        '10_s_2F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList_s_second,
            navInfo: cgxgInfo.floorInfo.navList_s_second,
            icons: cgxgInfo.floorInfo.mapArticle_s_second,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '常规｜坠机事件',
            layer: 'cgxg_2f',
            needRemove: true
        },
        '10_ldz_1F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList_ldz_1f,
            navInfo: cgxgInfo.floorInfo.navList_ldz_1f,
            icons: cgxgInfo.floorInfo.mapArticle_ldz_1f,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '常规',
            layer: 'cgxg_ldz_1f',
            needRemove: true
        },
        '10_ldz_2F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList_ldz_2f,
            navInfo: cgxgInfo.floorInfo.navList_ldz_2f,
            icons: cgxgInfo.floorInfo.mapArticle_ldz_2f,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '常规',
            layer: 'cgxg_ldz_2f',
            needRemove: true
        },
        '10_ldz_3F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList_ldz_3f,
            navInfo: cgxgInfo.floorInfo.navList_ldz_3f,
            icons: cgxgInfo.floorInfo.mapArticle_ldz_3f,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '常规',
            layer: 'cgxg_ldz_3f',
            needRemove: true
        },
        '10_ldz_4F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList_ldz_4f,
            navInfo: cgxgInfo.floorInfo.navList_ldz_4f,
            icons: cgxgInfo.floorInfo.mapArticle_ldz_4f,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '常规',
            layer: 'cgxg_ldz_4f',
            needRemove: true
        },
        '10_ldz_B1': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList2_ldz_b1,
            navInfo: cgxgInfo.floorInfo.navList2_ldz_b1,
            icons: cgxgInfo.floorInfo.mapArticle2_ldz_b1,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '常规',
            layer: 'cgxg_ldz_b1',
            needRemove: true
        },
        '11': {
            info: cgxgInfo,
            nav: navList3_cgxg,
            navInfo: navListInfo3_cgxg,
            icons: mapArticle3_cgxg,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '机密',
            layer: 'map_yc',
            needRemove: true
        },
        '11_1F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList2_firest,
            navInfo: cgxgInfo.floorInfo.navList2_firest,
            icons: cgxgInfo.floorInfo.mapArticle2_first,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '机密',
            layer: 'cgxg_1f',
            needRemove: true
        },
        '11_2F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList2_second,
            navInfo: cgxgInfo.floorInfo.navList2_second,
            icons: cgxgInfo.floorInfo.mapArticle2_second,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '机密',
            layer: 'cgxg_2f',
            needRemove: true
        },
        '11_s': {
            info: cgxgInfo,
            nav: navList4_cgxg,
            navInfo: navListInfo4_cgxg,
            icons: mapArticle4_cgxg,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '机密｜坠机事件',
            layer: 'map_yc2',
            needRemove: true
        },
        '11_s_1F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList2_s_firest,
            navInfo: cgxgInfo.floorInfo.navList2_s_firest,
            icons: cgxgInfo.floorInfo.mapArticle2_s_first,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '机密｜坠机事件',
            layer: 'cgxg_1f',
            needRemove: true
        },
        '11_s_2F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList2_s_second,
            navInfo: cgxgInfo.floorInfo.navList2_s_second,
            icons: cgxgInfo.floorInfo.mapArticle2_s_second,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '机密｜坠机事件',
            layer: 'cgxg_2f',
            needRemove: true
        },
        '11_ldz_1F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList2_ldz_1f,
            navInfo: cgxgInfo.floorInfo.navList2_ldz_1f,
            icons: cgxgInfo.floorInfo.mapArticle2_ldz_1f,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '机密',
            layer: 'cgxg_ldz_1f',
            needRemove: true
        },
        '11_ldz_2F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList2_ldz_2f,
            navInfo: cgxgInfo.floorInfo.navList2_ldz_2f,
            icons: cgxgInfo.floorInfo.mapArticle2_ldz_2f,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '机密',
            layer: 'cgxg_ldz_2f',
            needRemove: true
        },
        '11_ldz_3F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList2_ldz_3f,
            navInfo: cgxgInfo.floorInfo.navList2_ldz_3f,
            icons: cgxgInfo.floorInfo.mapArticle2_ldz_3f,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '机密',
            layer: 'cgxg_ldz_3f',
            needRemove: true
        },
        '11_ldz_4F': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList2_ldz_4f,
            navInfo: cgxgInfo.floorInfo.navList2_ldz_4f,
            icons: cgxgInfo.floorInfo.mapArticle2_ldz_4f,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '机密',
            layer: 'cgxg_ldz_4f',
            needRemove: true
        },
        '11_ldz_B1': {
            info: cgxgInfo,
            nav: cgxgInfo.floorInfo.navList2_ldz_b1,
            navInfo: cgxgInfo.floorInfo.navList2_ldz_b1,
            icons: cgxgInfo.floorInfo.mapArticle2_ldz_b1,
            poi: selectRegion_cgxg,
            name: '长弓溪谷',
            level: '机密',
            layer: 'cgxg_ldz_b1',
            needRemove: true
        },
        // 航天基地配置
        '21': {
            info: htjdInfo,
            nav: navList_htjd,
            navInfo: navListInfo_htjd,
            icons: mapArticle_htjd,
            poi: selectRegion_htjd,
            name: '航天基地',
            level: '机密',
            layer: 'map_htjd',
            needRemove: true
        },
        '21_s': {
            info: htjdInfo,
            nav: navList2_htjd,
            navInfo: navListInfo2_htjd,
            icons: mapArticle2_htjd,
            poi: selectRegion_htjd,
            name: '航天基地',
            level: '机密|断桥事件',
            layer: 'map_htjd2',
            needRemove: true
        },
        '22': {
            info: htjdInfo,
            nav: navList3_htjd,
            navInfo: navListInfo3_htjd,
            icons: mapArticle3_htjd,
            poi: selectRegion_htjd,
            name: '航天基地',
            level: '绝密',
            layer: 'map_htjd',
            needRemove: true
        },
        '22_s': {
            info: htjdInfo,
            nav: navList4_htjd,
            navInfo: navListInfo4_htjd,
            icons: mapArticle4_htjd,
            poi: selectRegion_htjd,
            name: '航天基地',
            level: '绝密|断桥事件',
            layer: 'map_htjd2',
            needRemove: true
        },
        
        // 巴克什配置
        '30': {
            info: bksInfo,
            nav: navList_bks,
            navInfo: navListInfo_bks,
            icons: mapArticle_bks,
            poi: selectRegion_bks,
            name: '巴克什',
            level: '常规',
            layer: 'map_bks2',
            needRemove: true
        },
        '31': {
            info: bksInfo,
            nav: navList_bks,
            navInfo: navListInfo_bks,
            icons: mapArticle_bks,
            poi: selectRegion_bks,
            name: '巴克什',
            level: '机密',
            layer: 'map_bks2',
            needRemove: true
        },
        '31_B1': {
            info: bksInfo,
            nav: bksInfo.floorInfo.navList_firest,
            navInfo: bksInfo.floorInfo.navList_firest,
            icons: bksInfo.floorInfo.mapArticle_first,
            poi: selectRegion_bks,
            name: '巴克什',
            level: '机密',
            // layer: 'map_bks2',
            layer: 'bks_1f',
            needRemove: true
        },
        '31_1F': {
            info: bksInfo,
            nav: bksInfo.floorInfo.navList_second,
            navInfo: bksInfo.floorInfo.navList_second,
            icons: bksInfo.floorInfo.mapArticle_second,
            poi: selectRegion_bks,
            name: '巴克什',
            level: '机密',
            // layer: 'map_bks2',
            layer: 'bks_2f',
            needRemove: true
        },
        '31_2F': {
            info: bksInfo,
            nav: bksInfo.floorInfo.navList_three,
            navInfo: bksInfo.floorInfo.navList_three,
            icons: bksInfo.floorInfo.mapArticle_three,
            poi: selectRegion_bks,
            name: '巴克什',
            level: '机密',
            // layer: 'map_bks2',
            layer: 'bks_3f',
            needRemove: true
        },
        '32': {
            info: bksInfo,
            nav: navList2_bks,
            navInfo: navListInfo2_bks,
            icons: mapArticle2_bks,
            poi: selectRegion_bks,
            name: '巴克什',
            level: '绝密',
            layer: 'map_bks2',
            needRemove: true
        },
        '32_B1': {
            info: bksInfo,
            nav: bksInfo.floorInfo.navList2_firest,
            navInfo: bksInfo.floorInfo.navList2_firest,
            icons: bksInfo.floorInfo.mapArticle2_first,
            poi: selectRegion_bks,
            name: '巴克什',
            level: '绝密',
            // layer: 'map_bks2',
            layer: 'bks_1f',
            needRemove: true
        },
        '32_1F': {
            info: bksInfo,
            nav: bksInfo.floorInfo.navList2_second,
            navInfo: bksInfo.floorInfo.navList2_second,
            icons: bksInfo.floorInfo.mapArticle2_second,
            poi: selectRegion_bks,
            name: '巴克什',
            level: '绝密',
            // layer: 'map_bks2',
            layer: 'bks_2f',
            needRemove: true
        },
        '32_2F': {
            info: bksInfo,
            nav: bksInfo.floorInfo.navList2_three,
            navInfo: bksInfo.floorInfo.navList2_three,
            icons: bksInfo.floorInfo.mapArticle2_three,
            poi: selectRegion_bks,
            name: '巴克什',
            level: '绝密',
            // layer: 'map_bks2',
            layer: 'bks_3f',
            needRemove: true
        },
        // 潮汐监狱配置
        '42': {
            info: cxjyInfo,
            nav: navList_cxjy,
            navInfo: navListInfo_cxjy,
            icons: mapArticle_cxjy,
            poi: selectRegion_cxjy,
            name: '潮汐监狱',
            level: '绝密',
            layer: 'map_cxjy',
            needRemove: true
        },
        '42_1F': {
            info: cxjyInfo,
            nav: cxjyInfo.floorInfo.navList_firest,
            navInfo: cxjyInfo.floorInfo.navList_firest,
            icons: cxjyInfo.floorInfo.mapArticle_first,
            poi: selectRegion_cxjy,
            name: '潮汐监狱',
            level: '绝密',
            layer: 'cxjy_1f',
            needRemove: true
        },
        '42_2F': {
            info: cxjyInfo,
            nav: cxjyInfo.floorInfo.navList_second,
            navInfo: cxjyInfo.floorInfo.navList_second,
            icons: cxjyInfo.floorInfo.mapArticle_second,
            poi: selectRegion_cxjy,
            name: '潮汐监狱',
            level: '绝密',
            layer: 'cxjy_2f',
            needRemove: true
        },
        '42_3F': {
            info: cxjyInfo,
            nav: cxjyInfo.floorInfo.navList_three,
            navInfo: cxjyInfo.floorInfo.navList_three,
            icons: cxjyInfo.floorInfo.mapArticle_three,
            poi: selectRegion_cxjy,
            name: '潮汐监狱',
            level: '绝密',
            layer: 'cxjy_3f',
            needRemove: true
        },
        '42_4F': {
            info: cxjyInfo,
            nav: cxjyInfo.floorInfo.navList_four,
            navInfo: cxjyInfo.floorInfo.navList_four,
            icons: cxjyInfo.floorInfo.mapArticle_four,
            poi: selectRegion_cxjy,
            name: '潮汐监狱',
            level: '绝密',
            layer: 'cxjy_4f',
            needRemove: true
        },
        '50': {
            info: az3Info,
            nav: navList_az3,
            navInfo: navListInfo_az3,
            icons: mapArticle_az3,
            poi: selectRegion_az3,
            name: 'AZ3',
            level: '常规',
            layer: 'map_az3',
            needRemove: true,
        },
         '50_1_1F': {
            info: az3Info,
            nav: az3Info.floorInfo.navList_firest1,
            navInfo: az3Info.floorInfo.navList_firest1,
            icons: az3Info.floorInfo.mapArticle_first1,
            poi: selectRegion_az3,
            name: 'RBMK反应堆',
            level: '常规',
            layer: 'az3_1_1f',
            needRemove: true
        },
         '50_1_2F': {
            info: az3Info,
            nav: az3Info.floorInfo.navList_second1,
            navInfo: az3Info.floorInfo.navList_second1,
            icons: az3Info.floorInfo.mapArticle_second1,
            poi: selectRegion_az3,
            name: 'RBMK反应堆',
            level: '常规',
            layer: 'az3_1_2f',
            needRemove: true
        },
        '50_2_1F': {
            info: az3Info,
            nav: az3Info.floorInfo.navList_firest2,
            navInfo: az3Info.floorInfo.navList_firest2,
            icons: az3Info.floorInfo.mapArticle_first2,
            poi: selectRegion_az3,
            name: 'RBMK反应堆',
            level: '常规',
            layer: 'az3_2_1f',
            needRemove: true
        },
         '50_2_2F': {
            info: az3Info,
            nav: az3Info.floorInfo.navList_second2,
            navInfo: az3Info.floorInfo.navList_second2,
            icons: az3Info.floorInfo.mapArticle_second2,
            poi: selectRegion_az3,
            name: 'RBMK反应堆',
            level: '常规',
            layer: 'az3_2_2f',
            needRemove: true
        },
        '50_3_1F': {
            info: az3Info,
            nav: az3Info.floorInfo.navList_firest3,
            navInfo: az3Info.floorInfo.navList_firest3,
            icons: az3Info.floorInfo.mapArticle_first3,
            poi: selectRegion_az3,
            name: 'RBMK反应堆',
            level: '常规',
            layer: 'az3_3_1f',
            needRemove: true
        },
         '50_3_2F': {
            info: az3Info,
            nav: az3Info.floorInfo.navList_second3,
            navInfo: az3Info.floorInfo.navList_second3,
            icons: az3Info.floorInfo.mapArticle_second3,
            poi: selectRegion_az3,
            name: 'RBMK反应堆',
            level: '常规',
            layer: 'az3_3_2f',
            needRemove: true
        },
         '50_1_3F': {
            info: az3Info,
             nav: az3Info.floorInfo.navList_three1,
            navInfo: az3Info.floorInfo.navList_three1,
            icons: az3Info.floorInfo.mapArticle_three1,
            poi: selectRegion_az3,
            name: 'RBMK反应堆',
            level: '常规',
            layer: 'az3_1_3f',
            needRemove: true
        },
        '51': {
            info: az3Info,
            nav: navList2_az3,
            navInfo: navListInfo2_az3,
            icons: mapArticle2_az3,
            poi: selectRegion_az3,
            name: 'AZ3',
            level: '机密',
            layer: 'map_az3',
            needRemove: true,
        },
         '51_1_1F': {
            info: az3Info,
            nav: az3Info.floorInfo.navList2_firest1,
            navInfo: az3Info.floorInfo.navList2_firest1,
            icons: az3Info.floorInfo.mapArticle2_first1,
            poi: selectRegion_az3,
            name: 'RBMK反应堆',
            level: '机密',
            layer: 'az3_1_1f',
            needRemove: true
        },
         '51_1_2F': {
            info: az3Info,
            nav: az3Info.floorInfo.navList2_second1,
            navInfo: az3Info.floorInfo.navList2_second1,
            icons: az3Info.floorInfo.mapArticle2_second1,
            poi: selectRegion_az3,
            name: 'RBMK反应堆',
            level: '机密',
            layer: 'az3_1_2f',
            needRemove: true
        },
         '51_2_1F': {
            info: az3Info,
            nav: az3Info.floorInfo.navList2_firest2,
            navInfo: az3Info.floorInfo.navList2_firest2,
            icons: az3Info.floorInfo.mapArticle2_first2,
            poi: selectRegion_az3,
            name: '老科学院',
            level: '机密',
            layer: 'az3_2_1f',
            needRemove: true
        },
         '51_2_2F': {
            info: az3Info,
            nav: az3Info.floorInfo.navList2_second2,
            navInfo: az3Info.floorInfo.navList2_second2,
            icons: az3Info.floorInfo.mapArticle2_second2,
            poi: selectRegion_az3,
            name: '老科学院',
            level: '机密',
            layer: 'az3_2_2f',
            needRemove: true
        },
        '51_1_3F': {
            info: az3Info,
            nav: az3Info.floorInfo.navList2_firest3,
            navInfo: az3Info.floorInfo.navList2_firest3,
            icons: az3Info.floorInfo.mapArticle2_first3,
            poi: selectRegion_az3,
            name: 'RBMK反应堆',
            level: '机密',
            layer: 'az3_3_1f',
            needRemove: true
        },
         '51_3_2F': {
            info: az3Info,
            nav: az3Info.floorInfo.navList2_second3,
            navInfo: az3Info.floorInfo.navList2_second3,
            icons: az3Info.floorInfo.mapArticle2_second3,
            poi: selectRegion_az3,
            name: '压水堆',
            level: '机密',
            layer: 'az3_3_2f',
            needRemove: true
        },
         '51_1_3F': {
            info: az3Info,
             nav: az3Info.floorInfo.navList2_three1,
            navInfo: az3Info.floorInfo.navList2_three1,
            icons: az3Info.floorInfo.mapArticle2_three1,
            poi: selectRegion_az3,
            name: '压水堆',
            level: '机密',
            layer: 'az3_1_3f',
            needRemove: true
        },
    };

    // 获取当前地图配置
    const config = mapConfigs[type];
    // console.log("mapConfigs", type);
    // if (getQuery('map') === 'daba') {
    //      currMap = '0'
    // }
    // if (getQuery('map') === 'cgxg') {
    //     currMap = '1'
    // }
    // if (getQuery('map') === 'bks') {
    //     currMap = '3'
    // }
    if (!config) {
        toastTips();
        isZj = false;
        return;
    }
    
    // 更新地图状态
    mapScaleInfo = config.info;
    allNavList = config.nav;
    navTypeList = config.navInfo;
    mapIcons = config.icons;
    poiInfo = config.poi;



    
    console.log('currMap', currMap);

    // ★ 机密难度(11)随机事件过滤只针对"主图"大地图：山火/坠机替换 mapIcons 并重算分类 nav。
    // 楼层视图（isFloor）必须跳过——否则 dataFilter 的 arrInfo（分类组数组）会覆盖掉扁平 navList2_ldz_*，
    // 使 changeMapLv 末尾 renderNavTypeList(allNavList) 收到"分类对象"而非 icons 列表，楼层点位列表全空。
    if (!isFloor && Number(currMap) === 1 && Number(currLv) === 1) {
        if ($('.random-act').text().indexOf('山火') > -1) {
            mapIcons = mapArticle5_cgxg;
            console.log('mapArticle5_cgxg');
            
        }
        if ($('.random-act').text().indexOf('坠机') > -1 && $('.random-act').text().indexOf('山火') > -1) {
            mapIcons = mapArticle6_cgxg;
             console.log('mapArticle6_cgxg');
        }
        const { arr, arrInfo } = dataFilter(mapIcons);
        allNavList = arrInfo;
        navTypeList = arrInfo;
    }

    // ★ 追加"鱼类"导航组（自 PC 版迁移）：静态 nav 无鱼入口，按当前地图 icons 聚合 catalog='fish' 条目。
    // 仅烽火主图（isFloor=楼层扁平 nav / isWar=战场静态 navRegion 均不处理）；ensureFishGroup 幂等、无鱼不追加。
    if (!isFloor && !isWar) {
        allNavList = ensureFishGroup(allNavList, mapIcons);
        navTypeList = ensureFishGroup(navTypeList, mapIcons);
        // ★ 鱼类条目注入"全部"组：默认视图走 allNavList[0].typeList，静态 nav 本身无鱼，
        // 不注入则首屏「全部」列表一条鱼都看不到（只有点「鱼类」tab 才出）。恒返回新数组，不污染静态数据。
        allNavList = injectFishIntoAll(allNavList, getFishTypeList(allNavList));
        // 一级 tab 与当前地图鱼类组同步：有鱼补 tab、无鱼摘残留 tab（静态结构切图不重建 tab 条）
        syncFishNavTab();
        console.log('追加鱼类');
    }
    
    
    // 更新按钮视觉状态
    isZj ? $('.btn-random').addClass('open') : $('.btn-random').removeClass('open');
    if (!isFloor) {
        $('.map-floor-change-ctn').removeClass('show');
    }
    // 更新UI

    if (chooseItemLvName.indexOf('夜') > -1) {
        $('.curr-map-name').html(`${config.name} <span class="map-lv"> ( ${chooseItemLvName} )</span>`);
    } else {
        $('.curr-map-name').html(`${config.name} <span class="map-lv"> ( ${config.level} )</span>`);
    }
  
    
    // 切换地图图层
    if (config.needRemove) {
        map.removeLayer(currLayer);
    }
    if (currLayer.name !== config.layer) {
        addLayer(config.layer);
    }
    if (config.needRemove) {
        map.addLayer(currLayer);
    }

    initRegion()
    // map.addLayer(currLayer);
    // 重置标记状态
    typeListInit = false;
    if(outFloor) {
        resetAll('none');
    }

    // 更新按钮状态和可见性
    if (isAll) {
        
        toggleVisible(`${currLeftNav}_all`, currLeftNav);
        $('.btn-choose-all-icon').attr('class', 'img_all_open btn-choose-all-icon');
    } else {
        // if (!isFloor && outFloor) {
        //     toggleVisible(`${currLeftNav}_none`, currLeftNav);
        //     $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon');
        // }

        // if (!isAll) {
        //     toggleVisible(`${currLeftNav}_none`, currLeftNav);
        //     $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon');
        // }
        if(outFloor) {
            toggleVisible(`none`, currLeftNav);
            $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon');
        }

       

        
    }

    // 渲染导航类型列表
    if (!isFloor) {
        // ★ currLeftNav 越界兜底（自 PC 版迁移）：上一张图停在"鱼类"tab 而本图无鱼、或切到组数更少的图时，
        // 退回第 0 组并同步 tab 高亮，避免 navTypeList[currLeftNav] 取到 undefined 崩溃
        if (!navTypeList[currLeftNav]) {
            currLeftNav = '0';
            $('.nav-option-item').removeClass('active');
            $('.nav-option-item-0').addClass('active');
        }
        renderNavTypeList(
            Number(currLeftNav) === 0 ? allNavList[0].typeList : navTypeList[currLeftNav].typeList,
            currLeftNav
        );
    } else {
        renderNavTypeList(allNavList, 0);
    }

    bindOptionEvent();
}


// 战场切换
function changeWarMap(mapName, type) {
    visibleMarker = {}
    mapScaleInfo = window[mapName].info;
    poiInfo =  window[mapName].region;
    console.log('mapName', mapName, type);
    
    if (window.occupy) {
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

    const title = !window.occupy ? window[`${mapName}_${type}`].title : window[`${mapName}_${type}_s`].title
    $('.curr-map-name').html(title)



    typeListInit = false;

    initNav();
    warInit(currWarMap, currWarType);


    bindOptionEvent();
}

// 战场初始化
function warInit (mapName, type, isBorder = false) {
    console.log('window.occupy', window.occupy, mapName, type);
    
    var init;
    init = window.occupy ? window[`${mapName}_${type}_s`].init : window[`${mapName}_${type}`].init
    // if (window.viewChange) {
    //     init = window.occupy ? window[`${mapName}_${type}_s`].init_g : window[`${mapName}_${type}`].init_g
    // } else {
    //     init = window.occupy ? window[`${mapName}_${type}_s`].init_s : window[`${mapName}_${type}`].init_s
    // }
    console.log(init);
    
    if (!window.isViewChange) {
        listIsAll[currLeftNav] = false;
        $('.btn-choose-all-icon').attr('class', 'img_all_close btn-choose-all-icon')
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
            // console.log(111, this.options);
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



    // console.log('cacheMarker', cacheMarker);


    // visibleMarker = []
    // cacheMarker = []

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
    let lineHtml = ''

    // console.log(window[`${currWarMap}`]);

    for (let index = 0; index < window[`${currWarMap}`].info.sector; index++) {
        lineHtml += `
            <div class="war-lv-item war-lv-item-${index} ${window.warLv === index && 'active'}" data-index="${index}"></div>
        `

    }
    $('.war-lv-change-list').html(lineHtml)

    $('.war-lv-item').on('click', (e) => {
        var index = $(e.target).attr('data-index')
        window.warLv = Number(index);
        changeWarMap(currWarMap, currWarType);
        // initNav();
        // bindOptionEvent();
        $('.lv-change-tips').text(`区域${warLvText[window.warLv]}`)
        $('.deploy-swiper').removeClass('show')
        map.flyTo([window[currWarMap].info.sectorInit[window.warLv].initX,  window[currWarMap].info.sectorInit[window.warLv].initY], window[currWarMap].info.sectorInit[window.warLv].initZoom)
    })

    // // console.log('init.border', window[mapName].info);
    // testWarInit(init);
    // return;
    // drawBorderPub('red', window[mapName].info.border, window[mapName].info.border2)
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
            // console.log(element.x, element.y);

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
                // console.log('rotate', currWarMap);

                myIcon = L.divIcon({
                    className: ` map-war-icon`,
                    html: `<div class="map-icon-bg" style="transform: translate3d(-50%, -50%, 0)"><img src="${IMG_PRE}/img/dzc_i/${icon}.png" style="transform:  rotate(${Number(element.rotate) + rotate}deg)"/></div>`,
                    iconSize: [30, 30],			//设置图标大小
                    iconAnchor: [15, 15],		//设置图标偏移
                })
            } else {
                myIcon = L.divIcon({
                    className: ` map-war-icon`,
                    html: `<div class="map-icon-bg"><img src="${IMG_PRE}/img/dzc_i/${icon}.png"/></div>`,
                    iconSize: [30, 30],			//设置图标大小
                    iconAnchor: [15, 15],		//设置图标偏移
                })
            }
            myIcon.name = element.name;
            myIcon.icon = icon;
            visibleMarker[getMarkerFilterKey(element)] = true;
            $(`.nav-list-nav${icon.substring(1)}`).addClass('active')
            if (element['激活条件']) {
                var popupHtml =`
                    <div class="name">${element?.sub_name ? element.sub_name : element.name}</div>
                     <div class="open-text war ${(!element['激活条件'] || element['激活条件'] === '' || element['激活条件'] === '-') ? 'hide': ''}">激活条件：<span>${element['激活条件']}</span></div>
                     `
            } else {
                var popupHtml = `
                <div class="name">${element?.sub_name ? element.sub_name : element.name}</div>
            `;
            }
           
            // console.log('pos', pos);
            
            // popupHtml += '</div>';
            cacheMarker.push(L.marker([pos.y, pos.x], {icon: myIcon}).bindPopup(popupHtml).addTo(map).on({
                click: function () {
                    currClickMarker?.setIcon(currClickMarker?.myIcon)
                    this.isClick = true;
                    this.myIcon = myIcon;
                    // console.log(this);
                    let rotate = currWarMap === 'qhz' ? 90 : 180
                    this.openPopup();
                    this.setIcon( L.divIcon({
                        className: ` map-war-icon click`,
                        html: `<div class="map-icon-bg" style="${element?.rotate ? `transform: translate3d(-50%, -50%, 0) rotate(${Number(element?.rotate) + rotate}deg)` : ''}"><img src="${IMG_PRE}/img/dzc_i/${icon}.png"/></div>`,
                        iconSize: [30, 30],			//设置图标大小
                        iconAnchor: [15, 15],		//设置图标偏移
                    }));
                    currClickMarker = this;
                    $(this.getElement()).addClass('click')
                    
                    console.log(this.myIcon);
                    
                    if (this.myIcon.name.indexOf('基地') > -1 || (this.myIcon.name.indexOf('据点') > -1 && window.occupy)) {
                        console.log('initWarSwiper', this.myIcon.name, element);
                        initWarSwiper(this.myIcon.name, element);
                    }
                    
                    // this?.remove()
                }
            }))
            
            
           
        }

       
    }

    
}

function testWarInit (list) {
    let lineHtmlg = ''
    let lineHtmlf = ''
    let lineHtmlz = ''
    let lineHtml = ''
    for (let index_f = 0; index_f < list.length; index_f++) {
        const element_f = list[index_f];
        // console.log(111, element_f);
        
        for (let index = 0; index < element_f.typeList.length; index++) {
            const element = element_f.typeList[index];
            // console.log(222, element);
            
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
                // console.log(element.x, element.y);
    
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
                    // console.log('rotate', currWarMap);
    
                    myIcon = L.divIcon({
                        className: ` map-war-icon`,
                        html: `<div class="map-icon-bg" style="transform: translate3d(-50%, -50%, 0)"><img src="${IMG_PRE}/img/dzc_i/${icon}.png" style="transform:  rotate(${Number(element.rotate) + rotate}deg)"/></div>`,
                        iconSize: [30, 30],			//设置图标大小
                        iconAnchor: [15, 15],		//设置图标偏移
                    })
                } else {
                    myIcon = L.divIcon({
                        className: ` map-war-icon`,
                        html: `<div class="map-icon-bg"><img src="${IMG_PRE}/img/dzc_i/${icon}.png"/></div>`,
                        iconSize: [30, 30],			//设置图标大小
                        iconAnchor: [15, 15],		//设置图标偏移
                    })
                }
                myIcon.name = element.name;
                myIcon.icon = icon;
                visibleMarker[getMarkerFilterKey(element)] = true;
                $(`.nav-list-nav${icon.substring(1)}`).addClass('active')
                if (element['激活条件']) {
                    var popupHtml =`
                        <div class="name">${element?.sub_name ? element.sub_name : element.name}</div>
                         <div class="open-text war ${(!element['激活条件'] || element['激活条件'] === '' || element['激活条件'] === '-') ? 'hide': ''}">激活条件：<span>${element['激活条件']}</span></div>
                         `
                } else {
                    var popupHtml = `
                    <div class="name">${ element?.sub_name ? element.sub_name : element.name}</div>
                `;
                }
               
                // console.log('pos', pos);
                
                // popupHtml += '</div>';
                cacheMarker.push(L.marker([pos.y, pos.x], {icon: myIcon}).bindPopup(popupHtml).addTo(map).on({
                    click: function () {
                        currClickMarker?.setIcon(currClickMarker?.myIcon)
                        this.isClick = true;
                        this.myIcon = myIcon;
                        // console.log(this);
                        let rotate = currWarMap === 'qhz' ? 90 : 180
                        this.openPopup();
                        this.setIcon( L.divIcon({
                            className: `${isWar ? 'map-war-icon' : 'map-icon'} click`,
                            html: `<div class="map-icon-bg" style="${element?.rotate ? `transform: translate3d(-50%, -50%, 0) rotate(${Number(element?.rotate) + rotate}deg)` : ''}"><img src="${IMG_PRE}/img/dzc_i/${icon}.png"/></div>`,
                            iconSize: [30, 30],			//设置图标大小
                            iconAnchor: [15, 15],		//设置图标偏移
                        }));
                        currClickMarker = this;
                        $(this.getElement()).addClass('click')
                        
                        // console.log(this.myIcon);
                        
                        if (this.myIcon.name.indexOf('基地') > -1 || (this.myIcon.name.indexOf('据点') > -1 && window.occupy)) {
                            initWarSwiper(this.myIcon.name, element);
                        }
                        
                        // this?.remove()
                    }
                }))
                
                
               
            }
    
           
        }
        
    }

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
    // 如果存在，则销毁
    if (window.warSwiper) {
        try {
            // 兼容不同版本的Swiper
            if (typeof window.warSwiper.destroy === 'function') {
                window.warSwiper.destroy(true, true); // 对于新版本可能需要多个参数
            } else if (typeof window.warSwiper.destroy$ === 'function') {
                window.warSwiper.destroy$(); // 某些版本可能使用这个方法
            } else {
                // 如果没有destroy方法，尝试手动清理
                window.warSwiper = null;
            }
        } catch (error) {
            // 出错时确保swiper被重置
            // console.error('销毁Swiper出错:', error);
            window.warSwiper = null;
        }
    }


    let html = '';
    // console.log(data);
    let list = window.occupy ? window[currWarMap + '_' + currWarType + '_s'].deploy : window[currWarMap + '_' + currWarType].deploy[window.warLv]
    console.log('deploy', name, list);
    // if (!list) return;
    let length = 0;
    
   
    $.each(list, function(index) {
        console.log('this', this['阵营'], data['备注']);
        
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
        } else if (this['备注'] === data['自定义区域'] || this['阵营'] === data['备注'] && window.occupy) {
            console.log('有', this['备注'], data['自定义区域']);
            
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
        // // console.log(this['备注'], data['自定义区域'], this['备注'] === data['自定义区域']);
        
        

        
    })

    if (length < 7) {
        $('.btn-swiper-prev').css('display', 'none')
        $('.btn-swiper-next').css('display', 'none')
    } else {
        $('.btn-swiper-prev').css('display', 'block')
        $('.btn-swiper-next').css('display', 'block')
    }
    
 
    $('.swiper-wrapper').html(html)

    // 创建Swiper实例
    try {
        window.warSwiper = new Swiper('.swiper-container', {
            slidesPerView: 'auto',
            // 添加其他必要的选项，确保兼容性
            observer: true, // 启用DOM变化监听
            observeParents: true,
        });

        // console.log('initSwiper');
    } catch (error) {
        // console.error('创建Swiper失败:', error);
        // 确保即使创建失败也能显示内容
        console.log('有',html );
        
        if (html !== '') {
            $('.deploy-swiper').addClass('show');
        }
        return;
    }
    
    if (html !== '') {
        $('.deploy-swiper').addClass('show')
    } else {
        $('.deploy-swiper').removeClass('show')
    }
}
window.addEventListener('load', () => {
    init();
    // console.log(document.querySelector('.left-nav-ctn'));
});

/**
 * 节流函数 - 限制函数在指定时间内只执行一次
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} - 返回节流后的函数
 */
function throttle(fn, delay = 200) {
    let lastCall = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            return fn.apply(this, args);
        }
    };
}

/**
 * 判断用户是否滑动到指定点位附近
 * @param {number} targetX - 目标点位的x坐标
 * @param {number} targetY - 目标点位的y坐标
 * @param {number} threshold - 判定为"附近"的距离阈值
 * @returns {boolean} - 如果用户在点位附近则返回true，否则返回false
 */
function isNearPoint(targetX, targetY, threshold = 100) {
    const center = map.getCenter();
    const currentX = center.lat;
    const currentY = center.lng;
    
    const distance = Math.sqrt(
        Math.pow(currentX - targetX, 2) + 
        Math.pow(currentY - targetY, 2)
    );
    
    return distance <= threshold;
}

// 检查是否在任何一个点位附近
function checkNearbyPoints() {
    const center = map.getCenter();
    const currentX = center.lat;
    const currentY = center.lng;
    
    // console.log(currentX, currentY);
    
    let nearbyPoints = [];
    // console.log(pointsOfInterest[currMap]);
    var point = pointsOfInterest[currMap]
    if (!point) return;
    
    // 检查point是否为数组
    if (Array.isArray(point)) {
        // 如果是数组，遍历每个点位进行检测
        point.forEach(singlePoint => {
            var pos = getMapPos(singlePoint.x, singlePoint.y);
            
            const distance = Math.sqrt(
                Math.pow(currentX - pos.y, 2) + 
                Math.pow(currentY - pos.x, 2)
            );
            
            if (distance <= singlePoint.threshold) {
                nearbyPoints.push({...singlePoint, distance});
            }
        });
    } else {
        // 如果是单个对象，按原来的逻辑处理
        var pos = getMapPos(point.x, point.y);
        // console.log(pos.x, pos.y);
        
        const distance = Math.sqrt(
            Math.pow(currentX - pos.y, 2) + 
            Math.pow(currentY - pos.x, 2)
        );
        
        if (distance <= point.threshold) {
            nearbyPoints.push({...point, distance});
        }
    }
    
    // 如果有多个点符合条件，可以返回最近的点
    if (nearbyPoints.length > 0) {
        console.log('多个点', nearbyPoints);
        
        nearbyPoints.sort((a, b) => a.distance - b.distance);
        return nearbyPoints[0];
    }
    
    return null; // 不在任何点位附近
}


// 创建节流版本的检查函数
// const throttledCheckNearbyPoints = throttle(function() {
//     const nearbyPoint = checkNearbyPoints();
//     checkMoveFloor(nearbyPoint);
// }, 500); // 300毫秒的节流时间，可根据需要调整

function checkMoveFloor (nearbyPoint) {
    console.log('checkMoveFloor', nearbyPoint);
    
    if (isFloor) return;
    if (nearbyPoint && !isMoveFloor) {
        // console.log(`用户已进入"${nearbyPoint.name}"区域！距离: ${nearbyPoint.distance.toFixed(2)}`);
        // 在这里执行你需要的操作
        isMoveFloor = true;
        setCurrRegion(nearbyPoint.name)
        currFloorRegion = normalizeFloorRegionName(currRegion);
        initFloor();
        // isFloor = true;
        // $('#MapContainer').addClass('floor')
        $('.not-event').addClass('act');
        $('.map-floor-change-ctn').addClass('show');
        $('.map-floor .btn-floor').html(`<p>请选择楼层</p>`)
        if (Number(currMap) === 4 && !isFloor) {
            $('.floor-tips').css('display', 'none');
        } else {
            $('.floor-tips').css('display', 'block');
            $('.floor-tips').html(`<p> 您正在查看<span class="span1">${getSafeRegionName()}</span></p>`)
        }
        console.log(111111, Number(currMap) === 4, isFloor);
        
        $('.curr-reigon').text(`${nearbyPoint.name}`)
        // $('.map-floor').css('display', 'block');
    } else if (!nearbyPoint && isMoveFloor) {
        isMoveFloor = false;
        isFloor = false;
        currFloorIndex = -1;
        currFloorRegion = '';
        $('.curr-reigon').text(`地图快速定位`)
        
        floorList.html('')
        floorList.append(`<div class="floor-item not-event">大地图模式</div>`)
        $('.map-floor .btn-floor').html(`<p>查看地图分层</p>`)
        $('.map-floor-change-ctn').removeClass('show');
        // $('.map-floor').css('display', 'none');
    }
}

// 进入随机事件方法
function enterRandomEvent () {
    isFloor && resetFloor();
    // 确定目标地图层级
    let targetMapLv;
    let randomText = $('.random-act').text()
    if (randomText.indexOf('坠机') > -1 || randomText.indexOf('断桥') > -1) {
        // 随机模式下的地图层级
        targetMapLv = currMap + currLv + '_s';
    } else {
        // 常规模式下的地图层级
        targetMapLv = currMap + currLv;
    }
    
    
    // 切换地图层级
    changeMapLv(targetMapLv);
    // 重置标记和可见性
    resetAll('none');
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
      {
        name: "一件衣服"
      },
    //   {
    //     name: "一件衣服"
    //   },
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
            titleType: "wzd",
            title: "物资点",
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
        },
        {
            titleType: 'yl',
            title: '鱼类',
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
                catalog: element.catalog,   // ★ 保留 catalog：机密难度经 dataFilter 重建 nav 时，鱼类不丢分类（否则被归入资源点）
            })
            
        } else {
            // 存在则更新图标 / 补 catalog
            const existingItem = arr.find(item => item.name === element.name);
            existingItem.icon = 'nav_' + element.icon;
            if (element.catalog) existingItem.catalog = element.catalog;
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
        

        if (element.catalog === 'fish') {
            arrInfo[5]['typeList'].push(element)
        } else if (element.name === '出生点') {
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
