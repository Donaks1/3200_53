## Team 53 — 3200_53
## Meeting 5 - First Client Meeting
**Date:** Tuesday, August 4th 2026
**Scheduled time:** 9:00 am
**Location:** Social Sciences 352 Room 1.21

**Chair:** Andoni
**Minute takers:** Evan and Thisen

**Attendees:** James, Andoni, Evan, Thisen, Tinashe, Ambika Flavel, Gabriella
**Apologies:** 
**Absent:** Shakeel 

## Discussion

### Data Hierarchy

The client outlined the following data structure for the application:

* **Site code** (e.g. UWA) — enforce alphanumeric input
* **Context** (building/room, one-to-many relationship)
* **Skeleton** (multiple bodies per context)
* **Bone**
* **Zone**

The combination of site, context, and skeleton should be unique.

### SVG Availability and Age Groups

Sourcing age-appropriate SVGs is difficult. The team and client agreed to focus exclusively on adult skeletons for the MVP. An adult male SVG was confirmed as suitable. Gender will be stored as metadata. Support for children and adolescents is deferred to future development.

### Bone Segmentation

Long bones must be segmented into three distinct SVG parts:

* Top epiphysis
* Diaphysis (shaft)
* Bottom epiphysis

### Front and Back Views

Both anterior (front) and posterior (back) views are required. The back view must specifically highlight the spine, posterior skull, and scapulae. Limb mapping transfers directly from the front view.

The skull requires full front, side, and back representations.

### Small Bones (Hands, Wrists, Feet, Ankles)

Each individual small bone must be separately selectable. A click-to-zoom interaction (preferred over pinch-to-zoom) will be implemented to allow selection in these complex areas.

### Search Bar

A search function will be included to allow users to locate specific bones by name, particularly useful for hard-to-find small bones.

### Bone State Categories

The following bone states were discussed:

* **Complete** — bone is fully present
* **Fragmentary** — only pieces are present
* **Absent** — bone is missing

The following states were discussed but deferred for now:

* Precise identification / side unknown
* Highly crushed or distorted
* Tooth found isolated

The team will start with complete, absent, and fragmentary, and add additional states later. Patterns or textures must be included for colour-blind accessibility, not just colour.

### Left and Right Differentiation

Left and right sides must be clearly distinguished in both the visual UI display and the search/list functionality.

### Vertebrae and Ribs

Vertebrae do not count for MNI (except the first or second cervical). It does not matter which specific vertebra is coloured — it is purely visual. Ribs are one-sided and sometimes the side cannot be determined. The application should simply record how many ribs are present.

### Colour Coding Standards

No established standards exist. The only requirement is clearly distinguishable colours with no confusing shades. The final colour palette selection is deferred.

### In-App Notes and Annotations

Deferred. Notes are considered low priority and unnecessary for the MVP. The application will strictly focus on core colour-coding functionality.

### Allow Bulk Colouring

The application should allow users to colour all bones at once.

### Export Requirements

The application must support the following export formats:

* **CSV** — for data archival and Excel-based statistical analysis
* **JPEG** — visual representation of the skeleton
* **PDF** — visual representation of the skeleton

### CSV Re-import

No permanent local storage is required; export is the primary persistence method. The application must support CSV re-import to reconstruct and visualise previous cases. This enables external data archival, legacy data integration, and Excel-based statistical analysis.

### MVP Definition

The core scope for the MVP includes:

* Colour-coding of bone states on an adult skeleton (front and back views)
* Image export (JPEG and PDF)
* CSV export
* CSV re-import
* Undo and redo functionality
* Left and right differentiation for bilateral bones

## Client Contact Information

* **Primary contact:** Gabriella
* **Availability:** Monday to Thursday, 8:00 am – 4:00 pm
* **Location:** Room 2.37, Social Sciences Building
* **Future meetings:** As needed, if beneficial

## Action Items

* The team will begin work on the MVP based on the agreed scope.
* The team will source an appropriate adult male skeletal SVG.
* The team will design the front and back skeletal views with segmented long bones.

## Next Meeting

To be confirmed.
