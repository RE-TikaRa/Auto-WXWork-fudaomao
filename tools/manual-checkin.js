// ============================================================================
// 手动签到脚本
// ============================================================================
//
// 【脚本说明】
// 这是一个一次性执行的手动签到脚本，用于立即执行签到操作。
// 运行后会自动完成所有今日活动的签到，然后退出。
//
// 【与 main.js 的区别】
// - main.js: 常驻服务，监听通知自动触发，有备用定时
// - 本脚本: 一次性执行，立即签到，执行完毕后退出
//
// 【使用场景】
// 1. 测试签到流程是否正常工作
// 2. 错过自动签到时间后手动补签
// 3. 调试和验证签到逻辑
//
// 【运行方式】
// 在 AutoJs6 中直接运行此脚本即可
// ============================================================================

"auto";
auto.waitFor();

// 验证无障碍服务是否正常工作
try {
    selector().exists();
    console.log("[服务] 无障碍服务正常");
} catch (e) {
    toast("无障碍服务异常，请重新开启");
    console.error("[服务] 无障碍服务异常: " + e);
    exit();
}

// 关闭上次运行遗留的弹窗（仅限本脚本的 alert 弹窗）
function dismissOwnDialogs() {
    var titles = ["签到完成", "签到失败", "签到结果"];
    var dismissed = 0;
    for (var round = 0; round < 5; round++) {
        var found = false;
        try {
            var pkg = currentPackage();
            if (pkg !== "org.autojs.autojs6") break;
            
            for (var i = 0; i < titles.length; i++) {
                if (text(titles[i]).exists()) {
                    var okBtn = text("确定").findOnce();
                    if (okBtn && okBtn.clickable()) {
                        console.log(">>> 关闭遗留弹窗: " + titles[i]);
                        okBtn.click();
                        sleep(500);
                        dismissed++;
                        found = true;
                    }
                    break;
                }
            }
        } catch (e) {}
        if (!found) break;
    }
    return dismissed;
}
dismissOwnDialogs();

// ============================================================================
// 配置
// ============================================================================
//
// 【配置说明】
// 手动签到只需要基本配置，不需要通知触发和备用定时相关的配置。
// ============================================================================

var CONFIG = {
    // 企业微信包名
    packageName: "com.tencent.wework",
    // 范围外签到时填写的原因
    reasonText: "离校",
    // 辅导猫入口文本
    entryText: "辅导猫"
};

// ============================================================================
// 运行时常量
// ============================================================================

// 轮询间隔（毫秒）- 等待元素时的检查频率
var POLL_INTERVAL = 200;

// 单次等待超时（毫秒）- 等待单个元素的最长时间
var MAX_WAIT = 10000;

// 动画延迟（毫秒）- 点击前等待动画完成
var ANIM_DELAY = 500;

// 全局超时（毫秒）- 整个流程的最长执行时间（3分钟）
var GLOBAL_TIMEOUT = 180000;

// 全局开始时间 - 用于计算全局超时
var globalStart = Date.now();

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 调试：分析当前页面关键信息
 */
function debugPage(tag) {
    console.log("\n========== [DEBUG] " + tag + " ==========");
    
    try {
        console.log("包名: " + currentPackage());
        console.log("Activity: " + currentActivity());
    } catch (e) {
        console.log("包名/Activity: (远程模式不可用)");
    }
    
    // 查找关键文本
    var keywords = ["已签到", "未签到", "签到", "范围外签到", "为何不能签到", "继续签到", "去拍照", "完成签到"];
    console.log("\n[关键词检测]");
    keywords.forEach(function(kw) {
        var found = textContains(kw).find();
        if (found.length > 0) {
            console.log("  ✓ \"" + kw + "\" 找到 " + found.length + " 个");
            found.forEach(function(w, i) {
                var b = w.bounds();
                console.log("    [" + i + "] center:(" + b.centerX() + "," + b.centerY() + ") clickable:" + w.clickable() + " text:\"" + w.text() + "\"");
            });
        }
    });
    
    // 查找所有可点击控件
    console.log("\n[可点击控件 Y<" + Math.floor(device.height * 0.7) + "]");
    var clickables = selector().clickable(true).find();
    var count = 0;
    clickables.forEach(function(w) {
        var b = w.bounds();
        if (b.centerY() < device.height * 0.7 && b.centerY() > 300) {
            count++;
            var t = w.text() || w.desc() || "(无文本)";
            console.log("  #" + count + " \"" + t + "\" center:(" + b.centerX() + "," + b.centerY() + ") class:" + w.className());
        }
    });
    console.log("========== [/DEBUG] ==========\n");
}

