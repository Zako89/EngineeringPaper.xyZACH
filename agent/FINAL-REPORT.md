
Final report — .epxyz reverse engineering
1. Executive summary
.epxyz is saved as plain JSON text wrapped in a top-level object with { data, history }, serialized by JSON.stringify(...) and written as application/json. Confirmed.

Local file loading parses .epxyz with JSON.parse(...), requires both top-level keys data and history, then reconstructs live app state via populatePage(...). Confirmed.

The loader tolerates several missing or legacy fields (for example version, config, insertedSheets, codeCellResults, sub_results, and system_results) by defaulting in code. Confirmed.

We can generate .epxyz programmatically in a way that matches the repository’s current save/load expectations; this is supported by traced code paths, fixture comparison, and successful runtime import of a generated example in the app. Confirmed.

2. Save pipeline
2.1 Save pipeline call graph (local file export)
src/DownloadDocumentModal.svelte dispatches downloadSheet with saveAs flag.

src/App.svelte binds downloadSheet={(e) => saveSheetToFile(e.detail.saveAs)}.

saveSheetToFile(saveAs) in src/App.svelte constructs:

appState.history = [{ url, hash: 'file', creation }, ...]
sheet = { data: getSheetObject(true), history: appState.history }
getSheetObject(true) in src/stores.svelte.ts builds the in-memory sheet payload from appState and cell.serialize().

saveSheetToFile serializes via JSON.stringify(sheet) and writes a Blob with type application/json.

Write path:

If File System Access API exists: showSaveFilePicker({ types: fileTypes, suggestedName: "${title}.epxyz" }), then createWritable().write(fileData).
Else fallback: saveFileBlob(fileData, "${title}.epxyz") download-anchor flow in src/utility.ts.
2.2 Serialization evidence
ts
content_copy
const
 fileData 
=
 
new
 
Blob
(
[
JSON
.
stringify
(
sheet
)
]
,
 
{
 type
:
 
"application/json"
 
}
)
;

const
 sheet 
=
 
{
 data
:
 
getSheetObject
(
true
)
,
 history
:
 appState
.
history
 
}
;
2.3 Filename / extension / MIME
Extension: .epxyz (suggested and fallback download names). Confirmed.
MIME: application/json for native sheet save picker type and blob. Confirmed.
Save picker accepts { "application/json": [".epxyz"] } via fileTypes. Confirmed.
Default filename behavior: ${appState.title}.epxyz. Confirmed.
2.4 Transformations before save
getSheetObject(true) includes current runtime fields: version, config, serialized cells, results, system_results, codeCellResults, sub_results, nextId, sheetId, and insertedSheets. Confirmed.

Cells are produced by each class’s serialize() implementation; no additional schema migration is applied during save. Confirmed.

3. Load pipeline
3.1 Load pipeline call graph (local open)
User action (Open) in src/App.svelte -> handleFileOpen().

Open path either:

showOpenFilePicker({ types: fileTypes, id: "epxyz" }), then openSheetFromFile(file, handle).
Or <input type=file accept=".epxyz"> fallback.
openSheetFromFile(...) reads with FileReader.readAsText(file) and onload calls loadSheetFromFile(event, fileHandle, pushState).

loadSheetFromFile(...) -> parseFile(event).

parseFile(...) runs JSON.parse(...), then requires both fileObject.data and fileObject.history; otherwise throws format error.

Parsed values are passed to populatePage(sheet, requestHistory).

populatePage(...) reconstructs runtime state: title, ids, config normalization, cell instantiation with cellFactory(...), and optional restoration of precomputed results.

3.2 Parsing evidence
ts
content_copy
const
 fileObject 
=
 
JSON
.
parse
(
(
event
.
target
.
result
 
as
 
string
)
)
;
Gate condition:

ts
content_copy
if
 
(
fileObject
.
data
 
&&
 fileObject
.
history
)
 
{
 
...
 
}
 
else
 
{
 
throw
 
"File is not the correct format"
;
 
}
3.3 Validation / migration / defaults
Confirmed defaulting during load:

