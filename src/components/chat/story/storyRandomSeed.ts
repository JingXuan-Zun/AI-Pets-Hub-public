export interface StoryRandomSeed {
  conflict: string;
  era: string;
  genre: string;
  setting: string;
  tone: string;
  twist: string;
}

const GENRES = [
  '冒险悬疑', '科幻探索', '奇幻旅行', '都市怪谈', '历史谜案', '荒野生存',
  '轻喜剧误会', '公路故事', '谍报行动', '灾难救援', '法庭博弈', '盗宝奇遇',
];
const ERAS = [
  '当代', '近未来', '遥远未来', '架空蒸汽时代', '神话时代末期', '王朝更替之夜',
  '文明重建初期', '时间循环中的同一天', '没有明确年代的异世界', '上世纪九十年代',
];
const SETTINGS = [
  '不断移动的巨型列车城', '暴风雪封锁的山间旅店', '深海研究站', '漂浮在云层上的集市',
  '即将闭馆的旧博物馆', '沙漠中的夜行商队', '停电后的沿海小城', '废弃空间站',
  '跨越不同年代的剧院', '被洪水分割的群岛', '地下图书城', '只在午夜出现的街区',
];
const CONFLICTS = [
  '在倒计时结束前找回失窃的城市记忆', '护送一名身份存疑的证人抵达终点',
  '查明所有人都记得却从未发生过的事件', '阻止两方因错误情报爆发冲突',
  '从封闭区域救出失联小队', '找出不断改变规则的幕后操纵者',
  '完成一场不能暴露真实目的的交易', '在资源耗尽前修复唯一的离开通道',
  '追回会影响多人命运的遗失物', '证明被所有证据指向的人并非真凶',
];
const TONES = [
  '紧张但充满希望', '安静而诡异', '轻快中逐渐显露危险', '宏大而克制',
  '温暖但带有离别感', '荒诞又严肃', '压迫感强但保留幽默', '浪漫与悬疑并存',
];
const TWISTS = [
  '可靠的地图会在午夜改变一次', '最明显的敌人其实在保护关键线索',
  '每次说出真相都会失去一段无关记忆', '任务目标与成功条件并不是同一件事',
  '一名同行者只能记住最近一个小时', '安全地点会随着角色关系变化',
  '看似偶然的事件来自未来留下的安排', '必须主动放弃一条优势才能获得真正线索',
];

function pick(values: string[], random: () => number) {
  const index = Math.min(values.length - 1, Math.max(0, Math.floor(random() * values.length)));
  return values[index] ?? values[0] ?? '';
}

export function createStoryRandomSeed(random: () => number = Math.random): StoryRandomSeed {
  return {
    conflict: pick(CONFLICTS, random),
    era: pick(ERAS, random),
    genre: pick(GENRES, random),
    setting: pick(SETTINGS, random),
    tone: pick(TONES, random),
    twist: pick(TWISTS, random),
  };
}