/**
 * 唤醒屏幕并解锁
 * @returns {boolean} 成功返回 true，失败返回 false
 */
function wakeUp() {
    if (device.isScreenOn()) return true;
    console.log(">>> 唤醒屏幕...");
    device.wakeUp();
    sleep(500);
    if (!device.isScreenOn()) {
        console.log(">>> 唤醒失败");
        return false;
    }
    console.log(">>> 上滑...");
    swipe(device.width / 2, device.height * 0.8, device.width / 2, device.height * 0.3, 300);
    sleep(500);
    return true;
}

/**
 * 等待某个条件满足（轮询模式）
 * @param {Function} finder - 查找函数
 * @param {number} [timeout=MAX_WAIT] - 超时时间
 * @returns {*} finder 返回的结果，超时返回 null
 */
function waitFor(finder, timeout) {
    timeout = timeout || MAX_WAIT;
    var start = Date.now();
    while (Date.now() - start < timeout) {
        // 检查全局超时
        if (Date.now() - globalStart > GLOBAL_TIMEOUT) {
            console.error(">>> 全局超时");
            return null;
        }
        var result = finder();
        if (result) return result;
        sleep(POLL_INTERVAL);
    }
    return null;
}

/**
 * 智能点击控件（三级回退策略）
 * @param {UiObject} widget - 要点击的控件
 * @returns {boolean} 点击是否成功
 */
function smartClick(widget) {
    if (!widget) return false;
    if (widget.clickable()) return widget.click();
    var p = widget.parent();
    if (p && p.clickable()) return p.click();
    var b = widget.bounds();
    return click(b.centerX(), b.centerY());
}

// ============================================================================
// 签到核心逻辑
// ============================================================================
//
// 【签到流程状态机】
// 进入活动详情页后，可能遇到以下状态：
//
//   ┌─────────────────────────────────────────────────────────────────────┐
//   │                        活动详情页                                    │
//   ├─────────────────────────────────────────────────────────────────────┤
//   │                                                                     │
//   │  状态1: 已签到                                                       │
//   │  └─ 页面显示"已签到"文本 → 直接返回，无需操作                         │
//   │                                                                     │
//   │  状态2: 范围外签到                                                   │
//   │  └─ 显示"范围外签到"按钮 → 点击后进入拍照流程                         │
//   │                                                                     │
//   │  状态3: 正常签到                                                     │
//   │  └─ 显示"签到"按钮 → 点击后可能直接成功或进入拍照流程                  │
//   │                                                                     │
//   └─────────────────────────────────────────────────────────────────────┘
//
// 【拍照流程】
//   点击签到 → [继续签到弹窗] → 去拍照 → [权限弹窗] → 拍照 → 使用照片
//            → [填写原因] → 完成签到
//
// 【按钮识别策略】
// 页面上可能有多个"签到"文本（如底部导航栏），需要通过坐标过滤：
// - Y 坐标 > 300px：排除顶部状态栏区域
// - Y 坐标 < 屏幕高度 * 0.7：排除底部导航栏区域
// - 优先匹配"范围外签到"（更精确）
// ============================================================================

/**
 * 执行单个活动的签到操作
 * 
 * 【函数职责】
 * 在活动详情页内完成签到操作，处理各种可能的页面状态和弹窗。
 * 
 * 【返回值说明】
 * - "already_signed": 活动已签到，无需操作
 * - "no_button": 未找到签到按钮（可能页面加载失败）
 * - "success": 签到成功
 * - "unknown": 签到结果不确定（未检测到成功标志）
 * - "error": 签到过程中发生异常（由调用方 catch）
 * 
 * @returns {string} 签到结果状态码
 */