appState.insertedSheets = sheet.insertedSheets ?? []
appState.config = normalizeConfig(sheet.config)
normalizeConfig(...) defaults missing config branches such as:
customBaseUnits
simplifySymbolicExpressions
convertFloatsToFractions
fluidConfig
mathCellConfig.showIntermediateResults
appState.system_results = sheet.system_results ? sheet.system_results : []
appState.sub_results = sheet.sub_results ? new Map(sheet.sub_results) : new Map()
appState.codeCellResults = sheet.codeCellResults ? sheet.codeCellResults : {}
No explicit version-switch migration function was found in the local file load path; compatibility is handled by optional fields and defaults. Confirmed.

3.4 Loader expectations and failure paths
Hard parse requirement: top-level data and history must both be present. Confirmed.

An empty array for history satisfies the observed initial parse gate because the gate checks presence/truthiness of the parsed value in JavaScript. Confirmed.

data.cells must contain recognized type values accepted by cellFactory(...); unknown types hit the exhaustive default and fail population. Confirmed.

data should include title, nextId, and sheetId; missing values are not explicitly validated at the initial parse gate and may degrade behavior later. Inferred.

data.results is not confirmed by the initial parse gate, but appears expected by later logic and should be emitted for stable behavior. Inferred.

Any parse or reconstruction exception surfaces error modals such as “Error parsing input file” or “Error restoring file”. Confirmed.

4. Confirmed .epxyz structure
Top-level on disk:

json
content_copy
{

  
"data"
:
 
{
 
"...sheet..."
:
 
"..."
 
}
,

  
"history"
:
 
[

    
{

      
"url"
:
 
"string"
,

      
"hash"
:
 
"string"
,

      
"creation"
:
 
"ISO date string"

    
}

  
]

}
Current writer (getSheetObject(true)) shape for data:

json
content_copy
{

  
"version"
:
 
20260313
,

  
"config"
:
 
{
 
"..."
:
 
"..."
 
}
,

  
"cells"
:
 
[

    
{
 
"type"
:
 
"math"
,
 
"id"
:
 
0
,
 
"latex"
:
 
"x=1"
,
 
"config"
:
 
null
 
}

  
]
,

  
"title"
:
 
"My Sheet"
,

  
"results"
:
 
[
]
,

  
"system_results"
:
 
[
]
,

  
"codeCellResults"
:
 
{
}
,

  
"sub_results"
:
 
[
]
,

  
"nextId"
:
 
1
,

  
"sheetId"
:
 
"uuid"
,

  
"insertedSheets"
:
 
[
]

}
5. Required vs optional fields
5.1 Required (confirmed by loader gate or immediate reconstruction needs)
Top-level data. Confirmed.
Top-level history must be present for the initial parse gate. Confirmed.
data.cells with valid cell type entries for successful reconstruction. Confirmed.
5.2 Required or strongly recommended for stable behavior (inferred)
data.title — assigned directly to app state. Inferred.
data.nextId — assigned to BaseCell.nextId. Inferred.
data.sheetId — used in identity/history-related behavior. Inferred.
data.results — not part of the hard parse gate, but likely expected by later logic; safest to emit as []. Inferred.
5.3 Optional (confirmed defaulted)
data.version
data.config
data.insertedSheets
data.system_results
data.sub_results
data.codeCellResults
Several nested config fields and math-cell config fields used by older documents
5.4 Unknown
The absolute mathematically smallest schema that avoids all downstream UI edge cases across every feature path remains unproven without broader browser E2E coverage.

