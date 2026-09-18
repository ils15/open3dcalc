; BambuStudio 2.1.0
; model printing time: 0h 45m 0s
; total estimated time: 0h 45m 0s
; filament used [mm] = 1000
; filament used [cm3] = 2.405
; total filament used [g] = 2.98
; layer_height = 0.2
; line_width = 0.4

G90 ; absolute positioning
M82 ; absolute extrusion
G28 ; home
G1 Z5 F6000 ; lift
G1 X0 Y0 Z0.2 F6000

;LAYER:0
; FEATURE:inner wall
G1 X20 Y0 E50 F1200
G1 X20 Y20 E100
G1 X0 Y20 E150
G1 X0 Y0 E200

;LAYER:1
; FEATURE:inner wall
G1 Z0.4 F6000
G1 X20 Y0 E250 F1200
G1 X20 Y20 E300
G1 X0 Y20 E350
G1 X0 Y0 E400

;LAYER:2
; FEATURE:inner wall
G1 Z0.6 F6000
G1 X20 Y0 E450 F1200
G1 X20 Y20 E500
G1 X0 Y20 E550
G1 X0 Y0 E600

;LAYER:3
; FEATURE:top surface
G1 Z0.8 F6000
G1 X20 Y0 E650 F1200
G1 X20 Y20 E700
G1 X0 Y20 E750
G1 X0 Y0 E800

;LAYER:4
; FEATURE:top surface
G1 Z1.0 F6000
G1 X20 Y0 E850 F1200
G1 X20 Y20 E900
G1 X0 Y20 E950
G1 X0 Y0 E1000

M84 ; disable motors