function doCheckin() {
    // 调试：进入活动详情页时分析
    debugPage("进入活动详情页");
    
    // ========================================================================
    // 第一步：等待页面加载，查找签到按钮
    // ========================================================================
    // 只查找签到按钮，不在轮询中检测过期状态
    // 过期检测放到超时后，避免页面加载过程中误判
    // ========================================================================
    var pageState = waitFor(function() {
        // 优先查找"范围外签到"按钮（页面中央的大圆形橙色按钮）
        var btn = text("范围外签到").findOnce();
        if (btn) {
            var b = btn.bounds();
            var cls = btn.className();
            if (cls.indexOf("WebView") < 0 && b.centerY() < device.height * 0.8) {
                return { btn: btn };
            }
        }
        
        // 查找普通"签到"按钮（页面中央的大圆形按钮）
        var candidates = text("签到").find();
        for (var i = 0; i < candidates.length; i++) {
            var cls = candidates[i].className();
            if (cls.indexOf("WebView") >= 0) continue;
            var b = candidates[i].bounds();
            if (b.centerY() < device.height * 0.7 && b.centerY() > 300) {
                return { btn: candidates[i] };
            }
        }
        
        // 检查是否已签到（这个可以提前返回）
        if (textContains("已签到").exists()) return "already_signed";
        
        return null;  // 继续轮询
    }, MAX_WAIT);
    
    console.log(">>> pageState = " + JSON.stringify(pageState));
    
    // ========================================================================
    // 第二步：处理检测结果
    // ========================================================================
    
    if (pageState === "already_signed") {
        console.log(">>> 已签到，跳过");
        return "already_signed";
    }
    
    // 未找到签到按钮时，检查是否过期
    if (!pageState || !pageState.btn) {
        if (text("已结束").exists()) {
            console.log(">>> 活动已结束");
            return "missed";
        }
        // 显示"未签到"但没有签到按钮 = 已过期未签到
        if (textContains("未签到").exists()) {
            console.log(">>> 已过期未签到（无签到按钮）");
            return "missed";
        }
        console.log(">>> 未找到签到按钮");
        return "no_button";
    }
    
    // ========================================================================
    // 第三步：点击签到按钮
    // ========================================================================
    // 等待动画完成后再点击，避免点击到错误位置
    // ========================================================================
    sleep(ANIM_DELAY);
    console.log(">>> 点击: " + pageState.btn.text());
    smartClick(pageState.btn);
    
    // 调试：点击签到按钮后
    sleep(1000);
    debugPage("点击签到按钮后");
    
    // ========================================================================
    // 第四步：处理"继续签到"弹窗（可选）
    // ========================================================================
    // 某些情况下点击签到后会弹出确认框，需要再次点击"继续签到"
    // 使用较短超时（5秒），因为这个弹窗不一定出现
    // ========================================================================
    var continueBtn = waitFor(function() { return text("继续签到").findOnce(); }, 5000);
    if (continueBtn) {
        sleep(ANIM_DELAY);
        console.log(">>> 点击: 继续签到");
        smartClick(continueBtn);
    }
    
    // ========================================================================
    // 第 4.5 步：检测签到时间是否已过期
    // ========================================================================
    // 注意："为何不能签到？"是页面上的固定链接，不能作为过期判断依据
    // ========================================================================
    
    // 如果显示"未签到"，查找底部可点击的签到按钮
    if (textContains("未签到").exists()) {
        // 查找底部区域的签到按钮（80% < Y < 95%，排除导航栏）
        var bottomSignBtn = null;
        var signBtns = text("签到").find();
        for (var i = 0; i < signBtns.length; i++) {
            var b = signBtns[i].bounds();
            var cls = signBtns[i].className();
            // 排除 WebView 容器和底部导航栏（Y > 95%）
            if (cls.indexOf("WebView") >= 0) continue;
            if (b.centerY() > device.height * 0.8 && b.centerY() < device.height * 0.95) {
                bottomSignBtn = signBtns[i];
                break;
            }
        }
        
        if (!bottomSignBtn) {
            var outRangeBtn = text("范围外签到").findOnce();
            if (outRangeBtn) {
                var b = outRangeBtn.bounds();
                var cls = outRangeBtn.className();
                if (cls.indexOf("WebView") < 0 && b.centerY() > device.height * 0.8 && b.centerY() < device.height * 0.95) {
                    bottomSignBtn = outRangeBtn;
                }
            }
        }
        
        if (!bottomSignBtn) {
            console.log(">>> 显示未签到但无签到按钮，时间已过期");
            return "missed";
        }
        
        console.log(">>> 点击底部签到按钮: Y=" + bottomSignBtn.bounds().centerY());
        sleep(ANIM_DELAY);
        click(bottomSignBtn.bounds().centerX(), bottomSignBtn.bounds().centerY());
    }
    
    // ========================================================================
    // 第五步：拍照流程（范围外签到的核心流程）
    // ========================================================================
    // 范围外签到需要拍照证明，流程如下：
    // 1. 点击"去拍照"按钮
    // 2. 处理相机权限弹窗（首次使用时）
    // 3. 点击快门按钮拍照
    // 4. 点击"使用照片"确认
    // 5. 填写签到原因（如"离校"）
    // 6. 点击"完成签到"
    // ========================================================================
    var photoBtn = waitFor(function() { return text("去拍照").findOnce(); }, 5000);
    if (photoBtn) {
        sleep(ANIM_DELAY);
        console.log(">>> 点击: 去拍照");
        smartClick(photoBtn);
        
        // --------------------------------------------------------------------
        // 5.1 处理相机权限弹窗
        // --------------------------------------------------------------------
        // 首次使用相机时，系统会弹出权限请求
        // 不同 Android 版本/厂商的按钮文本可能不同：
        // - "允许"：标准 Android
        // - "始终允许"：部分厂商 ROM
        // - "仅在使用中允许"：Android 10+ 的新选项
        // 使用较短超时（2秒），因为权限弹窗只在首次出现
        // --------------------------------------------------------------------
        var permissionBtn = waitFor(function() {
            return text("允许").findOnce() || text("始终允许").findOnce() || textContains("仅在使用").findOnce();
        }, 2000);
        if (permissionBtn) {
            console.log(">>> 处理权限弹窗");
            smartClick(permissionBtn);
            sleep(500);  // 等待权限弹窗关闭
        }
        
        // --------------------------------------------------------------------
        // 5.2 点击快门按钮
        // --------------------------------------------------------------------
        // 快门按钮识别策略（基于相对尺寸，适配不同分辨率）：
        // - 类型：ImageView（图片控件）
        // - 宽度：屏幕宽度的 10%-20%（典型快门按钮大小）
        // - 位置：水平居中（距离屏幕中心 < 50px）
        // 
        // 【为什么使用相对尺寸】
        // 不同手机分辨率差异很大（720p ~ 4K），使用绝对像素值会导致
        // 在某些设备上无法识别。相对尺寸（屏幕宽度的百分比）更通用。
        // --------------------------------------------------------------------
        var shutterBtn = waitFor(function() {
            var minSize = device.width * 0.1;   // 最小宽度：屏幕宽度的 10%
            var maxSize = device.width * 0.2;   // 最大宽度：屏幕宽度的 20%
            return className("android.widget.ImageView").filter(function(w) {
                var b = w.bounds();
                // 三个条件同时满足：
                // 1. 宽度在合理范围内
                // 2. 宽度在合理范围内（上限）
                // 3. 水平位置接近屏幕中心
                return b.width() >= minSize && b.width() <= maxSize && Math.abs(b.centerX() - device.width / 2) < 50;
            }).findOnce();
        }, 5000);
        if (shutterBtn) {
            sleep(ANIM_DELAY);
            var b = shutterBtn.bounds();
            console.log(">>> 点击快门: (" + b.centerX() + ", " + b.centerY() + ")");
            // 使用坐标点击而非 widget.click()，因为快门按钮可能不可点击
            click(b.centerX(), b.centerY());
        }
        
        // --------------------------------------------------------------------
        // 5.3 确认使用照片
        // --------------------------------------------------------------------
        // 拍照后会显示预览，需要点击"使用照片"确认
        // --------------------------------------------------------------------
        var usePhotoBtn = waitFor(function() { return text("使用照片").findOnce(); }, 5000);
        if (usePhotoBtn) {
            sleep(ANIM_DELAY);
            console.log(">>> 点击: 使用照片");
            smartClick(usePhotoBtn);
        }
        
        // --------------------------------------------------------------------
        // 5.4 填写签到原因
        // --------------------------------------------------------------------
        // 范围外签到需要填写原因说明
        // 流程：点击输入框 → 输入文本 → 收起键盘
        // 
        // 【重要】必须先收起键盘再点击提交按钮
        // 否则键盘可能遮挡"完成签到"按钮，导致点击失败
        // --------------------------------------------------------------------
        var inputBox = waitFor(function() { return className("EditText").findOnce(); }, 5000);
        if (inputBox) {
            sleep(ANIM_DELAY);
            console.log(">>> 填写: " + CONFIG.reasonText);
            smartClick(inputBox);  // 聚焦输入框
            sleep(300);            // 等待键盘弹出
            inputBox.setText(CONFIG.reasonText);  // 设置文本
            sleep(300);            // 等待文本输入完成
            back();                // 收起键盘（关键步骤！）
        }
        
        // --------------------------------------------------------------------
        // 5.5 点击"完成签到"按钮
        // --------------------------------------------------------------------
        // 使用 textContains 而非 text，因为按钮文本可能包含空格
        // 例如：" 完成签到" 或 "完成签到 "
        // 使用坐标点击确保可靠性
        // --------------------------------------------------------------------
        var finalBtn = waitFor(function() { return textContains("完成签到").findOnce(); }, 3000);
        if (finalBtn) {
            sleep(ANIM_DELAY);
            var b = finalBtn.bounds();
            console.log(">>> 点击完成签到: (" + b.centerX() + ", " + b.centerY() + ")");
            click(b.centerX(), b.centerY());
        }
    }
    
    // ========================================================================
    // 第六步：验证签到结果
    // ========================================================================
    // 检查页面是否显示"已签到"文本，作为签到成功的标志
    // 使用较短超时（5秒），因为签到结果应该很快显示
    // ========================================================================
    if (waitFor(function() { return textContains("已签到").exists() ? true : null; }, 5000)) {
        console.log(">>> 签到成功！");
        return "success";
    }
    
    // 未检测到成功标志，返回 unknown（可能成功也可能失败）
    return "unknown";
}

