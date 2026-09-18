; M82 absolute extrusion with end-of-layer G92 E rebases.
; Deterministic expectation: each layer extrudes 100 mm from a rebased origin,
; so both engines see 4 x 25 mm deltas per layer = 200 mm total. G92 E0 never
; adds distance — it only relocates the absolute-E origin.

G90 ; absolute positioning
M82 ; absolute extrusion
G28 ; home
G1 Z5 F6000 ; lift
G1 X0 Y0 Z0.2 F6000

;LAYER:0
G1 X20 Y0 E25 F1200
G1 X20 Y20 E50
G1 X0 Y20 E75
G1 X0 Y0 E100
G92 E0 ; rebase for the next layer — no motion, no distance added

;LAYER:1
G1 Z0.4 F6000
G1 X20 Y0 E25 F1200
G1 X20 Y20 E50
G1 X0 Y20 E75
G1 X0 Y0 E100
G92 E0

;LAYER:2
G1 Z0.6 F6000
G1 X20 Y0 E25 F1200
G1 X20 Y20 E50
G1 X0 Y20 E75
G1 X0 Y0 E100
G92 E0

;LAYER:3
G1 Z0.8 F6000
G1 X20 Y0 E25 F1200
G1 X20 Y20 E50
G1 X0 Y20 E75
G1 X0 Y0 E100
G92 E0

;LAYER:4
G1 Z1.0 F6000
G1 X20 Y0 E25 F1200
G1 X20 Y20 E50
G1 X0 Y20 E75
G1 X0 Y0 E100

M84 ; disable motors
