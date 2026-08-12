import { jsPDF } from 'jspdf';
import { db } from '../db';

/**
 * Converts an SVG element to a high-resolution PNG Data URL with inlined computed styles.
 */
export const svgToDataUrl = (
  svgElement: SVGElement,
  width = 600,
  height = 1200
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const clone = svgElement.cloneNode(true) as SVGElement;
      clone.setAttribute('width', width.toString());
      clone.setAttribute('height', height.toString());

      // Inline computed styles so Tailwind SVG classes render cleanly on canvas
      const origElements = svgElement.querySelectorAll('*');
      const cloneElements = clone.querySelectorAll('*');

      origElements.forEach((origEl, i) => {
        const cloneEl = cloneElements[i] as HTMLElement | SVGElement;
        if (cloneEl && origEl) {
          const style = window.getComputedStyle(origEl);
          if (style.fill && style.fill !== 'none') cloneEl.setAttribute('fill', style.fill);
          if (style.stroke && style.stroke !== 'none') cloneEl.setAttribute('stroke', style.stroke);
          if (style.strokeWidth) cloneEl.setAttribute('stroke-width', style.strokeWidth);
          if (style.opacity) cloneEl.setAttribute('opacity', style.opacity);
        }
      });

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clone);

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } else {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context unavailable'));
        }
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Downloads an SVG element directly as a PNG image file.
 */
export const downloadCanvasImage = async (
  svgElement: SVGElement,
  filename = 'osteomap_skeleton.png'
) => {
  const dataUrl = await svgToDataUrl(svgElement, 800, 1600);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Generates and downloads a complete OsteoMap PDF Field Recording Report.
 */
export const exportPDFReport = async (
  skeletonId: number,
  frontSvg?: SVGElement | null,
  backSvg?: SVGElement | null
) => {
  const skeleton = await db.skeletons.get(skeletonId);
  if (!skeleton) throw new Error('Skeleton not found');

  const context = await db.contexts.get(skeleton.contextId);
  const site = context ? await db.sites.get(context.siteId) : null;
  const observations = await db.observations.where({ skeletonId }).toArray();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Colors
  const darkBlue: [number, number, number] = [30, 58, 138];
  const lightGray: [number, number, number] = [243, 244, 246];
  const borderGray: [number, number, number] = [229, 231, 235];
  const textDark: [number, number, number] = [31, 41, 55];

  // --- HEADER BANNER ---
  doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('OsteoMap Bioarchaeology Field Recording Sheet', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(219, 234, 254);
  doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 20);

  // --- CASE & SITE METADATA BOX ---
  let y = 32;
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(14, y, pageWidth - 28, 28, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.rect(14, y, pageWidth - 28, 28, 'S');

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(10);

  // Col 1
  doc.setFont('helvetica', 'bold');
  doc.text('Site Code:', 18, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(site?.siteCode || 'N/A', 42, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('Context Code:', 18, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(context?.contextCode || 'N/A', 48, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.text('Skeleton Code:', 18, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(skeleton.skeletonCode || 'N/A', 50, y + 24);

  // Col 2
  doc.setFont('helvetica', 'bold');
  doc.text('Age Group:', 105, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(skeleton.ageGroup || 'Adult', 132, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('Biological Sex:', 105, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(skeleton.biologicalSex || 'Indeterminate', 137, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.text('Recorded Date:', 105, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(skeleton.date ? new Date(skeleton.date).toLocaleDateString() : 'N/A', 137, y + 24);

  // --- PRESERVATION STATS METRICS ---
  y += 34;

  const totalPossible = 24;
  const completeCount = observations.filter((o) => o.state === 'complete').length;
  const fragCount = observations.filter((o) => o.state === 'fragmentary').length;
  const absentCount = observations.filter((o) => o.state === 'absent').length;
  const completenessIndex = Math.round(((completeCount + fragCount) / totalPossible) * 100);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Preservation & Completeness Summary', 14, y);

  y += 4;
  const boxW = (pageWidth - 28 - 9) / 4;

  const drawMetricBox = (xPos: number, title: string, value: string, color: [number, number, number]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(xPos, y, boxW, 16, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(xPos, y, boxW, 16, 'S');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text(title.toUpperCase(), xPos + boxW / 2, y + 5, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(value, xPos + boxW / 2, y + 12, { align: 'center' });
  };

  drawMetricBox(14, 'Completeness', `${completenessIndex}%`, [239, 246, 255]);
  drawMetricBox(14 + boxW + 3, 'Complete', `${completeCount}`, [240, 253, 244]);
  drawMetricBox(14 + (boxW + 3) * 2, 'Fragmentary', `${fragCount}`, [254, 252, 232]);
  drawMetricBox(14 + (boxW + 3) * 3, 'Absent', `${absentCount}`, [249, 250, 251]);

  // --- EMBEDDED DIAGRAMS ---
  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('Skeletal Diagram Mapping', 14, y);

  y += 4;
  const diagW = 70;
  const diagH = 140;

  if (frontSvg) {
    try {
      const frontDataUrl = await svgToDataUrl(frontSvg, 400, 800);
      doc.addImage(frontDataUrl, 'PNG', 20, y, diagW, diagH);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Anterior (Front View)', 20 + diagW / 2, y + diagH + 5, { align: 'center' });
    } catch (e) {
      console.error('Error rendering front SVG for PDF', e);
    }
  }

  if (backSvg) {
    try {
      const backDataUrl = await svgToDataUrl(backSvg, 400, 800);
      doc.addImage(backDataUrl, 'PNG', pageWidth - 20 - diagW, y, diagW, diagH);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Posterior (Back View)', pageWidth - 20 - diagW / 2, y + diagH + 5, { align: 'center' });
    } catch (e) {
      console.error('Error rendering back SVG for PDF', e);
    }
  }

  // --- PAGE 2: BONE INVENTORY TABLE ---
  doc.addPage();
  let page2Y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  doc.text(`Bone Inventory Record (${skeleton.skeletonCode})`, 14, page2Y);

  page2Y += 8;

  // Table Header
  doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  doc.rect(14, page2Y, pageWidth - 28, 8, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Bone Element ID', 18, page2Y + 5.5);
  doc.text('Side', 95, page2Y + 5.5);
  doc.text('Status / Observation State', 140, page2Y + 5.5);

  page2Y += 8;

  if (observations.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('No bone observations recorded for this skeleton yet.', 18, page2Y + 8);
  } else {
    observations.forEach((obs, index) => {
      if (page2Y > pageHeight - 20) {
        doc.addPage();
        page2Y = 20;
      }

      const bg = index % 2 === 0 ? lightGray : [255, 255, 255];
      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.rect(14, page2Y, pageWidth - 28, 7, 'F');
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.rect(14, page2Y, pageWidth - 28, 7, 'S');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);

      doc.text(obs.boneId, 18, page2Y + 4.8);
      doc.text(obs.side ? obs.side.toUpperCase() : 'MIDLINE / N/A', 95, page2Y + 4.8);

      let stateLabel = obs.state.toUpperCase();
      if (obs.state === 'complete') doc.setTextColor(22, 101, 52);
      else if (obs.state === 'fragmentary') doc.setTextColor(161, 98, 7);
      else doc.setTextColor(156, 163, 175);

      doc.setFont('helvetica', 'bold');
      doc.text(stateLabel, 140, page2Y + 4.8);

      page2Y += 7;
    });
  }

  doc.save(`OsteoMap_${skeleton.skeletonCode}_Report.pdf`);
};
