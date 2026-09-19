# Exact bounds for contour extraction

Each row is divided into blocks of 16 cells. A block records the exact minimum
and maximum of its two vertex rows, including its shared right boundary. One
range pass is reused for all contour levels; blocks wholly on one side of a
level skip the original per-cell scan. Retained cells keep their original order,
interpolation, saddle handling, path stitching and filters. The grid, level
count, spatial smoothing and drawing functions are unchanged.

The range buffers are allocated with the field and reused each frame. Calling
`contourEvaluate()` invalidates the ranges; direct level extraction falls back
to the full scan until `contourExtract()` prepares matching bounds.

Run `npm run test:bounds` for complete coordinate-array comparisons against a
forced full scan, including partial blocks, equality, plateaus and saddle cells.
The existing browser render, smoothness, coverage and performance runners remain
applicable. CPU extraction measurements do not establish GPU presentation FPS or
video dropped-frame improvements.
