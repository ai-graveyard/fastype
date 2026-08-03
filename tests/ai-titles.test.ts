import { describe, expect, it } from "vitest";

import { buildTitleMessages, parseTitleCandidates, TITLE_SUGGESTION_COUNT } from "@/lib/ai/titles";
import { DEFAULT_AI_CONFIG } from "@/lib/ai/types";
import { applyTitleToSource, findH1Line, normalizeTitleText } from "@/lib/markdown/title";

const LABELS = { document: "待处理的完整 Markdown：", keywords: "关键词或大纲" };

describe("标题候选解析", () => {
  it("一行一个时原样取回", () => {
    expect(parseTitleCandidates("第一个标题\n第二个标题\n第三个标题")).toEqual([
      "第一个标题",
      "第二个标题",
      "第三个标题",
    ]);
  });

  it("剥掉编号、项目符号和标题记号", () => {
    const raw = [
      "1. 阿拉伯数字编号",
      "2、顿号编号",
      "- 项目符号",
      "* 星号",
      "## Markdown 标题",
    ].join("\n");
    expect(parseTitleCandidates(raw)).toEqual([
      "阿拉伯数字编号",
      "顿号编号",
      "项目符号",
      "星号",
      "Markdown 标题",
    ]);
  });

  it("剥掉引号、书名号和加粗", () => {
    const raw = ['"直引号"\n“弯引号”\n《书名号》\n【方头括号】\n**加粗**'].join("\n");
    expect(parseTitleCandidates(raw)).toEqual(["直引号", "弯引号", "书名号", "方头括号", "加粗"]);
  });

  it("丢掉引导语、围栏和分隔线", () => {
    const raw = ["以下是 5 个候选标题：", "```", "真正的标题", "---", "另一个标题", "```"].join(
      "\n",
    );
    expect(parseTitleCandidates(raw)).toEqual(["真正的标题", "另一个标题"]);
  });

  it("超长的行不是标题", () => {
    const long = "很".repeat(120);
    expect(parseTitleCandidates(`正常标题\n${long}`)).toEqual(["正常标题"]);
  });

  it("去重并截到上限", () => {
    const raw = ["A", "A", "B", "C", "D", "E", "F", "G"].join("\n");
    const titles = parseTitleCandidates(raw);
    expect(titles).toEqual(["A", "B", "C", "D", "E"]);
    expect(titles).toHaveLength(TITLE_SUGGESTION_COUNT);
  });

  it("空输入返回空列表", () => {
    expect(parseTitleCandidates("")).toEqual([]);
    expect(parseTitleCandidates("   \n\n  ")).toEqual([]);
  });
});

describe("起标题的请求消息", () => {
  it("把 {{count}} 换成实际条数", () => {
    const messages = buildTitleMessages(DEFAULT_AI_CONFIG, {
      source: "document",
      content: "正文",
      labels: LABELS,
    });
    expect(messages[0].content).not.toContain("{{count}}");
    expect(messages[0].content).toContain(String(TITLE_SUGGESTION_COUNT));
  });

  it("两种来源用各自的标签", () => {
    const fromDocument = buildTitleMessages(DEFAULT_AI_CONFIG, {
      source: "document",
      content: "正文",
      labels: LABELS,
    });
    const fromKeywords = buildTitleMessages(DEFAULT_AI_CONFIG, {
      source: "keywords",
      content: "本地部署",
      labels: LABELS,
    });
    expect(fromDocument[1].content).toContain(LABELS.document);
    expect(fromKeywords[1].content).toContain(LABELS.keywords);
    expect(fromKeywords[1].content).toContain("本地部署");
  });
});

describe("标题写回正文", () => {
  it("替换第一个 H1，其余内容不动", () => {
    const source = "# 旧标题\n\n正文第一段。\n\n# 后面还有一个 H1\n";
    expect(applyTitleToSource(source, "新标题")).toBe(
      "# 新标题\n\n正文第一段。\n\n# 后面还有一个 H1\n",
    );
  });

  it("没有 H1 时在最前面补一个", () => {
    expect(applyTitleToSource("正文第一段。\n", "新标题")).toBe("# 新标题\n\n正文第一段。\n");
  });

  it("Front Matter 之后才是插入位置", () => {
    const source = "---\ntitle: 元数据\n---\n正文。\n";
    expect(applyTitleToSource(source, "新标题")).toBe(
      "---\ntitle: 元数据\n---\n# 新标题\n\n正文。\n",
    );
  });

  it("Front Matter 里的 # 不算 H1", () => {
    const source = "---\ntags:\n  - '# 井号开头的标签'\n---\n正文。\n";
    expect(findH1Line(source)).toBe(-1);
  });

  it("围栏代码块里的 # 是注释，不是标题", () => {
    const source = "```bash\n# 这是命令注释\necho hi\n```\n\n正文。\n";
    expect(findH1Line(source)).toBe(-1);
    expect(applyTitleToSource(source, "新标题")).toBe(
      "# 新标题\n\n```bash\n# 这是命令注释\necho hi\n```\n\n正文。\n",
    );
  });

  it("标题里的换行会被压平，不会撑破那一行", () => {
    expect(normalizeTitleText("上半句\n下半句")).toBe("上半句 下半句");
    expect(applyTitleToSource("# 旧\n", "上半句\n下半句")).toBe("# 上半句 下半句\n");
  });

  it("空标题不改动正文", () => {
    expect(applyTitleToSource("# 旧标题\n", "   ")).toBe("# 旧标题\n");
  });
});
