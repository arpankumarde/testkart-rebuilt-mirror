import { TDocumentDefinitions } from "pdfmake/interfaces";
import { CertificateData } from "./certificateTypes";
import PdfPrinter from "pdfmake";

let cachedFonts: any = null;

async function getFonts() {
  if (cachedFonts) return cachedFonts;

  const [normal, bold, italics, bolditalics] = await Promise.all([
    fetch("https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf").then(r => r.arrayBuffer()),
    fetch("https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9vAw.ttf").then(r => r.arrayBuffer()),
    fetch("https://fonts.gstatic.com/s/roboto/v30/KFOkCnqEu92Fr1Mu52xP.ttf").then(r => r.arrayBuffer()),
    fetch("https://fonts.gstatic.com/s/roboto/v30/KFOjCnqEu92Fr1Mu51S7ABc9.ttf").then(r => r.arrayBuffer()),
  ]);

  cachedFonts = {
    Roboto: {
      normal: Buffer.from(normal),
      bold: Buffer.from(bold),
      italics: Buffer.from(italics),
      bolditalics: Buffer.from(bolditalics),
    }
  };

  return cachedFonts;
}

export async function generateCertificatePdf(
  data: CertificateData
): Promise<Blob> {
  const completionDate = new Date(data.completionDate);
  
  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [40, 60, 40, 60],
    background: function () {
      return {
        canvas: [
          {
            type: "rect",
            x: 10, y: 10, w: 822, h: 575,
            lineWidth: 2,
            lineColor: '#0056b3',
            r: 10,
          },
          {
            type: "rect",
            x: 15, y: 15, w: 812, h: 565,
            lineWidth: 1,
            lineColor: '#0056b3',
            r: 8,
          },
        ],
      };
    },
    content: [
      {
        text: "Certificate of Completion",
        style: "header",
        alignment: "center" as const,
        margin: [0, 20, 0, 20] as [number, number, number, number],
      },
      {
        text: "This certificate is proudly presented to",
        style: "subheader",
        alignment: "center" as const,
        margin: [0, 20, 0, 20] as [number, number, number, number],
      },
      {
        text: data.studentName,
        style: "studentName",
        alignment: "center" as const,
        margin: [0, 10, 0, 10] as [number, number, number, number],
      },
      {
        text: `For successfully completing the ${data.type === 'course_completion' ? 'course' : 'test'}`,
        style: "subheader",
        alignment: "center" as const,
        margin: [0, 20, 0, 5] as [number, number, number, number],
      },
      {
        text: data.itemName,
        style: "itemName",
        alignment: "center" as const,
        margin: [0, 5, 0, 20] as [number, number, number, number],
      },
      ...(data.type === 'test_completion' ? [{
        text: `With a score of ${data.score.toFixed(2)}%`,
        style: "subheader",
        alignment: "center" as const,
        margin: [0, 5, 0, 20] as [number, number, number, number],
      }] : []),
      {
        columns: [
          {
            stack: [
              { text: "____________________", style: "signatureLine" },
              { text: data.teacherName, style: "signatureName" },
              { text: "Instructor", style: "signatureTitle" },
            ],
            width: "*",
            alignment: "center" as const,
          },
          {
            stack: [
              { text: "____________________", style: "signatureLine" },
              { text: "Testkart Platform", style: "signatureName" },
              { text: "Authorized Signature", style: "signatureTitle" },
            ],
            width: "*",
            alignment: "center" as const,
          },
        ],
        margin: [0, 40, 0, 10] as [number, number, number, number],
      },
      {
        columns: [
            {
                text: `Date: ${completionDate.toLocaleDateString("en-GB")}`,
                style: "footerText",
                alignment: "left" as const,
                width: '*'
            },
            {
                text: `Certificate No: ${data.certificateNumber}`,
                style: "footerText",
                alignment: "right" as const,
                width: '*'
            }
        ],
        absolutePosition: { x: 40, y: 520 }
      }
    ],
    styles: {
      header: {
        fontSize: 36,
        bold: true,
        color: "#003366",
      },
      subheader: {
        fontSize: 16,
        italics: true,
        color: "#333333",
      },
      studentName: {
        fontSize: 48,
        bold: true,
        color: "#0056b3",
      },
      itemName: {
        fontSize: 24,
        bold: true,
        color: "#333333",
      },
      signatureLine: {
        margin: [0, 0, 0, 5] as [number, number, number, number],
      },
      signatureName: {
        fontSize: 14,
        bold: true,
      },
      signatureTitle: {
        fontSize: 12,
        italics: true,
      },
      footerText: {
        fontSize: 10,
        color: "#666666",
      },
    },
    defaultStyle: {
      font: "Roboto",
    },
  };

  const fonts = await getFonts();

  const printer = new PdfPrinter(fonts);

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks: Uint8Array[] = [];
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve(new Blob([result], { type: 'application/pdf' }));
      });
      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
}