// ============================================================================
// 主流程
// ============================================================================
//
// 【执行步骤概览】
// 1. 唤醒屏幕并解锁
// 2. 杀掉企业微信后台（确保干净启动）
// 3. 启动企业微信
// 4. 进入辅导猫页面
// 5. 查找今日活动
// 6. 遍历每个活动执行签到
// 7. 输出结果汇总
//
// 【为什么要杀掉后台】
// 企业微信可能停留在某个子页面，直接启动可能无法进入工作台。
// 杀掉后台后重新启动，可以确保从主页面开始，流程更可控。
//
// 【活动遍历策略】
// 使用 while 循环每次处理第一个活动，而非 for 循环遍历索引。
// 原因：签到成功后活动可能从列表中消失或位置变化，
// 使用索引遍历会导致跳过活动或数组越界。
// ============================================================================

console.log("===== 手动签到 =====");

// ============================================================================
// 步骤 1：唤醒屏幕
// ============================================================================
// 如果屏幕关闭，需要先唤醒并解锁
// 唤醒失败（如设备不支持）则无法继续
// ============================================================================
if (!wakeUp()) {
    console.error(">>> 唤醒失败，退出");
    exit();
}

// ============================================================================
// 步骤 2-3：杀掉企业微信后台并启动（最多重试3次）
// ============================================================================
var MAX_LAUNCH_RETRIES = 3;
var appLaunched = false;

