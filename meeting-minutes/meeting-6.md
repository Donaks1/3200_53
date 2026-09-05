## Team 53 — 3200_53
## Meeting 6 - Discussing tasks needed to be done
**Date:** Saturday, August 6rd 2026
**Scheduled time:** 1:00pm
**Meeting opened:** 1:03 pm
**Meeting closed:** 3:05 pm

**Chair:** James
**Minute taker:** Andoni

**Attendees:** James, Andoni, Evan, Shakeel, Thisen and Tinashe
**Apologies:** None
**Absent:** None

## Individual Reports

### James

* Wrote down user stories for the team sprint
* Researched and developed an implementation of the tech stack
* Drafted introductory email for the auditor

### Andoni

* Continued to prepare the skeletal SVGs in adobe Illustrator, dividing each bone into svg zones
* Prepared questions for next client interaction regarding specific bone divisions (e.g. in hands, vertebrae)
* Researched whether it is feasible to begin software development before svg is ready and then place completed svg in afterwards
* Assisted in drafting introductory email to auditor

### Evan

* Prepared and submitted meeting minutes to the project Githup repository.

### Shakeel

* Planning of the project's acceptance tests by reviewing the requirements and identifying potential areas of functionality that should be tested

### Thisen

* Researched on finding Skeletal SVG Images
* Researched on whether or not IndexedDB is appropriate for the project

### Tinashe

* Researched on ways to generate csv file from data input.
* Researched on Risk register and prepared the draft. 

## Tech Stack Discussion
* James researched tech stack options
* Different layers we are working with is front end framework
* Need something that supports plugin for progressive web app functionality
* PWA engine???
* Database - IndexedDB?
* Tool to allow us to zoom/pan etc. on SVG
* Tool to export to csv, import etc.

**Front End**
* React w/ vite
* Vite has dedicated PWA plugin

**Styling**
* Tailwind CSS

**Database**
* Dexi?.js
* Wrapper for IndexedDB

**Interacting, Clicking, Zooming SVG**
* PanZoom

**Export Logic**
* File-Saver JS
* Allows export to CSV / PDF

## Official Requirements
1. Needs to be a mobile progressive web application
2. Needs to have offline storage, as permanent as possible
3. Needs to be able to import and export cases (CSV, PDF) - PDF should include image, case, context, specimen, optional extras TBC
4. Need to be able to categorise bone zone as either complete, absent, fragmentary
5. Clicking on a bone zone should allow user to change state as well as associated colour
6. Clicking on the skull, pelvis, spine or scapula will display a different SVG with higher fidelity, allowing the user to select more specific bone zones
7. Skeletal SVG needs to be divided into clickable areas called bone zones, as defined by the zonation method (Fragmentation: The Zonation Fragmented Human Remains and Forensic Contexts) 
8. Needs to have a front and rear view of skeleton
9. Skeletal SVG needs to have pan and zoom capability
10. Needs to have home page which manages unique sites, contexts and skeletons. Every skeleton needs to be uniquely identifiable
11. "Select all" feature selects every bone in skeleton and can apply specific state. Each bone should have an option to select full bone, rather than individual bone zones. Likely will use a bottom pop-up tab to select state. One click to select whole bone, another to select specific zones?
12. Undo/Redo buttons on bottom task bar for convenience - will need to keep track of last 10 or so actions
13. Ability to delete/edit existing site, contexts, skeletons - Delete, rename, edit skeleton.
14. When creating new site/context/skeleton, ability to add metadata in form - site code, context, skeleton ID, age, sex, notes

**Extensions**
1. Colour-blind friendly
2. Side-unknown?

## Sprint Deliverables Assignment
* Scope of work - Andoni
* Skills and resources audit - Evan
* Stories - James
* Risk Register - Tinashe
* Project Acceptance Tests - Shakeel & Thisen 


## Requirements Requiring Clarification from last meeting
* Do all finger bones need to be subdivided or only thumb and index?

## Action Items
Everyone: 
* Upload booked hours to discord channel by Saturday night
* Work on Sprint 1 deliverables and submit to group ASAP
* As soon as Sprint 1 deliverables are complete, begin coding
* 
Andoni:
* Continue developing skeleton svg, send minimum viable product when ready.
* Send through HTML draft

James:
* Drafting email to client regarding $100 question

## Next Meeting

Time and place TBC
