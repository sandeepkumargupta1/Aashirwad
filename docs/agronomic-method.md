# Explainable screening method

The crop database is an initial, configurable screening configuration. It is not yet regionally reviewed. Each crop links to an agricultural extension or FAO reference for context. Numeric ranges differ by variety, stage, geography and crop system; a general reference does not validate every coded threshold.

## Configured criteria

| Criterion | Weight | Current use |
| --- | --- | --- |
| Growing season | 25 | Listed season: 100, otherwise 0; out-of-season final score capped at 39 |
| Water availability | 25 | Farmer category plus crop water-demand category; historical rainfall only adds context in rain-fed screening |
| Seasonal mean temperature | 20 | 100 within configured interval, linear decline over a 12 °C margin |
| Soil pH | 20 | 100 within configured interval, linear decline over a two-unit margin |
| Texture compatibility | 10 | 100 for a listed texture, 35 otherwise |

The water mapping is deliberately explicit: reliable = 100; limited = 95/70/25 for low/medium/high water demand; rain-fed starts at 75/40/10. A simplified 70% historical-rainfall factor can raise rain-fed context scores, capped at 65 for high-water crops. This factor is a configurable screening assumption, **not a measured effective-rainfall coefficient or calibrated water-balance model**. The water calculator separately requires user-provided effective rainfall.

Missing factors are excluded and remaining weights normalized. A visible score requires ≥70% weight coverage, a soil pH or texture value, and at least five qualifying seasonal climate records. Coverage describes these five factors only, not full agronomic certainty. In the default Rabi season only four listed profiles are seasonal; the interface shows those four rather than inventing a fifth suitable crop. All nine profiles remain inspectable.

Fertility, total nitrogen, surface moisture, local production, groundwater risk and actual rooting-zone water are shown where available but not silently converted into unsupported numeric score factors. Available N/P/K are never inferred from total N or a mapped location. Extend the weights only after regional validation.

## Irrigation scenario

Reference: [FAO crop water needs](https://www.fao.org/4/S2022E/s2022e07.htm).

```text
ETc over 7 days = user ETo (mm/day) × Kc × 7
Net deficit (mm) = max(0, ETc − user effective rain over 7 days)
Gross water (mm) = net deficit / user application efficiency
Volume (m³) = gross water (mm) × farm area (ha) × 10
```

Stage coefficients for configured crops are indicative table values. Rice and mustard have no coefficient in this implementation and are excluded from the calculator. Crop ET ranges in crop comparison are not total irrigation requirements; paddy losses, land preparation and soil storage changes require separate treatment. No precise irrigation timing or fertilizer dose is produced.
