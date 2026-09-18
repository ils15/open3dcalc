; M83 relative extrusion with a signed retraction / de-retraction pair.
; KNOWN DIVERGENCE (by construction): legacy M83 sums deltas WITH sign, so a
; retraction/de-retraction pair nets to zero. Chestnut only accumulates
; positive deltas. Expected: legacy 20 mm, chestnut 22 mm.

G90 ; absolute positioning
M83 ; relative extrusion
G28 ; home
G1 Z5 F6000 ; lift
G1 X0 Y0 Z0.2 F6000

;LAYER:0
G1 X20 Y0 E10 F1200
G1 X20 Y20 E-2 ; retraction — negative delta
G1 X0 Y20 E2 ; de-retraction — positive delta
G1 X0 Y0 E10

M84 ; disable motors
