; M82 absolute extrusion with an implicit spool restart: E drops mid-file
; WITHOUT a G92 rebase (a firmware/spool swap zeroing the extruder datum).
; KNOWN DIVERGENCE (by construction): legacy M82 treats a positive E value
; below the high-water mark as noise and waits for E to exceed it again, so
; the re-priming after the swap counts only above the old maximum. Chestnut
; rebases `lastE` on every E word, so the post-drop extrusion counts in full.
; Expected: legacy 80 mm, chestnut 110 mm.

G90 ; absolute positioning
M82 ; absolute extrusion
G28 ; home
G1 Z5 F6000 ; lift
G1 X0 Y0 Z0.2 F6000

;LAYER:0
G1 X20 Y0 E40 F1200
G1 X20 Y20 E10 ; implicit restart: E datum silently drops without a G92
G1 X0 Y20 E60
G1 X0 Y0 E80

M84 ; disable motors
