import { jsPDF } from "jspdf";
import { getCase } from "./caseOperation";
import { getContextById } from "./contextOperation";
import { getSiteById } from "./siteOperation";
import type { SegmentState } from "./types";
import { markedElements } from "../pages/segmentMarks";
import { VERTEBRA_DRAWINGS, summariseZones, zoneStandIns, type ZoneSummary } from "../pages/skeletonArtwork";
import {
    hierarchy,
    leftFoot,
    leftHip,
    ribsSpineFront,
    rightFoot,
    rightHip,
    scapulaLeft,
    scapulaRight,
    skeletonBack,
    skeletonFront,
    skullFront,
    skullLeft,
    skullRight,
    vertebraSvg,
} from "../pages/skeletonDrawings";

// The colours the skeleton page paints with (the --paint-* and --bone-*
// tokens in index.css, light theme). A drawing turned into an image leaves the
// page's stylesheet behind, so the colours are written onto the shapes here.
type Paint = { fill: string; edge: string };

const PAINT: Record<ZoneSummary, Paint> = {
    complete: { fill: "#34d399", edge: "#047857" },
    absent: { fill: "#f87171", edge: "#b91c1c" },
    fragmentary: { fill: "#60a5fa", edge: "#1d4ed8" },
    partial: { fill: "#c084fc", edge: "#7e22ce" },
};
const UNMARKED: Paint = { fill: "#e2e8f0", edge: "#94a3b8" };

// What each colour means, as the skeleton page's colour key has it, less the
// entry for drawings that open on a tap.
export const PDF_COLOUR_KEY: { name: string; paint: Paint; meaning: string }[] = [
    { name: "Present", paint: PAINT.complete, meaning: "Marked as present." },
    { name: "Absent", paint: PAINT.absent, meaning: "Marked as absent." },
    { name: "Fragmentary", paint: PAINT.fragmentary, meaning: "Marked as fragmentary." },
    {
        name: "Partly recorded",
        paint: PAINT.partial,
        meaning: "Only some of the bone's zones are marked; its own drawing shows which.",
    },
    { name: "Not marked", paint: UNMARKED, meaning: "Nothing recorded for this bone or zone." },
];

const SHAPES = "path, polygon, circle, ellipse, rect, line, polyline";

function paintShapes(element: Element, paint: Paint, opacity = 1) {
    const shapes = element.matches(SHAPES) ? [element] : [...element.querySelectorAll(SHAPES)];
    for (const shape of shapes) {
        shape.setAttribute("style", `fill:${paint.fill};stroke:${paint.edge};fill-opacity:${opacity}`);
    }
}

// Paints a drawing from the record the way the skeleton page does: greyed out
// unless marked, marks in their own colour, and bones drawn only whole showing
// what their zones add up to. Returns the painted markup and whether anything
// on it is marked at all.
export function paintDrawing(markup: string, states: Record<string, SegmentState>): { markup: string; marked: boolean } {
    const svg = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
    paintShapes(svg, UNMARKED, 0.7);

    const marked = markedElements(hierarchy(), svg, states);
    for (const { element, state } of marked) paintShapes(element, PAINT[state]);

    let summarised = false;
    for (const [boneId, summary] of summariseZones(states)) {
        for (const element of zoneStandIns(svg, boneId)) {
            if (marked.some((entry) => entry.element.contains(element))) continue;
            paintShapes(element, PAINT[summary]);
            summarised = true;
        }
    }

    return { markup: new XMLSerializer().serializeToString(svg), marked: marked.length > 0 || summarised };
}

type View = { title: string; markup: string };