for (var retry = 1; retry <= MAX_LAUNCH_RETRIES; retry++) {
    console.log(">>> 尝试启动企业微信 (" + retry + "/" + MAX_LAUNCH_RETRIES + ")");
    
    console.log(">>> 杀掉企业微信后台...");
    app.openAppSetting(CONFIG.packageName);
    var forceStopBtn = waitFor(function() {
        return text("强行停止").findOnce() || text("结束运行").findOnce();
    }, 3000);
    
    if (forceStopBtn) {
        console.log(">>> 找到停止按钮: " + forceStopBtn.text() + ", clickable=" + forceStopBtn.clickable());
        if (forceStopBtn.clickable()) {
            forceStopBtn.click();
            sleep(300);
            var confirmBtn = waitFor(function() { return text("确定").findOnce(); }, 2000);
            if (confirmBtn) {
                console.log(">>> 点击确定");
                confirmBtn.click();
                sleep(500);
            }
        } else {
            console.log(">>> 停止按钮不可点击（应用可能已停止）");
        }
    } else {
        console.log(">>> 未找到停止按钮");
    }
    
    home();
    sleep(500);
    
    console.log(">>> 启动企业微信...");
    app.launch(CONFIG.packageName);
    sleep(3000);
    
    appLaunched = waitFor(function() { 
        return textContains(CONFIG.entryText).exists() || textContains("工作台").exists(); 
    }, 30000);
    
    if (appLaunched) {
        console.log(">>> 企业微信启动成功");
        
        // 确保回到消息页（点击底部"消息"tab）
        var msgTab = text("消息").boundsInside(0, device.height * 0.9, device.width, device.height).findOnce();
        if (msgTab) {
            console.log(">>> 点击消息tab确保在首页");
            click(msgTab.bounds().centerX(), msgTab.bounds().centerY());
            sleep(500);
        }
        break;
    }
    
    console.warn(">>> 启动超时，准备重试...");
}

