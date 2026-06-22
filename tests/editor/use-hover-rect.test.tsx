// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { render, act, cleanup, fireEvent } from "@testing-library/react";
import { useHoverRect } from "@/lib/editor/use-hover-rect";

afterEach(cleanup);
beforeAll(() => {
  Element.prototype.getBoundingClientRect = () =>
    ({ top: 10, left: 20, width: 100, height: 40 }) as DOMRect;
});

function Harness({ onPick }: { onPick: (el: HTMLElement) => void }) {
  const { box, boxRef } = useHoverRect<HTMLElement>({
    active: true,
    match: (t) => (t instanceof HTMLElement && t.dataset.pickable ? { el: t, payload: t } : null),
    onPick,
    onScroll: "dismiss",
  });
  return (
    <div>
      {box && <div ref={boxRef} data-testid="box" style={{ top: box.top }} />}
      <button data-pickable="1">target</button>
      <div data-testid="outside">outside</div>
    </div>
  );
}

describe("useHoverRect", () => {
  it("shows a box on hover of a matching element, clears on leaving to a non-match", () => {
    const { container, getByText, getByTestId } = render(<Harness onPick={() => {}} />);
    act(() => { fireEvent.pointerMove(getByText("target"), { bubbles: true }); });
    expect(getByTestId("box")).toBeTruthy();
    act(() => { fireEvent.pointerMove(getByTestId("outside"), { bubbles: true }); });
    expect(container.querySelector('[data-testid="box"]')).toBeNull();
  });
  it("calls onPick with the matched element on click", () => {
    const onPick = vi.fn();
    const { getByText } = render(<Harness onPick={onPick} />);
    act(() => { fireEvent.click(getByText("target"), { bubbles: true }); });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect((onPick.mock.calls[0][0] as HTMLElement).tagName).toBe("BUTTON");
  });
});
