; M82 absolute extrusion with a retraction / de-retraction pair.
; KNOWN DIVERGENCE (by construction): legacy M82 ignores an E decrease and
; keeps the previous high-water mark, so the de-retraction back to the same
; value adds 0. Chestnut rebases `lastE` on every E word, so the de-retraction
; recovery counts as fresh extrusion. Expected: legacy 20 mm, chestnut 22 mm.

G90 ; absolute positioning
M82 ; absolute extrusion
G28 ; home
G1 Z5 F6000 ; lift
G1 X0 Y0 Z0.2 F6000

;LAYER:0
G1 X20 Y0 E10 F1200
G1 X20 Y20 E8 ; retraction — E decreases
G1 X0 Y20 E10 ; de-retraction — E returns
G1 X0 Y0 E20

M84 ; disable motors
