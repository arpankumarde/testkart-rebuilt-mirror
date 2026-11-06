import { parseTcoinsConfig, replayTcoins } from "./tcoinsMath";

const day = (n: number) => new Date(Date.UTC(2026, 10, 1) + n * 24 * 60 * 60 * 1000);

describe("replayTcoins", () => {
  it("drops a batch once it expires", () => {
    const result = replayTcoins([{ coins: 100, at: day(0), expiresAt: day(30) }], [], day(31));
    expect(result.balance).toBe(0);
    expect(result.expired).toBe(100);
  });

  it("keeps a batch until its expiry", () => {
    const result = replayTcoins([{ coins: 100, at: day(0), expiresAt: day(30) }], [], day(29));
    expect(result.balance).toBe(100);
    expect(result.lots).toEqual([{ coins: 100, expiresAt: day(30) }]);
  });

  it("spends the batch that expires soonest first", () => {
    const result = replayTcoins(
      [
        { coins: 50, at: day(0), expiresAt: day(60) },
        { coins: 30, at: day(1), expiresAt: day(10) },
      ],
      [{ coins: 40, at: day(2) }],
      day(20)
    );
    // 30 from the short batch, 10 from the long one; nothing left to expire on day 10.
    expect(result.balance).toBe(40);
    expect(result.expired).toBe(0);
  });

  it("cannot spend coins that expired before the spend", () => {
    const result = replayTcoins(
      [
        { coins: 30, at: day(0), expiresAt: day(5) },
        { coins: 50, at: day(0), expiresAt: day(60) },
      ],
      [{ coins: 40, at: day(6) }],
      day(7)
    );
    expect(result.expired).toBe(30);
    expect(result.balance).toBe(10);
  });

  it("only counts what is left of a partly spent batch as expired", () => {
    const result = replayTcoins([{ coins: 100, at: day(0), expiresAt: day(30) }], [{ coins: 70, at: day(3) }], day(40));
    expect(result.expired).toBe(30);
    expect(result.balance).toBe(0);
  });

  it("lets the next batch pay off a spend that found too few coins", () => {
    const result = replayTcoins(
      [{ coins: 50, at: day(5), expiresAt: day(40) }],
      [{ coins: 20, at: day(1) }],
      day(10)
    );
    expect(result.balance).toBe(30);
  });

  it("counts a batch that arrives already expired as expired", () => {
    const result = replayTcoins([{ coins: 10, at: day(5), expiresAt: day(4) }], [], day(6));
    expect(result.balance).toBe(0);
    expect(result.expired).toBe(10);
  });
});

describe("parseTcoinsConfig expiryDays", () => {
  it("defaults to 30 days and keeps at least one", () => {
    expect(parseTcoinsConfig(null).expiryDays).toBe(30);
    expect(parseTcoinsConfig(JSON.stringify({ expiryDays: 45 })).expiryDays).toBe(45);
    expect(parseTcoinsConfig(JSON.stringify({ expiryDays: 0 })).expiryDays).toBe(1);
  });
});