if (!appLaunched) {
    console.error(">>> 企业微信启动失败，已重试 " + MAX_LAUNCH_RETRIES + " 次");
    debugPage("企业微信启动失败");
    toast("企业微信启动失败");
    alert("签到失败", "企业微信启动超时，请检查应用状态");
    exit();
}

// ============================================================================
// 步骤 4：进入辅导猫（带重试）
// ============================================================================
var MAX_PAGE_RETRIES = 2;
var activities = null;
var today = new Date();
var todayStr = (today.getMonth() + 1).toString().padStart(2, '0') + "月" + 
               today.getDate().toString().padStart(2, '0') + "日";
console.log(">>> 今天: " + todayStr);

for (var pageRetry = 1; pageRetry <= MAX_PAGE_RETRIES; pageRetry++) {
    var fudaomao = waitFor(function() { return textContains(CONFIG.entryText).findOnce(); }, 10000);
    if (!fudaomao) {
        console.error(">>> 未找到辅导猫入口，退出");
        debugPage("未找到辅导猫入口");
        exit();
    }
    console.log(">>> 点击: 辅导猫 (尝试 " + pageRetry + "/" + MAX_PAGE_RETRIES + ")");
    smartClick(fudaomao);
    
    sleep(2000);
    activities = textContains(todayStr).find();
    console.log(">>> 找到 " + activities.length + " 个今日活动");
    
    if (activities.length > 0) break;
    
    if (pageRetry < MAX_PAGE_RETRIES) {
        console.log(">>> 页面加载失败，返回重试...");
        back();
        sleep(1000);
    }
}

if (!activities || activities.length === 0) {
    console.log(">>> 没有今日活动，退出");
    debugPage("没有今日活动");
    toast("没有今日活动");
    alert("签到完成", "今日没有需要签到的活动");
    exit();
}

// ============================================================================
// 步骤 5：预扫描生成待签到列表（根据截止时间过滤已过期活动）
// ============================================================================
var todoList = [];
var now = new Date();
console.log(">>> 当前时间: " + now.toLocaleString());

