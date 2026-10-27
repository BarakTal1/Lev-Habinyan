import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/tickets" }));

import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import { LtrText } from "@/components/LtrText";
import { Row } from "@/components/Row";

describe("Badge", () => {
  it("shows the Hebrew label and the token background for danger", () => {
    const { container } = render(<Badge list="urgency" value="סכנה" />);
    expect(screen.getByText("סכנה")).toBeInTheDocument();
    expect((container.firstChild as HTMLElement).style.backgroundColor).toBe("rgb(198, 40, 40)");
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("Row", () => {
  it("renders without a building and without a stray separator", () => {
    render(<Row kind="task" title="חידוש ביטוח מבנה" building={null} meta="בעוד 11 ימים" />);
    expect(screen.queryByText("·")).toBeNull();
    expect(screen.getByText("בעוד 11 ימים")).toBeInTheDocument();
  });
  it("shows building, separator and meta when a building exists", () => {
    render(<Row kind="fault" title="נזילה" building="ויצמן 9" meta="לפני 3 ימים" />);
    expect(screen.getByText("ויצמן")).toBeInTheDocument();
    expect(screen.getByText("·")).toBeInTheDocument();
  });
  it("does not badge the default urgency and has no edge mark for it", () => {
    render(<Row kind="fault" title="נורה" building="ויצמן 9" badge={{ list: "urgency", value: "חשוב" }} />);
    expect(screen.queryByText("חשוב")).toBeNull();
    expect(screen.queryByTestId("row-edge")).toBeNull();
  });
  it("badges and marks the edge for an urgent fault", () => {
    render(<Row kind="fault" title="נזילה" building="ויצמן 9" badge={{ list: "urgency", value: "דחוף" }} />);
    expect(screen.getByText("דחוף")).toBeInTheDocument();
    expect(screen.getByTestId("row-edge")).toBeInTheDocument();
  });
  it("shows the house number on the plaque", () => {
    const { container } = render(<Row kind="fault" title="נזילה" building="דיזנגוף 78" />);
    expect(container.textContent).toContain("78");
  });
  it("keeps a Hebrew title with Latin text as one text node, laid out right to left", () => {
    render(<Row kind="fault" title="ראוטר TP-Link בלובי" building="דיזנגוף 78" />);
    const title = screen.getByText("ראוטר TP-Link בלובי");
    expect(title).toHaveAttribute("dir", "rtl");
    expect(title.childNodes).toHaveLength(1);
  });
  it("lays a title that starts with a Latin word out right to left too", () => {
    render(<Row kind="fault" title="Wi-Fi לא עובד בלובי" building={null} />);
    expect(screen.getByText("Wi-Fi לא עובד בלובי")).toHaveAttribute("dir", "rtl");
  });
  it("links to href when given", () => {
    render(<Row kind="fault" title="x" building={null} href="/tickets/1" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/tickets/1");
  });
});

describe("LtrText", () => {
  it("renders left to right", () => {
    render(<LtrText>052-0000101</LtrText>);
    expect(screen.getByText("052-0000101")).toHaveAttribute("dir", "ltr");
  });
});

describe("BottomNav", () => {
  it("has five links and marks the current route", () => {
    render(<BottomNav />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: /לוח שנה/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /כרטיסים/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /היום/ })).not.toHaveAttribute("aria-current");
  });
});
