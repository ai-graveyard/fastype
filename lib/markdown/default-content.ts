import type { Locale } from "@/lib/i18n";

const SAMPLE: Record<Locale, { filename: string; content: string }> = {
  zh: {
    filename: "把日常写成值得分享的内容.md",
    content: `# 把日常写成值得分享的内容

灵感不一定来自远方。一次散步、一顿早餐、一个刚解决的小问题，都可以成为下一篇笔记的起点。

## 先留下一个具体细节

比起“今天很开心”，试着写下：阳光落在桌角，咖啡刚好不烫。

**让读者看见一个画面，比告诉他一种感受更容易。**

## 再分享一点自己的发现

- 这件事为什么让你停下来？
- 你试过哪些方法，最后留下了哪个？
- 如果重来一次，你会怎么做？

不必一次讲完所有道理。一篇笔记，讲清一件事就够了。

> 把亲身经历写具体，就是你的独特视角。

## 最后，给它一个清楚的标题

用“我怎样把通勤时间变成阅读时间”，代替“我的生活感悟”。让读者知道，点开之后能看到什么。

从今天的一件小事开始。`,
  },
  en: {
    filename: "Turn everyday moments into stories.md",
    content: `# Turn everyday moments into stories worth sharing

A short walk, a good breakfast, a problem you just solved. Your next story may already be in your day.

## Start with one detail

Instead of “I had a lovely morning,” describe the sunlight on the table and the coffee that was finally cool enough to drink.

**A scene gives your reader something to remember.**

## Share what you learned

- What made you stop and notice?
- What did you try, and what worked?
- What would you do differently next time?

One post can tell one small story well.

> Your experience becomes useful when you make it specific.

## Give it a clear title

“How I made time to read on my commute” tells readers more than “Thoughts on life.”

Start with something that happened today.`,
  },
};

export function getDefaultDraftFilename(locale: Locale): string {
  return SAMPLE[locale].filename;
}

export function getDefaultDraftContent(locale: Locale): string {
  return SAMPLE[locale].content;
}
