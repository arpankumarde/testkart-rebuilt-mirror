import { Canvas, Section, Frame } from "@floot/design";
import { CheckoutScreen, DesignExampleCard, StartCanvasPanel } from "../components/CanvasExamples";

/*
 * Explorations
 *
 * A worked example to start from: one checkout screen in three materials —
 * glassmorphism, neumorphism and liquid glass. It is real, interactive UI:
 * switch to Interact, type in the fields, press Pay. Replace it with your
 * own screens whenever you like.
 */
export function Explorations() {
  return (
    <Canvas>
      <Section title="Example screens" tight>
        <Frame id="start-here" title="Start here" hideTitle width={460} height={900}>
          <DesignExampleCard />
        </Frame>
        <Frame id="style-glass" title="Glassmorphism" hideTitle width={460} height={900}>
          <CheckoutScreen direction="glass" />
        </Frame>
        <Frame id="style-neu" title="Neumorphism" hideTitle width={460} height={900}>
          <CheckoutScreen direction="neu" />
        </Frame>
        <Frame id="style-liquid" title="Liquid Glass" hideTitle width={460} height={900}>
          <CheckoutScreen direction="liquid" />
        </Frame>
        <Frame id="your-design" title="Your design" hideTitle width={300} height={900}>
          <StartCanvasPanel />
        </Frame>
      </Section>
    </Canvas>
  );
}
