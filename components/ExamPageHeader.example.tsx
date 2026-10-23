import { Example } from "@floot/examples";
import { Share2, Printer } from "lucide-react";
import { ExamPageHeader } from "./ExamPageHeader";
import { ExamProductTabs } from "./ExamPageNav";
import { Button } from "./Button";

const actions = (
  <>
    <Button variant="outline" size="sm">
      <Share2 size={18} />
      Share
    </Button>
    <Button variant="outline" size="sm">
      <Printer size={18} />
      Print
    </Button>
  </>
);

export default function Showcase() {
  return (
    <>
      <h1>ExamPageHeader</h1>
      <p>
        The header card on every exam page: category badge, title, description, Share/Print and the product tabs
        attached underneath. While an Important Links section loads, the badge and tabs stay and the title,
        description and actions become skeletons the same size as the real ones.
      </p>

      <h2>Section page</h2>
      <Example title="Loaded section" fullBleed>
        <ExamPageHeader
          badge="SSC Exams"
          title="Staff Selection Commission Combined Graduate Level Syllabus"
          actions={actions}
          tabs={<ExamProductTabs examSlug="ssc-cgl" currentSlug={null} />}
        />
      </Example>
      <Example title="Loading section" fullBleed>
        <ExamPageHeader
          badge="SSC Exams"
          title=""
          loading
          tabs={<ExamProductTabs examSlug="ssc-cgl" currentSlug={null} />}
        />
      </Example>

      <h2>Exam hub</h2>
      <Example title="Loaded hub" fullBleed>
        <ExamPageHeader
          badge="SSC Exams"
          title="SSC CGL 2026: Overview, Syllabus, Latest Updates, Mock Tests & Other Resources"
          description="The SSC CGL (Staff Selection Commission – Combined Graduate Level) Examination is a national-level competitive exam conducted annually in India."
          actions={actions}
          tabs={<ExamProductTabs examSlug="ssc-cgl" currentSlug={null} />}
        />
      </Example>
      <Example title="Loading hub" fullBleed>
        <ExamPageHeader
          badge="SSC Exams"
          title=""
          loading
          loadingDescription
          tabs={<ExamProductTabs examSlug="ssc-cgl" currentSlug={null} />}
        />
      </Example>
    </>
  );
}
