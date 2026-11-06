# BioBridge

Kenny Nguyen’s independent biology tutoring and visual learning resource.
This website is not affiliated with, sponsored by, or endorsed by Dallas College or its Learning Commons.

## Preview locally

Run `python3 -m http.server 8765` from this folder, then open `http://localhost:8765`.
There is no package installation or build step.

## Hosting

The existing Netlify project is `khn-3dar-rlc`, connected to the `main` branch of `Kaehyuni/final-project-3dar`. Publish the repository root. Keep HTML, CSS, JavaScript, fonts and images together.

The author’s role is Biology/Chemistry/Digital Art Academic Coach.

## Assets and maintenance

- Dallas College colors: blue `#003385`, red `#E52626`, silver `#D6D2C4`.
- Montserrat fonts come from the supplied Dallas College asset kit. The header uses an original BioBridge typographic wordmark, with a red bridge-shaped underline. The Learning Commons logo is not displayed on the website. Keep `fonts/OFL.txt` with the bundled fonts.
- `images/tutoring-banner.mp4` is a compressed, streaming-optimized 960 × 540 H.264 conversion of the supplied MOV, at 30 fps and without an audio track. `images/banner-poster.jpg` provides the still fallback. Banner playback autoplays muted, loops continuously, has no visible playback controls, and automatically retries interrupted playback. Browser or device autoplay/background-playback restrictions can still apply.
- Campus location, phone, and published tutoring hours were checked against the official tutoring page on November 5, 2026. Students should use that linked official page for current schedules. The original Navigate appointment link and biology resource/model destinations are retained.
- Kenny’s email address has been removed from the published pages. The campus Learning Commons contact remains a separate institutional resource.

Official references: [College colors](https://www.dallascollege.edu/about/style/collegecolors/) and [Tutoring services](https://www.dallascollege.edu/resources/tutoring/).

## Interactive release — November 2026

Navigation includes Home, 3D / AR Lab, Study Resources, Handouts, Tutoring & Contact, References, and Credits. Links that navigate to another page open a new tab; lesson controls and same-page anchors remain in place.

### Cell and AR lesson

`cell.html` loads independently authored, procedural Three.js geometry with fourteen selectable cell-part groups. Features include cutaway/isolation, rotation and zoom, light intensity/direction/color/presets, ten structure/function questions, typed labels, surface drawing, circle annotations, keyboard buttons, and contextual BridgeAssist. A semantic part list and text activities remain usable without a camera; the explanatory text remains available if WebGL fails.

Camera AR uses MindAR image tracking with the same model and controls. It is not world-plane tracking or a native Quick Look/Scene Viewer handoff. Print `handouts/cell-target-print.pdf`, open the QR lesson on a phone over HTTPS, then choose **Start camera AR**. The cell target was compiled from the original `handouts/cell-target.png`; its `.mind` file is bundled. Camera frames are processed locally and are neither recorded nor uploaded by this application. Stop AR or leave the page to release the camera. Browser permission and compatible camera/WebGL support are required.

The schematic simplifies geometry, size, counts, and arrangement; it is not a quantitative cell reconstruction. Lighting adjusts rendered illumination, not biological properties. Circles/drawings are annotations, not automated spatial grading. Practice state is held only in memory for the current tab. Physical iOS/Android tracking and printed-target reliability still require device testing.

### BridgeAssist

`assistant.html` and the contextual dialog expose chat only. There is no browsable Q&A library. `data/study-content.json` contains 197 newly authored canonical study answers, fourteen organelle descriptions, and 89 scientific citation records. A local weighted keyword/alias retriever selects content and provides source links. It does not call hosted AI APIs, require a key, browse live, train a model, or claim frontier-model reasoning. The public static data is not private or access-controlled. Ambiguous/unsupported questions receive scope guidance instead of invented answers.

Four controlled chart types illustrate osmosis, enzyme saturation, idealized gas behavior, and activation energy. They use labeled illustrative functions and relative units, optional parameter animation, and accessible value tables. They are not experimental observations. No arbitrary model-generated code executes. No AI-generated raster imagery or unvetted internet-image gallery is included. The earlier 1,200-image research catalog remains a candidate research asset, not an approved production image library.

Service referrals explicitly identify BioBridge as independent and direct bookings, equipment loans, accounts, counseling, and college services to official destinations. Crisis language routes before academic scope filtering. Faculty availability/office hours are excluded. Conversations are not sent to a server or saved by this code; ordinary hosting request logs still apply to page/asset requests.

### Handouts and provenance

Sixteen visual study guides combine diagram-led references and self-check questions with concise explanations. Topics include cell structures/materials, protein trafficking, membrane components, diffusion/osmosis/transport, cell plans, respiration, DNA replication, phylogeny, plant life cycles, molecular shape, limiting reactants, molarity/dilution, and density. Guides favor readable content over a strict page limit. There are no student name/date fields, blank write-in areas, or assignment requirements. Each PDF includes its explanatory content; separate answer-key downloads are not part of the interface. Earlier unpublished format drafts are archived outside the repository. Legacy `*-practice.pdf` URLs resolve to copies of the combined study guides for preview compatibility.

Handouts use the supplied Learning Commons footer artwork and the exact author name **Kaehyuni (Kenny) Nguyen**. Original programmatic vector diagrams avoid importing third-party figures. Scientific citations and authorship/rights notes are online in the References and Credits tabs and `data/handouts.json`, rather than printed reference blocks. Stable versioned QR activity URLs resolve to the cell lesson or an appropriate handout companion. Keep old versioned activity records when revising a PDF.

All new educational content is AI-assisted and awaits independent educator review. Authoring, calculation, structural, and rendering checks are not a claim of peer review or official Dallas College approval. Attribution alone does not grant a reuse license. New third-party images/meshes must have item-level permission/rights records before use.

### Public syllabus snapshot

`data/syllabi.json` is a November 5, 2026 snapshot: 430 official scheduled sections in the four requested science courses plus 235 public Spring 2027 syllabus records across 40 subjects. Their union is 661 section records, not a complete college-wide course list. It includes 16 clearly marked Fall 2026 reference calendars. Five conflicting Spring-source calendars are flagged and conflicting dates withheld. A publisher redirect URL does not establish syllabus publication.

Search/filter/compare is at `syllabi.html`. Calendar-span filters support short, flex, and full-length comparisons without asserting identical pacing or mechanically scaling one term's topic weeks. Source-published institutional faculty contacts retain their source term. No office hours, full syllabus republication, private student data, or professor rankings are included. Current course policy comes from the original instructor syllabus, not this snapshot.

### Verification and dependencies

Run `node --test tests/*.test.js` (Node 22+; no npm install). These checks cover retrieval/citations, crisis/service routing, label aliases, guide destinations, publication status, term separation, and excluded office-hours fields. Browser checks covered lesson startup, quiz/label feedback, annotations, lighting presets, sourced chat, service routing, handout filters, syllabus comparisons, credits, and a 390px iframe layout. Camera/device testing remains separate.

Three.js 0.160.0 and MindAR 1.2.5 are vendored. Their MIT license files and bundled dependency notices are retained in `vendor/`; Montserrat's SIL OFL is in `fonts/OFL.txt`. There is no compile step. `netlify.toml` preserves repository-root static publishing and permits only same-origin camera access while disabling microphone/geolocation.
