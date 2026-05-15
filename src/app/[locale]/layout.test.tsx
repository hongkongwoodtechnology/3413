import React from "react";
import RootLayout from "./layout";

function collectHostTypes(node: React.ReactNode, acc: string[] = []): string[] {
  if (!node || typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    return acc;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => collectHostTypes(child, acc));
    return acc;
  }

  if (React.isValidElement(node)) {
    if (typeof node.type === "string") {
      acc.push(node.type);
    }
    collectHostTypes(node.props.children, acc);
  }

  return acc;
}

describe("[locale] RootLayout", () => {
  it("does not render nested html, head, or body tags", async () => {
    const tree = await RootLayout({
      children: <div>page</div>,
      params: Promise.resolve({ locale: "zh-CN" }),
    });

    const hostTypes = collectHostTypes(tree);

    expect(hostTypes).not.toContain("html");
    expect(hostTypes).not.toContain("head");
    expect(hostTypes).not.toContain("body");
  });
});