for (var i = 0; i < activities.length; i++) {
    var act = activities[i];
    var fullText = act.text() || "";
    var b = act.bounds();
    
    // 解析活动名称（第一行）和截止时间
    var lines = fullText.split("\n");
    var activityName = lines[0] || "";
    
    // 解析截止时间（格式：签到截止时间：2026年02月21日 22:00）
    var deadlineMatch = fullText.match(/签到截止时间[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/);
    var isExpired = false;
    var deadlineStr = "";
    
    if (deadlineMatch) {
        var year = parseInt(deadlineMatch[1]);
        var month = parseInt(deadlineMatch[2]) - 1;
        var day = parseInt(deadlineMatch[3]);
        var hour = parseInt(deadlineMatch[4]);
        var minute = parseInt(deadlineMatch[5]);
        var deadline = new Date(year, month, day, hour, minute);
        deadlineStr = month + 1 + "/" + day + " " + hour + ":" + (minute < 10 ? "0" + minute : minute);
        isExpired = now > deadline;
    }
    
    todoList.push({
        name: activityName,
        fullText: fullText.substring(0, 50),
        centerY: b.centerY(),
        isExpired: isExpired,
        deadlineStr: deadlineStr
    });
}

console.log("\n===== 待签到列表 =====");
var validCount = 0;
todoList.forEach(function(item, idx) {
    var status = item.isExpired ? "[已过期]" : "[待处理]";
    if (!item.isExpired) validCount++;
    var deadline = item.deadlineStr ? " (截止:" + item.deadlineStr + ")" : "";
    console.log((idx + 1) + ". " + status + " " + item.name + deadline);
});
console.log("有效活动: " + validCount + "/" + todoList.length);
console.log("======================\n");

// ============================================================================
// 步骤 6：按列表顺序处理每个活动（跳过已过期的）
// ============================================================================
var results = [];
var processedNames = {};

for (var todoIdx = 0; todoIdx < todoList.length; todoIdx++) {
    if (Date.now() - globalStart > GLOBAL_TIMEOUT) {
        console.error(">>> 全局超时，退出");
        break;
    }
    
    var todoItem = todoList[todoIdx];
    
    // 跳过已处理的活动
    if (processedNames[todoItem.name]) {
        console.log(">>> 跳过已处理: " + todoItem.name);
        continue;
    }
    processedNames[todoItem.name] = true;
    
    console.log("\n===== 活动 " + (todoIdx + 1) + "/" + todoList.length + ": " + todoItem.name + " =====");
    if (todoItem.isExpired) {
        console.log(">>> 截止时间已过 (" + todoItem.deadlineStr + ")，检查是否已签到...");
    }
    
    // 重新查找活动（页面可能已刷新）
    var activity = null;
    var currentActivities = textContains(todayStr).find();
    for (var j = 0; j < currentActivities.length; j++) {
        var actName = currentActivities[j].text() || "";
        if (actName.indexOf(todoItem.name.substring(0, 20)) >= 0) {
            activity = currentActivities[j];
            break;
        }
    }
    
    if (!activity) {
        console.log(">>> 活动已消失，跳过");
        results.push({ name: todoItem.name, deadline: todoItem.deadlineStr, result: "not_found" });
        continue;
    }
    
    // 点击进入活动详情页
    console.log(">>> 点击活动: Y=" + activity.bounds().centerY());
    smartClick(activity);
    sleep(1500);
    
    // 执行签到
    var result;
    try {
        result = doCheckin();
    } catch (e) {
        console.error("签到异常: " + e);
        result = "error";
    }
    console.log(">>> 签到结果: " + result);
    
    // 失败时分析当前页面
    if (result !== "success" && result !== "already_signed") {
        debugPage("签到失败 - " + result);
    }
    
    results.push({ name: todoItem.name, deadline: todoItem.deadlineStr, result: result });
    
    // 返回活动列表
    console.log(">>> 返回");
    back();
    sleep(1000);
}

// ============================================================================
// 步骤 7：输出结果汇总
// ============================================================================
// 列出每个活动的签到结果，便于用户确认
// ============================================================================
console.log("\n===== 结果汇总 =====");
var successCount = 0;
var failCount = 0;
var skipCount = 0;
var missedCount = 0;
var failedNames = [];
var missedNames = [];

results.forEach(function(r, idx) {
    var deadline = r.deadline ? " (截止:" + r.deadline + ")" : "";
    console.log((idx + 1) + ". " + r.name + deadline + " -> " + r.result);
    if (r.result === "success") successCount++;
    else if (r.result === "already_signed") skipCount++;
    else if (r.result === "missed") {
        missedCount++;
        missedNames.push(r.name + (r.deadline ? "\n  截止:" + r.deadline : ""));
    } else {
        failCount++;
        failedNames.push(r.name + (r.deadline ? "\n  截止:" + r.deadline : ""));
    }
});
console.log("=== 完成 ===");

// 弹窗显示结果
var summary = "成功: " + successCount + "\n已签到: " + skipCount + "\n错过签到: " + missedCount + "\n失败: " + failCount;
if (missedCount > 0) {
    summary += "\n\n错过签到:\n" + missedNames.join("\n");
}
if (failCount > 0) {
    summary += "\n\n失败活动:\n" + failedNames.join("\n");
}

if (failCount === 0 && missedCount === 0) {
    toast("签到完成！");
    alert("签到完成", summary);
} else {
    toast("签到有异常，请检查");
    alert("签到结果", summary);
}
