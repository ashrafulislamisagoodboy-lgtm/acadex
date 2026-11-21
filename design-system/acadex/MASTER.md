# Acadex · Campus field notes

Design the interface like the handbook a student might keep in a schoolbag. Use specific labels for real records, rather than slogans or invented activity.

- **Materials:** `src/glass.css` layers frosted sheets and floating navigation over a meadow photograph with a stationary skyline, a looping wind ripple across the photographed field, foreground grass and independently drifting clouds. The header pause control remembers its setting; the landscape holds still when the tab is hidden or reduced motion is requested. Use an opaque surface when blur is unsupported or reduced transparency is requested.
- **Inside pages:** smoked frames carry light text on ranks, quizzes, profiles, the calendar and admin. Use the inset glass material for fields and panels inside cards; keep quiz result colors and QR codes distinct.
- **Type:** System sans-serif for large titles, Figtree for reading, Sora for controls, system monospace for folios, dates and exercise numbers. Avoid uppercase paragraphs.
- **Structure:** the student studio opens with a paper-plane illustration and one clear practice action, followed by a no-stakes daily warm-up, live practice totals, campus links and the field atlas. The register is for comparing people, the calendar for comparing dates, and the office for editing records. Use their actual data shapes rather than repeating the dashboard layout.
- **Art:** The field atlas pairs two traced star charts with the engraved `public/observatory.svg`. Readers turn plates themselves; do not advance them on a timer. Keep its fine linework legible; omit it when a form needs the space.
- **Motion:** use a short page arrival, a small directional shift on links, and finite feedback for answers. Keep the reading surface still. Honor reduced motion in both CSS and MotionConfig.
- **Small screens:** collapse the opening spread to a single column, keep the primary navigation dock accessible above the safe area, and let admin actions wrap instead of clipping them.
