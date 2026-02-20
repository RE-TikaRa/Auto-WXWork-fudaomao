// ============================================================================
// 界面分析调试工具
// ============================================================================
//
// 【脚本说明】
// 这是一个调试辅助工具，用于分析当前屏幕上的 UI 控件信息。
// 运行后会输出当前页面所有控件的详细信息，帮助开发者：
// - 了解页面结构和控件层级
// - 获取控件的文本、坐标、尺寸等属性
// - 确定控件的可点击状态
// - 调试选择器匹配问题
//
// 【使用场景】
// 1. 签到按钮找不到时，分析页面上有哪些文本控件
// 2. 快门按钮识别失败时，查看 ImageView 的尺寸和位置
// 3. 点击无效时，检查控件的 clickable 属性
// 4. 适配新设备时，了解不同分辨率下的控件布局
//
// 【运行方式】
// 1. 先手动导航到要分析的页面
// 2. 在 AutoJs6 中运行此脚本
// 3. 查看控制台输出的分析结果
//
// 【输出内容】
// - 基本信息：包名、Activity、屏幕尺寸、像素密度
// - TextView：所有文本控件及其属性
// - View：WebView 内的元素（辅导猫页面主要是 WebView）
// - Clickable：所有可点击控件
// - EditText：输入框控件
// - Button：按钮控件
// - ImageView：图片控件（用于识别快门按钮）
// - 关键词搜索：常用关键词的匹配结果
// ============================================================================

"auto";
auto.waitFor();

// ============================================================================
// 获取基本信息
// ============================================================================
// currentPackage(): 当前前台应用的包名
// currentActivity(): 当前显示的 Activity 类名
// DisplayMetrics: Android 系统的屏幕参数对象
// ============================================================================
var pkg = currentPackage();
var act = currentActivity();
var dm = context.getResources().getDisplayMetrics();

// ============================================================================
// 输出基本信息
// ============================================================================
// 这些信息对于调试非常重要：
// - 包名：确认当前是否在目标应用中
// - Activity：了解当前页面类型（原生页面 vs WebView）
// - 屏幕尺寸：用于计算相对坐标和尺寸
// - 像素密度：用于 dp 和 px 的换算
// ============================================================================
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

// ============================================================================
// 分析 TextView 控件
// ============================================================================
// TextView 是 Android 中最基本的文本显示控件。
// 原生 Android 应用中的大部分文本都是 TextView。
// 
// 【输出属性说明】
// - bounds: 控件的边界矩形 (left, top)-(right, bottom)
// - center: 控件中心点坐标，用于坐标点击
// - size: 控件尺寸 (宽x高)
// - clickable: 是否可点击（true 表示可以用 widget.click()）
// - enabled: 是否启用（false 表示控件被禁用，通常显示为灰色）
// ============================================================================
console.log("================================================================================");
console.log("[TextView] 文本控件");
console.log("================================================================================");
var textViews = className("android.widget.TextView").find();
var textCount = 0;
textViews.forEach(function(w) {
    var t = w.text();
    // 只输出有文本内容的控件，过滤空白控件
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

// ============================================================================
// 分析 View 控件（WebView 内元素）
// ============================================================================
// 辅导猫是一个 WebView 应用，页面内容通过 H5 渲染。
// WebView 内的元素在无障碍树中显示为 android.view.View。
// 
// 【WebView vs 原生控件】
// - 原生控件：TextView, Button, ImageView 等
// - WebView 元素：统一显示为 View，通过 text() 或 desc() 获取内容
// 
// 【为什么要分析 View】
// 辅导猫的签到按钮、活动列表等都是 WebView 内的元素，
// 需要通过 View 类型来查找和操作。
// 
// 【parent.clickable 的意义】
// WebView 内的元素本身可能不可点击，但其父元素可能可点击。
// 这时可以通过点击父元素来触发操作。
// ============================================================================
console.log("================================================================================");
console.log("[View] WebView 内元素");
console.log("================================================================================");
var views = className("android.view.View").find();
var viewCount = 0;
views.forEach(function(w) {
    // View 的内容可能在 text() 或 desc() 属性中
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

// ============================================================================
// 分析可点击控件
// ============================================================================
// 列出所有 clickable=true 的控件。
// 这些控件可以直接使用 widget.click() 方法点击。
// 
// 【类名简化】
// 为了输出更简洁，移除了 android.widget. 和 android.view. 前缀。
// 例如：android.widget.Button → Button
// ============================================================================
console.log("================================================================================");
console.log("[Clickable] 可点击控件");
console.log("================================================================================");
var clickables = clickable(true).find();
var clickCount = 0;
clickables.forEach(function(w) {
    clickCount++;
    var t = w.text() || w.desc() || "";
    var b = w.bounds();
    // 简化类名，移除包名前缀
    var cls = w.className().replace("android.widget.", "").replace("android.view.", "");
    console.log("");
    console.log("  #" + clickCount + " [" + cls + "]" + (t ? " \"" + t + "\"" : ""));
    console.log("     bounds: (" + b.left + "," + b.top + ")-(" + b.right + "," + b.bottom + ")");
    console.log("     center: (" + b.centerX() + "," + b.centerY() + ")");
});
console.log("");
console.log("  共 " + clickCount + " 个可点击控件");
console.log("");

// ============================================================================
// 分析 EditText 控件（输入框）
// ============================================================================
// EditText 是 Android 的文本输入控件。
// 范围外签到时需要填写原因，就是通过 EditText 输入的。
// 
// 【focused 属性】
// 表示输入框是否获得焦点（光标是否在输入框内）。
// 只有获得焦点的输入框才能接收键盘输入。
// ============================================================================
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

// ============================================================================
// 分析 Button 控件
// ============================================================================
// Button 是 Android 的按钮控件。
// 注意：WebView 内的按钮通常不是 Button 类型，而是 View 类型。
// ============================================================================
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

// ============================================================================
// 分析 ImageView 控件（图片）
// ============================================================================
// ImageView 是 Android 的图片显示控件。
// 相机界面的快门按钮通常是一个 ImageView。
// 
// 【快门按钮识别】
// 快门按钮的特征：
// - 尺寸较大（> 50x50 像素）
// - 位于屏幕水平中央
// - 通常在屏幕下半部分
// 
// 【过滤条件】
// 只显示尺寸 > 50x50 的 ImageView，过滤掉小图标。
// 标记 [屏幕中央] 表示该控件水平居中（距离屏幕中心 < 100px）。
// ============================================================================
console.log("================================================================================");
console.log("[ImageView] 图片控件 (快门按钮等)");
console.log("================================================================================");
var images = className("android.widget.ImageView").find();
var imgCount = 0;
images.forEach(function(w) {
    var b = w.bounds();
    // 只显示较大的图片控件（> 50x50），过滤小图标
    if (b.width() > 50 && b.height() > 50) {
        imgCount++;
        var centerX = b.centerX();
        // 判断是否在屏幕水平中央（距离中心 < 100px）
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

// ============================================================================
// 关键词搜索
// ============================================================================
// 快速查找签到流程中常用的关键词。
// 如果找到匹配的控件，输出其文本和坐标。
// 
// 【关键词列表】
// - 签到：签到按钮
// - 完成：完成签到按钮
// - 拍照：去拍照按钮
// - 使用照片：拍照后的确认按钮
// - 继续：继续签到弹窗
// - 确定/取消：各种确认对话框
// 
// 【使用 textContains】
// 使用模糊匹配而非精确匹配，因为按钮文本可能包含空格或其他字符。
// 例如：" 完成签到" 或 "完成签到 "
// ============================================================================
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
