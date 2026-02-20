module.exports = {
    packageName: "com.tencent.wework",
    
    checkin: {
        reasonText: "离校"
    },
    
    fudaomao: {
        entryText: "辅导猫"
    },
    
    trigger: {
        keywords: ["打卡", "签到", "辅导猫"],
        startHour: 7,
        startMinute: 50,
        endHour: 8,
        endMinute: 10
    },
    
    // 备用定时：如果通知触发时段内没有签到，则在此时间自动运行
    fallback: {
        hour: 10,
        minute: 30
    }
};
