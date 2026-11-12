import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/playground/markdown";

const render = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

describe("Markdown", () => {
  it("highlights known languages", () => {
    const html = render("```js\nconst x = 1;\n```");
    expect(html).toContain('class="hljs language-js"');
    expect(html).toContain("hljs-keyword");
  });

  it("renders unknown languages as plain code instead of throwing", () => {
    const html = render("```foolang\nx = 1\n```");
    expect(html).toContain("x = 1");
  });

  it("supports GFM tables", () => {
    expect(render("| a | b |\n|---|---|\n| 1 | 2 |")).toContain("<table>");
  });

  it("never renders raw HTML from model output", () => {
    const html = render('Hello <script>alert("x")</script><img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/<[^>]*onerror/); // may appear as escaped text, never as an attribute
    expect(html).toContain("&lt;script&gt;"); // shown literally, as text
  });

  it("opens links in a new tab safely", () => {
    expect(render("[docs](https://openrouter.ai)")).toContain('rel="noopener noreferrer"');
  });
});