6. Minimal valid examples
6.1 Smallest plausible valid file (code-backed minimal)
json
content_copy
{

  
"data"
:
 
{

    
"title"
:
 
"Minimal"
,

    
"cells"
:
 
[
]
,

    
"results"
:
 
[
]
,

    
"nextId"
:
 
0
,

    
"sheetId"
:
 
"11111111-1111-4111-8111-111111111111"

  
}
,

  
"history"
:
 
[
]

}
6.2 One text cell
json
content_copy
{

  
"data"
:
 
{

    
"title"
:
 
"One text cell"
,

    
"cells"
:
 
[

      
{

        
"type"
:
 
"documentation"
,

        
"id"
:
 
0
,

        
"json"
:
 
{
 
"ops"
:
 
[
{
 
"insert"
:
 
"Hello from .epxyz\n"
 
}
]
 
}

      
}

    
]
,

    
"results"
:
 
[
]
,

    
"nextId"
:
 
1
,

    
"sheetId"
:
 
"22222222-2222-4222-8222-222222222222"

  
}
,

  
"history"
:
 
[
]

}
6.3 One equation / math cell
json
content_copy
{

  
"data"
:
 
{

    
"title"
:
 
"One math cell"
,

    
"cells"
:
 
[

      
{

        
"type"
:
 
"math"
,

        
"id"
:
 
0
,

        
"latex"
:
 
"x=2"
,

        
"config"
:
 
null

      
}

    
]
,

    
"results"
:
 
[
]
,

    
"nextId"
:
 
1
,

    
"sheetId"
:
 
"33333333-3333-4333-8333-333333333333"

  
}
,

  
"history"
:
 
[
]

}
Minimal examples use history: [] because that satisfies the observed initial parse gate. For maximum compatibility, production generation may prefer a populated file-history entry matching the normal save path.

7. Generator script
Runnable script: agent/generate-epxyz.js.

It generates a .epxyz file with:

top-level { data, history }
one documentation (text) cell
one math cell
default config and metadata fields aligned with the current writer shape
Run:

bash
content_copy
node
 agent/generate-epxyz.js
node
 agent/generate-epxyz.js agent/custom.epxyz 
"My Title"
Generated artifact:

agent/generated-example.epxyz
8. Validation performed
8.1 Static / code-trace validation
Findings are grounded in traced repository code paths, including:

saveSheetToFile
parseFile
loadSheetFromFile
populatePage
getSheetObject
normalizeConfig
cellFactory
relevant cell serializers
8.2 Fixture comparison
The generated output was compared structurally against an existing repository fixture:

tests/test_md_export.epxyz
This was used as a key-structure comparison, not as sole proof of runtime validity.

8.3 Runtime validation
Runtime validation was performed by generating agent/generated-example.epxyz, opening it in the app, and confirming that:

the documentation cell rendered Generated by Node.js script.
the math cell rendered X=2
This confirms that a programmatically generated .epxyz matching the reconstructed format is accepted by the real app.

8.4 Remaining validation gap
A save-after-open round-trip comparison was not yet recorded in this report. That would still be useful to distinguish minimum importable shape from canonical writer output.

9. Confidence assessment
High confidence
Save-path serialization format and MIME/extension handling
Local open parse gate (data + history) and reconstruction through populatePage
Defaulting behavior for older schema fields (normalizeConfig, optional result maps)
Programmatically generated .epxyz files matching the reconstructed schema can be imported by the app
Medium confidence
The “smallest valid file” is still best described as plausible minimal rather than exhaustively proven across all feature paths
Some fields may be technically omittable but still useful for avoiding subtle UI/runtime issues
Low confidence
None of the core format findings are low confidence
Remaining uncertainty is primarily about edge-case breadth, not the main schema direction
10. Remaining uncertainties
Whether results can be omitted in every case without side effects across all UI states.

Next step: open generated minimal variants in browser E2E and compare behavior.

Whether history: [] versus one explicit { hash: "file" } entry changes subtle UX behavior such as recents/history handling.

Next step: compare recents/history interactions after loading both variants.

Whether the app normalizes additional defaults on re-save beyond what was already inferred from writer code.

Next step: open generated files, immediately save them again, and compare the output.

11. Practical recommendation
Yes, .epxyz can now be generated directly from external data.

Recommended production approach:

Emit the fuller writer-aligned shape, as in agent/generate-epxyz.js, for maximum compatibility.
Keep uncertain-minimal fields configurable behind constants if size minimization matters.
Always emit at least:
title
cells
results
nextId
sheetId
history
Prefer recognized cell shapes only, especially:
documentation cells with Quill-style json.ops
math cells with latex and config
Add a browser-level import smoke test in CI using Playwright with generated fixtures.
Add a round-trip save comparison test to identify canonical writer defaults.
For production generation, prefer matching the normal saved shape rather than relying on the thinnest importable payload.