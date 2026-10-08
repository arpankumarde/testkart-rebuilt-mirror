import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import { useBundleUnpublishGuard } from "./useBundleUnpublishGuard";

const TITLE = "This item is included in a bundle";

const Harness = ({ proceed }: { proceed: (confirmed: boolean) => unknown }) => {
  const { requestUnpublish, bundleUnpublishDialog } = useBundleUnpublishGuard();
  return (
    <>
      <button onClick={() => void requestUnpublish({ itemType: "course", ids: [7] }, proceed)}>unpublish</button>
      {bundleUnpublishDialog}
    </>
  );
};

const mount = (proceed: (confirmed: boolean) => unknown) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness proceed={proceed} />
    </QueryClientProvider>
  );
};

// Testing Library's waitFor does not poll under this runner, so conditions are
// polled directly.
const until = async (condition: () => boolean, timeoutMs = 2000) => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting for the condition");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

const dialogOpen = () => screen.queryByText(TITLE) !== null;

const answerContaining = (bundles: { id: number; title: string }[] | "fail") =>
  spyOn(globalThis, "fetch").and.callFake(async () =>
    bundles === "fail"
      ? new Response(superjson.stringify({ error: "boom" }), { status: 500 })
      : new Response(superjson.stringify({ bundles }), { status: 200 })
  );

describe("useBundleUnpublishGuard", () => {
  let nodeCustomEvent: typeof CustomEvent;

  // Radix builds its layer events from the global CustomEvent, which under this
  // runner is Node's and is refused by jsdom's document.dispatchEvent.
  beforeAll(() => {
    nodeCustomEvent = globalThis.CustomEvent;
    globalThis.CustomEvent = window.CustomEvent;
  });

  afterAll(() => {
    globalThis.CustomEvent = nodeCustomEvent;
  });

  afterEach(() => cleanup());

  it("goes straight to the normal flow when no published bundle holds the item", async () => {
    const fetchSpy = answerContaining([]);
    const proceed = jasmine.createSpy("proceed");
    mount(proceed);

    fireEvent.click(screen.getByText("unpublish"));
    await until(() => proceed.calls.count() > 0);

    expect(proceed.calls.count()).toBe(1);
    expect(proceed).toHaveBeenCalledWith(false);
    expect(dialogOpen()).toBe(false);
    const url = String(fetchSpy.calls.mostRecent().args[0]);
    expect(url).toContain("/_api/teacher/bundles/containing");
    expect(url).toContain("itemType=course");
    expect(url).toContain("ids=7");
  });

  it("shows the warning, with the bundle names, and changes nothing until confirmed", async () => {
    answerContaining([
      { id: 1, title: "Bundle One" },
      { id: 2, title: "Bundle Two" },
    ]);
    const proceed = jasmine.createSpy("proceed");
    mount(proceed);

    fireEvent.click(screen.getByText("unpublish"));
    await until(dialogOpen);

    expect(screen.queryByText(/part of one or more published bundles/)).not.toBeNull();
    expect(screen.queryByText(/Bundle One, Bundle Two/)).not.toBeNull();
    expect(screen.queryByText("Cancel")).not.toBeNull();
    expect(screen.queryByText("Unpublish Anyway")).not.toBeNull();
    expect(proceed).not.toHaveBeenCalled();
  });

  it("leaves everything unchanged when the teacher cancels", async () => {
    answerContaining([{ id: 1, title: "Bundle One" }]);
    const proceed = jasmine.createSpy("proceed");
    mount(proceed);

    fireEvent.click(screen.getByText("unpublish"));
    await until(dialogOpen);
    fireEvent.click(screen.getByText("Cancel"));
    await until(() => !dialogOpen());

    await settle();
    expect(proceed).not.toHaveBeenCalled();
  });

  it("runs the unpublish with the confirmation flag on Unpublish Anyway, then closes", async () => {
    answerContaining([{ id: 1, title: "Bundle One" }]);
    const proceed = jasmine.createSpy("proceed").and.callFake(() => Promise.resolve());
    mount(proceed);

    fireEvent.click(screen.getByText("unpublish"));
    await until(dialogOpen);
    fireEvent.click(screen.getByText("Unpublish Anyway"));
    await until(() => proceed.calls.count() > 0);
    await until(() => !dialogOpen());

    expect(proceed.calls.count()).toBe(1);
    expect(proceed).toHaveBeenCalledWith(true);
  });

  it("closes the warning and does not throw when the confirmed unpublish fails", async () => {
    answerContaining([{ id: 1, title: "Bundle One" }]);
    const proceed = jasmine.createSpy("proceed").and.callFake(() => Promise.reject(new Error("server said no")));
    mount(proceed);

    fireEvent.click(screen.getByText("unpublish"));
    await until(dialogOpen);
    fireEvent.click(screen.getByText("Unpublish Anyway"));
    await until(() => !dialogOpen());

    expect(proceed.calls.count()).toBe(1);
  });

  it("falls back to the normal flow when the check fails, leaving the server to refuse", async () => {
    answerContaining("fail");
    spyOn(console, "error");
    const proceed = jasmine.createSpy("proceed");
    mount(proceed);

    fireEvent.click(screen.getByText("unpublish"));
    await until(() => proceed.calls.count() > 0);

    expect(proceed).toHaveBeenCalledWith(false);
    expect(dialogOpen()).toBe(false);
  });

  it("ignores a second click while the first is still being checked", async () => {
    let release: (response: Response) => void = () => undefined;
    const fetchSpy = spyOn(globalThis, "fetch").and.returnValue(
      new Promise<Response>((resolve) => (release = resolve))
    );
    const proceed = jasmine.createSpy("proceed");
    mount(proceed);

    fireEvent.click(screen.getByText("unpublish"));
    fireEvent.click(screen.getByText("unpublish"));
    release(new Response(superjson.stringify({ bundles: [] }), { status: 200 }));
    await until(() => proceed.calls.count() > 0);
    await settle();

    expect(proceed.calls.count()).toBe(1);
    expect(fetchSpy.calls.count()).toBe(1);
  });
});
