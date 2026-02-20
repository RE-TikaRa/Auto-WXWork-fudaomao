"auto";
auto.waitFor();

var pkg = currentPackage();
var act = currentActivity();
var dm = context.getResources().getDisplayMetrics();

console.log("================================================================================");
console.log("                              界面深度分析");
console.log("================================================================================");
console.log("");
console.log("[基本信息]");
console.log("  包名: " + pkg);
console.log("  Activity: " + act);
console.log("  屏幕: " + dm.widthPixels + " x " + dm.heightPixels);
console.log("  密度: " + dm.density + " (" + dm.densityDpi + " dpi)");
console.log("");

console.log("================================================================================");
console.log("[TextView] 文本控件");
console.log("================================================================================");
var textViews = className("android.widget.TextView").find();
var textCount = 0;
textViews.forEach(function(w) {
    var t = w.text();
    if (t && t.trim()) {
        textCount++;
        var b = w.bounds();
        console.log("");
        console.log("  #" + textCount + " \"" + t + "\"");
        console.log("     bounds: (" + b.left + "," + b.top + ")-(" + b.right + "," + b.bottom + ")");
        console.log("     center: (" + b.centerX() + "," + b.centerY() + ")");
        console.log("     size: " + b.width() + "x" + b.height());
        console.log("     clickable: " + w.clickable() + ", enabled: " + w.enabled());
    }
});
console.log("");
console.log("  共 " + textCount + " 个有文本的 TextView");
console.log("");

console.log("================================================================================");
console.log("[View] WebView 内元素");
console.log("================================================================================");
var views = className("android.view.View").find();
var viewCount = 0;
views.forEach(function(w) {
    var t = w.text() || w.desc();
    if (t && t.trim()) {
        viewCount++;
        var b = w.bounds();
        var p = w.parent();
        console.log("");
        console.log("  #" + viewCount + " \"" + t + "\"");
        console.log("     bounds: (" + b.left + "," + b.top + ")-(" + b.right + "," + b.bottom + ")");
        console.log("     center: (" + b.centerX() + "," + b.centerY() + ")");
        console.log("     clickable: " + w.clickable());
        if (p) {
            console.log("     parent.clickable: " + p.clickable());
        }
    }
});
console.log("");
console.log("  共 " + viewCount + " 个有文本的 View");
console.log("");

console.log("================================================================================");
console.log("[Clickable] 可点击控件");
console.log("================================================================================");
var clickables = clickable(true).find();
var clickCount = 0;
clickables.forEach(function(w) {
    clickCount++;
    var t = w.text() || w.desc() || "";
    var b = w.bounds();
    var cls = w.className().replace("android.widget.", "").replace("android.view.", "");
    console.log("");
    console.log("  #" + clickCount + " [" + cls + "]" + (t ? " \"" + t + "\"" : ""));
    console.log("     bounds: (" + b.left + "," + b.top + ")-(" + b.right + "," + b.bottom + ")");
    console.log("     center: (" + b.centerX() + "," + b.centerY() + ")");
});
console.log("");
console.log("  共 " + clickCount + " 个可点击控件");
console.log("");

console.log("================================================================================");
console.log("[EditText] 输入框");
console.log("================================================================================");
var editTexts = className("android.widget.EditText").find();
if (editTexts.length === 0) {
    console.log("  (无)");
} else {
    editTexts.forEach(function(w, i) {
        var b = w.bounds();
        console.log("");
        console.log("  #" + (i + 1) + " 内容: \"" + w.text() + "\"");
        console.log("     bounds: (" + b.left + "," + b.top + ")-(" + b.right + "," + b.bottom + ")");
        console.log("     focused: " + w.focused());
    });
}
console.log("");

console.log("================================================================================");
console.log("[Button] 按钮");
console.log("================================================================================");
var buttons = className("android.widget.Button").find();
if (buttons.length === 0) {
    console.log("  (无)");
} else {
    buttons.forEach(function(w, i) {
        var b = w.bounds();
        console.log("");
        console.log("  #" + (i + 1) + " \"" + w.text() + "\"");
        console.log("     bounds: (" + b.left + "," + b.top + ")-(" + b.right + "," + b.bottom + ")");
        console.log("     center: (" + b.centerX() + "," + b.centerY() + ")");
        console.log("     clickable: " + w.clickable());
    });
}
console.log("");

console.log("================================================================================");
console.log("[ImageView] 图片控件 (快门按钮等)");
console.log("================================================================================");
var images = className("android.widget.ImageView").find();
var imgCount = 0;
images.forEach(function(w) {
    var b = w.bounds();
    if (b.width() > 50 && b.height() > 50) {
        imgCount++;
        var centerX = b.centerX();
        var isCenter = Math.abs(centerX - dm.widthPixels / 2) < 100;
        console.log("");
        console.log("  #" + imgCount + " " + b.width() + "x" + b.height() + (isCenter ? " [屏幕中央]" : ""));
        console.log("     bounds: (" + b.left + "," + b.top + ")-(" + b.right + "," + b.bottom + ")");
        console.log("     center: (" + b.centerX() + "," + b.centerY() + ")");
        console.log("     clickable: " + w.clickable());
    }
});
console.log("");
console.log("  共 " + imgCount + " 个大于 50x50 的 ImageView");
console.log("");

console.log("================================================================================");
console.log("[关键词搜索]");
console.log("================================================================================");
var keywords = ["签到", "完成", "拍照", "使用照片", "继续", "确定", "取消"];
keywords.forEach(function(kw) {
    var found = textContains(kw).findOnce();
    if (found) {
        var b = found.bounds();
        console.log("");
        console.log("  \"" + kw + "\" -> \"" + found.text() + "\"");
        console.log("     center: (" + b.centerX() + "," + b.centerY() + ")");
        console.log("     clickable: " + found.clickable());
    }
});
console.log("");

console.log("================================================================================");
console.log("                              分析完成");
console.log("================================================================================");
