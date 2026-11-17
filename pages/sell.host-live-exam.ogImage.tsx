import type { OgImageProps } from "@floot/prefetch";

export const alt =
  "Host live mock test contests on Testkart: a live leaderboard with a countdown timer and prize pool";

const INK = "#202a3b";
const TEXT = "#3d4757";
const MUTED = "#697386";
const BG = "#f4f1ea";
const SURFACE = "#ffffff";
const LINE = "#e2ddd2";
const SAGE_TINT = "#e2ecd9";
const SAGE_LINE = "#bfd0b0";
const SAGE_INK = "#2b4a24";
const BUTTER = "#fff3cf";
const BUTTER_DEEP = "#f0d98c";
const BUTTER_INK = "#5c3d0a";

const ROWS = [
  { rank: "1", name: "Aarav Sharma", score: "186", you: false },
  { rank: "2", name: "Diya Kulkarni", score: "181", you: false },
  { rank: "3", name: "You", score: "178", you: true },
  { rank: "4", name: "Rohan Mehta", score: "174", you: false },
];

/* Fixed card for /sell/host-live-exam: headline on the left, contest leaderboard on the right. */
export default function OgImage(_props: OgImageProps) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: 64,
        background: BG,
        color: INK,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 560, paddingRight: 40 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "8px 18px",
              borderRadius: 999,
              background: SAGE_TINT,
              border: `2px solid ${SAGE_LINE}`,
              color: SAGE_INK,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            For teachers
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 60, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>
            Host Live Mock Test Contests Online
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 26, lineHeight: 1.45, color: TEXT }}>
            Leaderboards, prize pools and automated prize payouts.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 800 }}>
          <div
            style={{
              display: "flex",
              width: 18,
              height: 18,
              marginRight: 14,
              borderRadius: 999,
              background: SAGE_LINE,
              border: `3px solid ${SAGE_INK}`,
            }}
          />
          Testkart
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          borderRadius: 28,
          background: SAGE_TINT,
          border: `2px solid ${SAGE_LINE}`,
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            borderRadius: 20,
            background: SURFACE,
            border: `2px solid ${LINE}`,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", padding: "18px 22px", borderBottom: `2px solid ${LINE}` }}>
            <div
              style={{
                display: "flex",
                padding: "6px 12px",
                borderRadius: 999,
                background: "#fbe3e5",
                color: "#8a2330",
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              LIVE
            </div>
            <div style={{ display: "flex", marginLeft: 14, fontSize: 22, fontWeight: 800 }}>SSC CGL Mock</div>
            <div
              style={{
                display: "flex",
                marginLeft: "auto",
                padding: "6px 12px",
                borderRadius: 999,
                background: BUTTER,
                border: `2px solid ${BUTTER_DEEP}`,
                color: BUTTER_INK,
                fontSize: 17,
                fontWeight: 800,
              }}
            >
              ₹5,000 pool
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", padding: "14px 22px", background: BG, borderBottom: `2px solid ${LINE}` }}>
            <div style={{ display: "flex", fontSize: 16, fontWeight: 700, color: MUTED, letterSpacing: 1 }}>ENDS IN</div>
            {["00", "42", "18"].map((part, index) => (
              <div key={part} style={{ display: "flex", alignItems: "center" }}>
                {index > 0 && <div style={{ display: "flex", margin: "0 4px", fontSize: 20, fontWeight: 800, color: MUTED }}>:</div>}
                <div
                  style={{
                    display: "flex",
                    marginLeft: index === 0 ? 14 : 0,
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: INK,
                    color: BG,
                    fontSize: 22,
                    fontWeight: 800,
                  }}
                >
                  {part}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", padding: "12px 16px" }}>
            {ROWS.map((row) => (
              <div
                key={row.rank}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 12px",
                  marginTop: 4,
                  borderRadius: 12,
                  background: row.you ? SAGE_TINT : SURFACE,
                  border: `2px solid ${row.you ? SAGE_LINE : SURFACE}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    background: row.rank === "1" ? BUTTER_DEEP : BG,
                    color: INK,
                    fontSize: 17,
                    fontWeight: 800,
                  }}
                >
                  {row.rank}
                </div>
                <div style={{ display: "flex", marginLeft: 14, fontSize: 20, fontWeight: 700, color: row.you ? SAGE_INK : TEXT }}>
                  {row.name}
                </div>
                <div style={{ display: "flex", marginLeft: "auto", fontSize: 20, fontWeight: 800 }}>
                  {row.score}
                  <span style={{ marginLeft: 2, fontSize: 15, fontWeight: 600, color: MUTED }}>/200</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
