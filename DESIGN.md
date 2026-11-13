---
name: 朔望月
description: 月夜庭院里的节气与节日牌局。
colors:
  brass: "#dfc697"
  brass-light: "#f1e0be"
  brass-line: "#8b7855"
  stage: "#101a24"
  felt: "#132833"
  panel: "#14242e"
  panel-top: "#10202b"
  card: "#12232f"
  paper: "#f0ece1"
  ink: "#18232c"
  muted: "#b4c3cc"
  divider: "#4c5c61"
  match: "#c5d9bf"
  warning: "#f0b5a6"
typography:
  display:
    fontFamily: "Ma Shan Zheng, STKaiti, KaiTi, Noto Serif SC, Songti SC, STSong, SimSun, serif"
    fontSize: "clamp(34px, 3.5vw, 52px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.12em"
  headline:
    fontFamily: "Noto Serif SC, Songti SC, STSong, SimSun, serif"
    fontSize: "21px"
    fontWeight: 500
    lineHeight: 1.35
  card-name:
    fontFamily: "Noto Serif SC, Songti SC, STSong, SimSun, serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.18
    letterSpacing: "0.1em"
  body:
    fontFamily: "Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  action:
    fontFamily: "Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "15px"
    fontWeight: 650
rounded:
  panel: "10px"
  card: "6px"
  control: "5px"
  field: "4px"
spacing:
  column-gap: "20px"
  narrow-column-gap: "15px"
  hand-gap: "12px"
  evidence-card-gap: "9px"
components:
  button-primary:
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "8px 18px"
  button-primary-hover:
    backgroundColor: "{colors.brass-light}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "8px 18px"
  button-challenge:
    backgroundColor: "{colors.panel-top}"
    textColor: "{colors.brass-light}"
    rounded: "{rounded.control}"
    padding: "5px 11px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.brass}"
    padding: "6px 0"
  button-hint:
    backgroundColor: "{colors.panel-top}"
    textColor: "{colors.brass-light}"
    rounded: "{rounded.control}"
    padding: "5px 9px"
  card-face:
    backgroundColor: "{colors.card}"
    textColor: "{colors.paper}"
    rounded: "{rounded.card}"
    width: "120px"
    height: "142px"
  card-back:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    width: "120px"
    height: "142px"
  evidence-tabs:
    backgroundColor: "{colors.panel-top}"
    textColor: "{colors.muted}"
    padding: "8px 4px"
  note-field:
    backgroundColor: "{colors.panel-top}"
    textColor: "{colors.paper}"
    rounded: "{rounded.field}"
    padding: "9px"
---

# Design System: 朔望月

## Overview

**Creative North Star: "月夜庭院里的牌桌"**

青墨色庭院、蓝灰织物和做旧黄铜细边构成牌桌。节气和节日的插画带来小面积暖光，暗牌用月牙、细环和云纹识别。

牌桌把筹码、牌面数字和行动放在稳定位置，线索与提示在相邻区域供玩家查对。标题用书法字标，规则、数字和操作使用清楚的本地字体。

**Key Characteristics:**

- 青墨与蓝灰底色，做旧黄铜细边。
- 横排牌名、节令插画、日期与拆分数字。
- 桌面并排，手机依次呈现牌桌、操作与证据。

## Colors

### Primary

- **黄铜与浅铜光**用于主操作、关键筹码、焦点和当前标签。暗黄铜线用于牌桌和面板边框。

### Secondary

- **浅绿与浅珊瑚**分别配合「相符」「排除」的文字结论。保存异常也使用浅珊瑚。

### Neutral

- **青墨与蓝灰**承接庭院、桌布、证据面板和牌面，细分隔线标明不同区域。
- **月白与雾灰**区分主要读数和辅助说明，实心主按钮使用深墨文字。

### Named Rules

**The Brass Accent Rule.** 用黄铜描边界，以浅铜强调当前状态、筹码读数与主要行动。

## Typography

- **字标**只在页首「朔望月」使用内嵌 Ma Shan Zheng 三字子集，回退到本地楷体和宋体。
- **标题与牌名**用本地宋体衬线栈。证据标题为 21px，实战牌名为 20px，小牌与手机牌名为 17px。
- **正文与标签**用 Segoe UI、Microsoft YaHei 和无衬线回退。基础文字为 15px，辅助标签通常为 11–13px。
- **筹码与底池**用 600 字重的衬线数字，桌面读数分别为 29px 和 38px，窄手机布局分别为 18px 和 29px。

### Named Rules

**The Readable Number Rule.** 日期和拆分数字各占一行，拆分数字和关键筹码读数开启等宽数字特性。

## Layout

桌面最大宽 1450px，牌桌和操作占主列，298–354px 的证据栏占右列。牌桌分为地猴、公共牌和玩家三带。表头用分组进度标明八手，当前行动的席位用小铜菱标记。证据栏内容可独立滚动，标签保留在栏顶。

1080px 起收紧横向留白。820px 起改为单列，证据栏随页面滚动，提供返回出牌的入口。540px 起把席位标签移到各手牌上方，缩小牌身和底池读数。360px 起进一步压紧间距。宽度至少 821px、高度不超过 800px 时收紧桌面牌高和表头。

## Elevation & Depth

庭院通过渐变压暗，牌桌使用低对比织物。面板有柔和的环境阴影与细内框，牌身以近距阴影从桌面浮起。

### Shadow Vocabulary

- **证据面板** `0 12px 38px #070f1570, inset 0 0 0 3px #0a19235c`
- **牌桌** `0 12px 30px #080f1780, inset 0 0 32px #08141d83`
- **牌身** `0 6px 14px #071018ad, inset 0 0 0 2px #b69c6d34`

## Shapes

主体框角为 10px，牌身为 6px，操作控件为 5px。牌桌的表头和织物面各保留外侧圆角，合起来形成连续的铜边。牌身用统一外框，牌背图案铺满内框。

## Components

### 牌桌操作

主操作用浅黄铜渐变，悬停时为浅铜实色。次操作、挑战和提示使用深蓝底与铜边。文字操作用下划线。主次按钮最小高 46px，挑战与提示为 44px。键盘焦点用 2px 黄铜描线。颜色与边框过渡为 150ms，减少动态效果时关闭。

第 5 手起，挑战和秘密换暗牌在出牌按钮下并排。换入的暗牌有更亮的铜边与「你的新暗牌」标签。

### 分享窗口

页首「分享」打开与入局介绍同风格的窗口。网页版显示可选中的游戏链接与复制操作，离线版提供保存试玩文件。

### 牌面与牌背

`PlayingCard` 从上到下排列深底浅字的横排牌名、独立插画窗、日期和拆分数字。明暗、公私等身份按场景在牌外标注。未公开的暗牌使用同尺寸的月牙牌背。证据判例复用同一组件的小尺寸变体。

### 证据栏与提示

四个标签平排，当前标签用浅铜字与底部细线。牌桌的提示入口跳到「本场提示」。提示框显示剩余次数，按钮写明次数与内容，最后一档明确写出「揭晓法则」。已用提示可以折叠回看。

「查看开局牌例」与手机上的「回到出牌」使用下划线文字操作，最小高度为 38px，单列布局下为 44px。对照表用文字、颜色和细线标明判定。笔记区使用蓝墨底的多行输入框、雾灰说明与铜色焦点。

## Do's and Don'ts

- **Do** 把筹码费用直接写在相关按钮上。
- **Do** 为暗牌保留同尺寸的统一牌背和清楚的身份标签。
- **Don't** 把牌名、日期或拆分数字画进插画资源。