// The full skeleton front and back always, then every detail drawing with
// something marked on it, head to toe.
function viewsFor(states: Record<string, SegmentState>): { main: View[]; details: View[] } {
    const paint = (title: string, markup: string) => ({ title, ...paintDrawing(markup, states) });

    const main = [paint("Skeleton (front)", skeletonFront), paint("Skeleton (back)", skeletonBack)];

    const vertebrae = VERTEBRA_DRAWINGS.flatMap(({ count, prefix, type }) =>
        Array.from({ length: count }, (_, index) => {
            const id = `${prefix}${index + 1}`;
            const label = `${type} vertebra ${id.slice("vertebra_".length).toUpperCase()}`;
            return paint(label, vertebraSvg(id) ?? "");
        }),
    );

    const details = [
        paint("Skull (front)", skullFront),
        paint("Skull (left)", skullLeft),
        paint("Skull (right)", skullRight),
        paint("Spine and ribs", ribsSpineFront),
        ...vertebrae,
        paint("Left scapula", scapulaLeft),
        paint("Right scapula", scapulaRight),
        paint("Left hip bone", leftHip),
        paint("Right hip bone", rightHip),
        paint("Left foot", leftFoot),
        paint("Right foot", rightFoot),
    ].filter((view) => view.marked);

    return { main, details };
}

type Raster = { dataUrl: string; aspect: number };

// Some drawings leave a lot of empty canvas around the bones (the spine and
// ribs most of all), so each view is cropped to what is drawn, with a little
// room around it. Measuring needs the drawing on the page for a moment.
function cropToDrawing(svg: Element) {
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-10000px;top:0;width:1000px;height:1000px;visibility:hidden";
    const measured = document.importNode(svg, true) as SVGSVGElement;
    holder.append(measured);
    document.body.append(holder);
    try {
        const box = measured.getBBox();
        if (!box.width || !box.height) return;
        const pad = Math.max(box.width, box.height) * 0.03;
        svg.setAttribute("viewBox", `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`);
    } finally {
        holder.remove();
    }
}

// Draws the markup onto a white canvas, at a size that stays sharp in print.
async function rasterise(markup: string, longestSide = 1400): Promise<Raster> {
    const svg = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
    cropToDrawing(svg);
    const [, , boxWidth, boxHeight] = (svg.getAttribute("viewBox") ?? "0 0 100 100").split(/[\s,]+/).map(Number);
    const scale = longestSide / Math.max(boxWidth, boxHeight);
    const width = Math.round(boxWidth * scale);
    const height = Math.round(boxHeight * scale);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));

    const url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }),
    );
    try {
        const image = new Image();
        image.src = url;
        await image.decode();

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is not available.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), aspect: width / height };
    } finally {
        URL.revokeObjectURL(url);
    }
}

const capitalised = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : "");

function formatDate(value: string): string {
    const date = new Date(value);
    return value && !Number.isNaN(date.getTime()) ? date.toLocaleString() : value || "N/A";
}

// A4 portrait, in millimetres.
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * Builds and downloads one specimen's report: its site, context and details,
 * field notes, the colour key, and every view of the skeleton painted from its
 * record.
 */
