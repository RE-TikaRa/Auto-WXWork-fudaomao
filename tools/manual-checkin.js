"auto";
auto.waitFor();

var CONFIG = {
    packageName: "com.tencent.wework",
    reasonText: "离校",
    entryText: "辅导猫"
};

var POLL_INTERVAL = 200;
var MAX_WAIT = 10000;
var ANIM_DELAY = 500;
var GLOBAL_TIMEOUT = 180000;
var globalStart = Date.now();

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

function waitFor(finder, timeout) {
    timeout = timeout || MAX_WAIT;
    var start = Date.now();
    while (Date.now() - start < timeout) {
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

function smartClick(widget) {
    if (!widget) return false;
    if (widget.clickable()) return widget.click();
    var p = widget.parent();
    if (p && p.clickable()) return p.click();
    var b = widget.bounds();
    return click(b.centerX(), b.centerY());
}

function doCheckin() {
    var pageState = waitFor(function() {
        if (textContains("已签到").exists()) return "already_signed";
        var btn = text("范围外签到").findOnce();
        if (btn) return { btn: btn };
        var candidates = text("签到").find();
        for (var i = 0; i < candidates.length; i++) {
            var b = candidates[i].bounds();
            if (b.centerY() < device.height * 0.7 && b.centerY() > 300) {
                return { btn: candidates[i] };
            }
        }
        return null;
    }, MAX_WAIT);
    
    if (pageState === "already_signed") {
        console.log(">>> 已签到，跳过");
        return "already_signed";
    }
    if (!pageState || !pageState.btn) {
        console.log(">>> 未找到签到按钮");
        return "no_button";
    }
    
    sleep(ANIM_DELAY);
    console.log(">>> 点击: " + pageState.btn.text());
    smartClick(pageState.btn);
    
    var continueBtn = waitFor(function() { return text("继续签到").findOnce(); }, 5000);
    if (continueBtn) {
        sleep(ANIM_DELAY);
        console.log(">>> 点击: 继续签到");
        smartClick(continueBtn);
    }
    
    var photoBtn = waitFor(function() { return text("去拍照").findOnce(); }, 5000);
    if (photoBtn) {
        sleep(ANIM_DELAY);
        console.log(">>> 点击: 去拍照");
        smartClick(photoBtn);
        
        var permissionBtn = waitFor(function() {
            return text("允许").findOnce() || text("始终允许").findOnce() || textContains("仅在使用").findOnce();
        }, 2000);
        if (permissionBtn) {
            console.log(">>> 处理权限弹窗");
            smartClick(permissionBtn);
            sleep(500);
        }
        
        var shutterBtn = waitFor(function() {
            var minSize = device.width * 0.1;
            var maxSize = device.width * 0.2;
            return className("android.widget.ImageView").filter(function(w) {
                var b = w.bounds();
                return b.width() >= minSize && b.width() <= maxSize && Math.abs(b.centerX() - device.width / 2) < 50;
            }).findOnce();
        }, 5000);
        if (shutterBtn) {
            sleep(ANIM_DELAY);
            var b = shutterBtn.bounds();
            console.log(">>> 点击快门: (" + b.centerX() + ", " + b.centerY() + ")");
            click(b.centerX(), b.centerY());
        }
        
        var usePhotoBtn = waitFor(function() { return text("使用照片").findOnce(); }, 5000);
        if (usePhotoBtn) {
            sleep(ANIM_DELAY);
            console.log(">>> 点击: 使用照片");
            smartClick(usePhotoBtn);
        }
        
        var inputBox = waitFor(function() { return className("EditText").findOnce(); }, 5000);
        if (inputBox) {
            sleep(ANIM_DELAY);
            console.log(">>> 填写: " + CONFIG.reasonText);
            smartClick(inputBox);
            sleep(300);
            inputBox.setText(CONFIG.reasonText);
            sleep(300);
            back();
        }
        
        var finalBtn = waitFor(function() { return textContains("完成签到").findOnce(); }, 3000);
        if (finalBtn) {
            sleep(ANIM_DELAY);
            var b = finalBtn.bounds();
            console.log(">>> 点击完成签到: (" + b.centerX() + ", " + b.centerY() + ")");
            click(b.centerX(), b.centerY());
        }
    }
    
    if (waitFor(function() { return textContains("已签到").exists() ? true : null; }, 5000)) {
        console.log(">>> 签到成功！");
        return "success";
    }
    return "unknown";
}

console.log("===== 手动签到 =====");

if (!wakeUp()) {
    console.error(">>> 唤醒失败，退出");
    exit();
}

console.log(">>> 杀掉企业微信后台...");
app.openAppSetting(CONFIG.packageName);
var forceStopBtn = waitFor(function() {
    return text("强行停止").findOnce() || text("结束运行").findOnce();
}, 3000);
if (forceStopBtn && forceStopBtn.clickable()) {
    forceStopBtn.click();
    sleep(300);
    var confirmBtn = waitFor(function() { return text("确定").findOnce(); }, 2000);
    if (confirmBtn) confirmBtn.click();
}
back();
sleep(300);

console.log(">>> 启动企业微信...");
app.launch(CONFIG.packageName);
sleep(3000);
var appLaunched = waitFor(function() { return textContains(CONFIG.entryText).exists() || textContains("工作台").exists(); }, 15000);
if (!appLaunched) {
    console.error(">>> 企业微信启动超时，退出");
    exit();
}

var fudaomao = waitFor(function() { return textContains(CONFIG.entryText).findOnce(); }, 10000);
if (!fudaomao) {
    console.error(">>> 未找到辅导猫入口，退出");
    exit();
}
console.log(">>> 点击: 辅导猫");
smartClick(fudaomao);

var today = new Date();
var todayStr = (today.getMonth() + 1).toString().padStart(2, '0') + "月" + 
               today.getDate().toString().padStart(2, '0') + "日";
console.log(">>> 今天: " + todayStr);

sleep(2000);
var activities = textContains(todayStr).find();
console.log(">>> 找到 " + activities.length + " 个今日活动");

if (activities.length === 0) {
    console.log(">>> 没有今日活动，退出");
    exit();
}

var results = [];
var processedCount = 0;
while (activities.length > 0) {
    if (Date.now() - globalStart > GLOBAL_TIMEOUT) {
        console.error(">>> 全局超时，退出");
        break;
    }
    
    // 总是处理第一个活动，避免索引错位
    var activity = activities[0];
    var activityName = (activity.text() || "").substring(0, 25);
    processedCount++;
    console.log("\n===== 活动 " + processedCount + ": " + activityName + " =====");
    
    smartClick(activity);
    
    var result;
    try {
        result = doCheckin();
    } catch (e) {
        console.error("签到异常: " + e);
        result = "error";
    }
    results.push({ name: activityName, result: result });
    
    console.log(">>> 返回");
    back();
    sleep(1000);
    
    // 刷新活动列表
    activities = textContains(todayStr).find();
    if (activities.length === 0) {
        console.log(">>> 活动列表丢失，尝试重新进入辅导猫");
        back();
        sleep(1000);
        var fudaomao2 = waitFor(function() { return textContains(CONFIG.entryText).findOnce(); }, 5000);
        if (fudaomao2) {
            smartClick(fudaomao2);
            sleep(2000);
            activities = textContains(todayStr).find();
        }
    }
}

console.log("\n===== 结果汇总 =====");
results.forEach(function(r, idx) {
    console.log((idx + 1) + ". " + r.name + " -> " + r.result);
});
console.log("=== 完成 ===");