export async function exportCasePDF(caseId: string): Promise<void> {
    const caseRecord = await getCase(caseId);
    if (!caseRecord) throw new Error("Specimen not found.");
    const context = await getContextById(caseRecord.contextId);
    const site = context ? await getSiteById(context.siteId) : undefined;

    const states = caseRecord.segmentStates ?? {};
    const { main, details } = viewsFor(states);
    const [mainImages, detailImages] = await Promise.all([
        Promise.all(main.map((view) => rasterise(view.markup))),
        Promise.all(details.map((view) => rasterise(view.markup, 900))),
    ]);

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = MARGIN;

    // Starts a new page when the next `height` mm won't fit on this one.
    const ensureSpace = (height: number) => {
        if (y + height > PAGE_HEIGHT - MARGIN) {
            doc.addPage();
            y = MARGIN;
        }
    };

    const heading = (text: string) => {
        ensureSpace(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text(text, MARGIN, y + 5);
        doc.setDrawColor(203, 213, 225);
        doc.line(MARGIN, y + 7, PAGE_WIDTH - MARGIN, y + 7);
        y += 11;
    };

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text("OsteoMap Skeletal Inventory", MARGIN, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Exported ${new Date().toLocaleString()}`, MARGIN, y + 12);
    y += 20;

    // Case details
    heading("Specimen");
    const rows: [string, string][] = [
        ["Site", site?.siteName || "N/A"],
        ["Context", context?.contextName || "N/A"],
        ["Skeleton ID", caseRecord.caseName || "N/A"],
        ["Sex", capitalised(caseRecord.sex) || "N/A"],
        ["Age group", capitalised(caseRecord.ageGroup) || "N/A"],
        ["Date created", formatDate(caseRecord.dateCreated)],
        ["Date modified", formatDate(caseRecord.dateModified)],
        ["Bones and zones recorded", String(Object.keys(states).length)],
    ];
    doc.setFontSize(10.5);
    for (const [label, value] of rows) {
        const lines = doc.splitTextToSize(value, CONTENT_WIDTH - 55) as string[];
        ensureSpace(lines.length * 5 + 1.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105);
        doc.text(label, MARGIN, y + 4);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        doc.text(lines, MARGIN + 55, y + 4);
        y += lines.length * 5 + 1.5;
    }
    y += 4;

    // Field notes, carried over onto further pages if they run long
    heading("Field notes");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    const notes = caseRecord.fieldNotes?.trim() || "No field notes recorded.";
    for (const line of doc.splitTextToSize(notes, CONTENT_WIDTH) as string[]) {
        ensureSpace(5);
        doc.text(line, MARGIN, y + 4);
        y += 5;
    }
    y += 4;

    // Colour key
    heading("Colour key");
    doc.setFontSize(10);
    for (const { name, paint, meaning } of PDF_COLOUR_KEY) {
        ensureSpace(7);
        doc.setFillColor(paint.fill);
        doc.setDrawColor(paint.edge);
        doc.rect(MARGIN, y + 0.8, 5, 5, "FD");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(name, MARGIN + 8, y + 4.6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(meaning, MARGIN + 42, y + 4.6);
        y += 7;
    }

    // Front and back of the full skeleton, side by side on a page of their own
    doc.addPage();
    y = MARGIN;
    heading("Full skeleton");
    placeGrid(doc, main, mainImages, 2, PAGE_HEIGHT - MARGIN - y - 8, () => y, (next) => (y = next));

    // Detail drawings with something marked, three to a row
    if (details.length) {
        doc.addPage();
        y = MARGIN;
        heading("Detail views");
        placeGrid(doc, details, detailImages, 3, 75, () => y, (next) => (y = next));
    }

    doc.save(`osteomap_case_${caseRecord.caseName || caseRecord.caseId}.pdf`);
}

// Lays the images out in rows of `columns`, each fitted into its cell and
// titled underneath, starting a new page when a row won't fit.
function placeGrid(
    doc: jsPDF,
    views: View[],
    images: Raster[],
    columns: number,
    cellHeight: number,
    getY: () => number,
    setY: (y: number) => void,
) {
    const gap = 6;
    const cellWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
    const rowHeight = cellHeight + 8;

    for (let start = 0; start < views.length; start += columns) {
        if (getY() + rowHeight > PAGE_HEIGHT - MARGIN) {
            doc.addPage();
            setY(MARGIN);
        }
        const top = getY();

        views.slice(start, start + columns).forEach((view, offset) => {
            const { dataUrl, aspect } = images[start + offset];
            const width = Math.min(cellWidth, cellHeight * aspect);
            const height = width / aspect;
            const left = MARGIN + offset * (cellWidth + gap);
            doc.addImage(dataUrl, "JPEG", left + (cellWidth - width) / 2, top + (cellHeight - height) / 2, width, height);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(51, 65, 85);
            doc.text(view.title, left + cellWidth / 2, top + cellHeight + 5, { align: "center" });
        });

        setY(top + rowHeight);
    }
}
